import { canon, cleanSnippet, norm } from './utils_core.js';
import { TEAM_TRICODES } from './config_core.js';
import { searchAndExtract } from './connector_search.js';

function teamFullName(input = '') {
  const raw = norm(input);
  return TEAM_TRICODES[raw.toUpperCase()] || raw;
}
function numberNearLabel(blob = '', labels = []) {
  const text = String(blob || '');
  for (const label of labels) {
    const esc = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx1 = new RegExp(`${esc}[^0-9-]{0,24}(-?\\d+(?:\\.\\d+)?)`, 'i');
    const rx2 = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(?:${esc})`, 'i');
    const m = text.match(rx1) || text.match(rx2);
    if (m) return Number(m[1]);
  }
  return null;
}
export async function detectPlayerPosition(playerName = '') {
  const found = await searchAndExtract(`${playerName} nba position`, { prefer: ['espn', 'nba.com', 'basketball-reference'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  const c = canon(blob);
  let position = '';
  if (/\bpoint guard\b|\bpg\b/.test(c)) position = 'PG';
  else if (/\bshooting guard\b|\bsg\b/.test(c)) position = 'SG';
  else if (/\bsmall forward\b|\bsf\b/.test(c)) position = 'SF';
  else if (/\bpower forward\b|\bpf\b/.test(c)) position = 'PF';
  else if (/\bcenter\b|\bc\b/.test(c)) position = 'C';
  return { position, evidence: blob.slice(0, 260), confidence: found.confidence || 55, source: found.result?.href || '' };
}
export async function fetchTeamPace(teamName) {
  const found = await searchAndExtract(`${teamFullName(teamName)} team pace nba statmuse`, { prefer: ['statmuse', 'nba.com', 'nbastuffer'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  return { pace: numberNearLabel(blob, ['pace', 'possessions per game']), evidence: blob.slice(0, 320), confidence: found.confidence || 55, source: found.result?.href || '' };
}
export async function fetchOpponentDefenseRank(teamName, position = '') {
  const pos = position || 'all positions';
  const found = await searchAndExtract(`${teamFullName(teamName)} defense rank vs ${pos} nba`, { prefer: ['statmuse', 'nbastuffer', 'nba.com'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  return { rank: numberNearLabel(blob, ['rank', 'defense rank', 'allowed rank']), evidence: blob.slice(0, 320), confidence: found.confidence || 55, source: found.result?.href || '' };
}
export async function fetchExpectedLineup(playerName, teamName) {
  const found = await searchAndExtract(`${teamFullName(teamName)} expected lineup ${playerName} NBA`, { prefer: ['rotowire', 'fantasydata', 'nbcsports'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  const c = canon(blob);
  let rotation = 'Unknown'; let starter = null;
  if (/expected lineup|starting lineup|will start|starting five/.test(c)) { rotation = 'Starter'; starter = true; }
  else if (/bench|second unit|reserve/.test(c)) { rotation = 'Bench'; starter = false; }
  return { rotation, starter, evidence: blob.slice(0, 320), confidence: found.confidence || 55, source: found.result?.href || '' };
}
export async function fetchOfficialTendency(teamName, opponentName) {
  const found = await searchAndExtract(`${teamFullName(teamName)} vs ${teamFullName(opponentName)} referees over under tendencies covers`, { prefer: ['covers', 'actionnetwork'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  return { overPct: numberNearLabel(blob, ['over', 'over record', 'over tendency']), foulRate: numberNearLabel(blob, ['fouls per game', 'whistles', 'foul rate']), evidence: blob.slice(0, 320), confidence: found.confidence || 52, source: found.result?.href || '' };
}
export function buildRestTravelProfile(events = []) {
  const dates = (events || []).map((ev) => new Date(ev.date)).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => b - a);
  if (!dates.length) return { backToBack: false, restDays: null, fatigueScore: null, evidence: 'No date history.' };
  const latest = dates[0]; const prev = dates[1] || null;
  let restDays = null; if (prev) restDays = Math.round((latest - prev) / (24 * 3600 * 1000)) - 1;
  const backToBack = restDays === 0;
  let fatigueScore = 72;
  if (restDays == null) fatigueScore = 72; else if (restDays <= 0) fatigueScore = 20; else if (restDays === 1) fatigueScore = 60; else if (restDays === 2) fatigueScore = 82; else fatigueScore = 92;
  return { backToBack, restDays, fatigueScore, evidence: backToBack ? 'Back-to-back spot.' : `Rest days: ${restDays == null ? 'unknown' : restDays}` };
}
export function calculatePrizePicksFantasyScore(statLine = {}) {
  return (statLine.points ?? 0) + (statLine.rebounds ?? 0) * 1.2 + (statLine.assists ?? 0) * 1.5 + (statLine.blocks ?? 0) * 3 + (statLine.steals ?? 0) * 3 + (statLine.turnovers ?? 0) * -1;
}
