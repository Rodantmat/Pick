import { average } from './utils_core.js';
import { fetchEspnPlayerBundle, fetchEspnInjuryStatus, computeRecentAverage, computeSeasonAverage, computeUsageLast3 } from './connector_espn.js';
import { detectPlayerPosition, fetchTeamPace, fetchOpponentDefenseRank, fetchExpectedLineup, fetchOfficialTendency, buildRestTravelProfile, calculatePrizePicksFantasyScore } from './connector_nba.js';
import { pushLog, logFetchStart, logFetchSuccess } from './logger.js';

export const FACTOR_BLUEPRINTS = [
  { key: 'validation', tier: '2A', title: 'Prop Validation', minor: false },
  { key: 'rotation', tier: '2B', title: 'Rotation Status', minor: false },
  { key: 'usage', tier: '2B', title: 'Usage Rate', minor: false },
  { key: 'projection', tier: '2B', title: 'Internal Projection', minor: false },
  { key: 'oppdef', tier: '2C', title: 'Opponent Defense Rank', minor: false },
  { key: 'pace', tier: '2C', title: 'Pace & Tempo', minor: false },
  { key: 'fatigue', tier: '2C', title: 'Rest / Travel Fatigue', minor: false },
  { key: 'refs', tier: '2D', title: 'Official / Referee Tendency', minor: true },
  { key: 'injury_nuance', tier: '2D', title: 'Injury Report Nuance', minor: true },
  { key: 'fantasy_score', tier: '2B', title: 'Fantasy Score Lens', minor: false },
  { key: 'standalone', tier: '2F', title: 'Clean Standalone Probability', minor: false },
  { key: 'relational', tier: '2E', title: 'Relational Survivability Score', minor: false }
];
function initialCard(f, row) { return { key: f.key, tier: f.tier, title: f.title, status: f.key === 'validation' ? 'ready' : 'waiting', statusLabel: f.key === 'validation' ? 'Parsed from ingested row' : 'Waiting', magnitude: null, confidence: f.key === 'validation' ? 100 : 0, evidence: f.key === 'validation' ? `${row.entity} • ${row.lineText}` : '', source: f.key === 'validation' ? 'Ingested row' : '', minor: !!f.minor, warning: '', recommendation: '' }; }
export function getInitialNbaCards(row) { return FACTOR_BLUEPRINTS.map((f) => initialCard(f, row)); }
function getCard(row, key) { row._factorCards ||= getInitialNbaCards(row); return row._factorCards.find((c) => c.key === key); }
function setCard(row, key, patch) { row._factorCards ||= getInitialNbaCards(row); const card = getCard(row, key); if (!card) return null; Object.assign(card, patch || {}); row._lastUpdatedAt = Date.now(); return card; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function magnitudeForType(row, magnitude) { const type = row?.type || 'REGULAR'; if (!Number.isFinite(magnitude)) return null; if (type === 'DEMON') return Math.round(magnitude * 1.35 * 10) / 10; if (type === 'GOBLIN') return Math.round(magnitude * 0.85 * 10) / 10; return Math.round(magnitude * 10) / 10; }
function confidenceFrom(sourceConfidence, fallback = 60) { const n = Number(sourceConfidence); return Number.isFinite(n) ? clamp(Math.round(n), 0, 100) : fallback; }
function parseLine(line = '') { const n = Number(String(line || '').match(/-?\d+(?:\.\d+)?/)?.[0]); return Number.isFinite(n) ? n : null; }
function formatNum(n, digits = 1) { return Number.isFinite(n) ? Number(n).toFixed(digits).replace(/\.0$/, '.0') : '—'; }
function propLensProjection(row, bundle) { const last5 = computeRecentAverage(bundle.events, row.propFamily, 5); const last10 = computeRecentAverage(bundle.events, row.propFamily, 10); const season = computeSeasonAverage(bundle.events, row.propFamily); if (![last5, last10, season].some(Number.isFinite)) return null; return Math.round((((last5 ?? season ?? 0) * 0.4) + ((last10 ?? season ?? 0) * 0.3) + ((season ?? last5 ?? 0) * 0.3)) * 10) / 10; }
function probabilityFromSummary(totalMagnitude, avgConfidence) { return clamp(Math.round(58 + (totalMagnitude * 2.8) + ((avgConfidence - 65) * 0.12)), 1, 99); }
function relationalDragForRow(row, warningCount) { let drag = 0; if (row.type === 'DEMON') drag += 9; if (row.type === 'GOBLIN') drag += 2; if (row.type === 'FREE_PICK') drag -= 2; drag += warningCount * 2.5; return Math.round(drag * 10) / 10; }
async function guardedStep({ state, row, factor, requestRender, fn }) {
  setCard(row, factor, { status: 'loading', statusLabel: 'Loading', warning: '' }); requestRender?.();
  try { const value = await fn(); requestRender?.(); return value; } catch (err) {
    setCard(row, factor, { status: 'warning', statusLabel: 'Warning', warning: String(err && err.message || err), confidence: 28 });
    pushLog(state, { rowId: row.rowId, factor, level: 'warn', message: 'step:warning', meta: { error: String(err && err.message || err) } }); requestRender?.(); return null;
  }
}
function summarizeFantasy(events = []) { const scores = (events || []).slice(0, 5).map((ev) => calculatePrizePicksFantasyScore(ev)).filter(Number.isFinite); const avg = average(scores); return Number.isFinite(avg) ? Math.round(avg * 10) / 10 : null; }

export async function ensureNbaMining(row, ctx = {}) {
  if (!row || row.leagueId !== 'nba') return;
  const state = ctx.state || null; const requestRender = ctx.requestRender || null; const saveState = ctx.saveState || null;
  row._factorCards ||= getInitialNbaCards(row); row._sweepStatus ||= 'idle'; if (row._sweepStatus === 'loading' || row._sweepStatus === 'done') return;
  row._sweepStatus = 'loading'; pushLog(state, { rowId: row.rowId, factor: 'system', level: 'info', message: 'sweep:start' }); requestRender?.();
  let bundle = null;
  try {
    setCard(row, 'validation', { status: 'ready', statusLabel: 'Ready', magnitude: 0, confidence: 100, evidence: `${row.entity} • ${row.lineText} • ${row.team || 'No team'} vs ${row.opponent || 'No opponent'}`, source: 'Ingested row' });
    await guardedStep({ state, row, factor: 'rotation', requestRender, fn: async () => {
      logFetchStart(state, row.rowId, 'rotation', 'espn:gamelog'); bundle = await fetchEspnPlayerBundle(row.entity); logFetchSuccess(state, row.rowId, 'rotation', 'espn:gamelog', { events: bundle?.events?.length || 0 });
      const lineup = await fetchExpectedLineup(row.entity, row.team || ''); const starter = lineup?.starter === true; const mag = magnitudeForType(row, starter ? 3.4 : lineup?.starter === false ? -3.8 : -0.4);
      setCard(row, 'rotation', { status: starter === null || starter === undefined ? 'warning' : 'ready', statusLabel: starter === null || starter === undefined ? 'Warning' : 'Ready', magnitude: mag, confidence: confidenceFrom(lineup?.confidence, 60), evidence: lineup?.evidence || 'Lineup signal not clean.', source: lineup?.source || 'RotoWire/FantasyData search', warning: starter === null || starter === undefined ? 'Rotation not fully confirmed.' : '', recommendation: starter === false ? 'Bench flag' : '' });
    }});
    await guardedStep({ state, row, factor: 'usage', requestRender, fn: async () => {
      const usage = computeUsageLast3(bundle?.events || []); if (!Number.isFinite(usage)) throw new Error('Usage signal unavailable.');
      setCard(row, 'usage', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((usage - 18) / 2.6, -4.5, 4.5)), confidence: 78, evidence: `Approx usage load last 3: ${formatNum(usage)}`, source: 'ESPN game log' });
    }});
    await guardedStep({ state, row, factor: 'projection', requestRender, fn: async () => {
      const projection = propLensProjection(row, bundle || { events: [] }); const line = parseLine(row.line); if (!Number.isFinite(projection)) throw new Error('Projection unavailable.');
      const edge = Number.isFinite(line) ? Math.round((((projection - line) / Math.max(line, 1)) * 1000)) / 1000 : null; row._baselineEdge = edge;
      setCard(row, 'projection', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, Number.isFinite(edge) ? clamp(edge * 100, -5, 5) : 1.4), confidence: 82, evidence: `Projection ${formatNum(projection)} | Last 5/10/Season weighted`, source: 'Internal projection engine', recommendation: Number.isFinite(edge) ? `baseline_edge ${edge}` : '' });
    }});
    await guardedStep({ state, row, factor: 'oppdef', requestRender, fn: async () => {
      const position = await detectPlayerPosition(row.entity); const oppDef = await fetchOpponentDefenseRank(row.opponent || '', position?.position || ''); const rank = Number(oppDef?.rank); if (!Number.isFinite(rank)) throw new Error('Opponent defense rank unavailable.');
      setCard(row, 'oppdef', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((16 - rank) / 3, -4.2, 4.2)), confidence: confidenceFrom(oppDef?.confidence, 62), evidence: `Vs ${position?.position || 'all'} rank: ${rank}`, source: oppDef?.source || 'StatMuse/NBAStuffer' });
    }});
    await guardedStep({ state, row, factor: 'pace', requestRender, fn: async () => {
      const teamPace = await fetchTeamPace(row.team || ''); const pace = Number(teamPace?.pace); if (!Number.isFinite(pace)) throw new Error('Team pace unavailable.');
      setCard(row, 'pace', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((pace - 99.5) / 1.3, -4.5, 4.5)), confidence: confidenceFrom(teamPace?.confidence, 60), evidence: `Team Pace: ${formatNum(pace)} possessions`, source: teamPace?.source || 'StatMuse/NBAStuffer' });
    }});
    await guardedStep({ state, row, factor: 'fatigue', requestRender, fn: async () => {
      const rest = buildRestTravelProfile(bundle?.events || []); const fatigueScore = Number(rest?.fatigueScore); if (!Number.isFinite(fatigueScore)) throw new Error('Fatigue profile unavailable.');
      setCard(row, 'fatigue', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((fatigueScore - 60) / 10, -4.8, 4.8)), confidence: 80, evidence: rest?.evidence || 'Rest profile computed.', source: 'ESPN schedule history' });
    }});
    await guardedStep({ state, row, factor: 'refs', requestRender, fn: async () => {
      const refs = await fetchOfficialTendency(row.team || '', row.opponent || ''); const overPct = Number(refs?.overPct); const foulRate = Number(refs?.foulRate);
      const rawMag = Number.isFinite(overPct) ? (overPct - 50) / 6 : Number.isFinite(foulRate) ? (foulRate - 40) / 4 : null; if (!Number.isFinite(rawMag)) throw new Error('Ref tendency unavailable.');
      setCard(row, 'refs', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp(rawMag, -3.5, 3.5)), confidence: confidenceFrom(refs?.confidence, 52), evidence: refs?.evidence || 'Ref trend parsed.', source: refs?.source || 'Covers' });
    }});
    await guardedStep({ state, row, factor: 'injury_nuance', requestRender, fn: async () => {
      const injury = await fetchEspnInjuryStatus(row.entity); const score = Number(injury?.score); if (!Number.isFinite(score)) throw new Error('Injury nuance unavailable.');
      setCard(row, 'injury_nuance', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((score - 70) / 10, -4.8, 3.8)), confidence: confidenceFrom(injury?.confidence, 58), evidence: `${injury?.status || 'Unknown'} • ${injury?.evidence || ''}`.slice(0, 320), source: injury?.source || 'ESPN' });
    }});
    await guardedStep({ state, row, factor: 'fantasy_score', requestRender, fn: async () => {
      const avgFantasy = summarizeFantasy(bundle?.events || []); if (!Number.isFinite(avgFantasy)) throw new Error('Fantasy-score lens unavailable.');
      setCard(row, 'fantasy_score', { status: 'ready', statusLabel: 'Ready', magnitude: magnitudeForType(row, clamp((avgFantasy - 30) / 8, -3, 4)), confidence: 76, evidence: `PrizePicks fantasy avg last 5: ${formatNum(avgFantasy)}`, source: 'Internal PrizePicks scoring' });
    }});
    const major = ['rotation', 'usage', 'projection', 'oppdef', 'pace', 'fatigue', 'fantasy_score'].map((k) => getCard(row, k)).filter(Boolean);
    const minor = ['refs', 'injury_nuance'].map((k) => getCard(row, k)).filter(Boolean);
    const majorMagnitude = major.map((c) => Number(c.magnitude)).filter(Number.isFinite);
    const minorMagnitude = minor.map((c) => Number(c.magnitude)).filter(Number.isFinite);
    const totalMagnitude = [...majorMagnitude, ...minorMagnitude].reduce((a, b) => a + b, 0);
    const avgConfidence = average(row._factorCards.map((c) => Number(c.confidence)).filter(Number.isFinite)) || 60;
    const warningCount = row._factorCards.filter((c) => c.status === 'warning').length;
    const standaloneProbability = probabilityFromSummary(totalMagnitude, avgConfidence);
    const relationalDrag = relationalDragForRow(row, warningCount);
    const relationalScore = clamp(Math.round(standaloneProbability - relationalDrag), 1, 99);
    let recommendation = standaloneProbability >= 64 ? 'KEEP' : 'WATCH';
    const minorOnlyNegative = majorMagnitude.reduce((a, b) => a + b, 0) >= 0 && minorMagnitude.reduce((a, b) => a + b, 0) < 0;
    if (row.type === 'GOBLIN' && minor.some((c) => Number(c.magnitude) < 0)) recommendation = 'QUALITY-CUT';
    if (minorOnlyNegative && !((row._baselineEdge || 0) > 0.035)) recommendation = 'CUT';
    if (minorOnlyNegative && ((row._baselineEdge || 0) > 0.035)) recommendation = 'ALPHA-SHIELD KEEP';
    setCard(row, 'standalone', { status: 'ready', statusLabel: 'Ready', magnitude: Math.round(totalMagnitude * 10) / 10, confidence: Math.round(avgConfidence), evidence: `Standalone Probability ${standaloneProbability}% | baseline_edge ${row._baselineEdge ?? 'n/a'}`, source: '2B-2D internal rollup', recommendation });
    setCard(row, 'relational', { status: 'ready', statusLabel: 'Ready', magnitude: -relationalDrag, confidence: Math.round(avgConfidence), evidence: `Relational Drag ${formatNum(relationalDrag)} | Survivability ${relationalScore}%`, source: '2E rebuild gate', recommendation: `Standalone ${standaloneProbability}% → Relational ${relationalScore}%` });
    row._standaloneProbability = standaloneProbability; row._relationalSurvivability = relationalScore; row._relationalDrag = relationalDrag; row._recommendation = recommendation; row._sweepStatus = 'done';
    pushLog(state, { rowId: row.rowId, factor: 'system', level: 'info', message: 'sweep:done', meta: { standaloneProbability, relationalScore, recommendation } });
  } catch (err) {
    row._sweepStatus = 'done'; pushLog(state, { rowId: row.rowId, factor: 'system', level: 'warn', message: 'sweep:crash', meta: { error: String(err && err.message || err) } });
  }
  saveState?.(); requestRender?.();
}
