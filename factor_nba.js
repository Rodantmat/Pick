import { NBA_FACTORS } from './config_core.js';
import { ensureDiagState, upsertDiagEntry, finishDiag, rawPreview } from './diagnostics.js';
import { fetchEspnStatsBundle, fetchEspnCoreStats, computePropAverage, computePropFromTotals, computeProjectedMinutes, computeScheduleFatigue, computeHomeAwaySplitScore } from './connector_espn.js';
import { fetchNbaScoreboard, fetchNbaAdvancedTeamStats, fetchBbrRatings, getGameContext, extractTeamMetrics, extractBbrTeamMetrics } from './connector_nba.js';
import { fetchEspnInjuries, parseEspnInjuryStatus } from './connector_injuries.js';
import { searchWebOneQuery } from './connector_search.js';
import { average, clampNumber } from './utils_core.js';

function baseCard(spec){
  return { ...spec, status: spec.live ? 'loading':'waiting', statusLabel: spec.live ? 'Loading live probe...' : 'Paused', sourcesLabel: spec.sources.join(' • '), parsedResult:'—', evidence: spec.live ? '—' : spec.note };
}

export function ensureNbaMining(row, onUpdate){
  row._onMiningUpdate = onUpdate || row._onMiningUpdate || null;
  if (row._miningLoaded) return;
  row.miningStatus = NBA_FACTORS.map(baseCard);
  row._miningLoaded = true;
  mineNbaRow(row).catch(err => console.error(err));
}

function notifyRowUpdate(row){
  try { row._onMiningUpdate && row._onMiningUpdate(); } catch {}
  try { window.dispatchEvent(new CustomEvent('pickcalc:nba-update',{detail:{rowId:row.rowId}})); } catch {}
}

function setCard(row, key, patch){
  const card = row.miningStatus.find(c=>c.key===key); if (!card) return;
  Object.assign(card, patch);
  notifyRowUpdate(row);
}

function asReady(val, provider='direct', evidence=''){
  return { status:'ready', statusLabel: provider==='direct' ? 'Direct source found' : 'Search evidence found', parsedResult: String(val), evidence: evidence || String(val) };
}
function asRaw(evidence, provider='backup search'){ return { status:'waiting', statusLabel:'Trusted raw captured', parsedResult:'Raw data captured.', evidence, sourcesLabel: provider }; }
function asFailed(msg='No trusted source return.'){ return { status:'failed', statusLabel:'Probe failed', parsedResult:'No trusted source return.', evidence: msg }; }

function queryFor(row, purpose){ return `${row.entity} ${purpose} nba`; }

async function safeSearch(row, key, purpose){
  const res = await searchWebOneQuery(queryFor(row, purpose));
  const text = `${res.title} ${res.snippet} ${res.pageContent||''}`.replace(/\s+/g,' ').trim();
  upsertDiagEntry(row, key, {
    searchQuery: queryFor(row,purpose),
    rawSearch: rawPreview(text, 500),
    resultUrl: res.url || '',
    searchResults: (res.allResults || []).map(r => ({ title:r.title, url:r.url })).slice(0,3)
  });
  return text;
}

function parseAverageSentence(text, row){
  const t = String(text||'');
  const avg = t.match(/averag(?:e|ed)[^\d]{0,20}(\d+(?:\.\d+)?)/i);
  if (avg) return Number(avg[1]);
  const p = row.propFamily;
  const pts = t.match(/(\d+(?:\.\d+)?)\s+points?/i);
  const reb = t.match(/(\d+(?:\.\d+)?)\s+rebounds?/i);
  const ast = t.match(/(\d+(?:\.\d+)?)\s+assists?/i);
  const threes = t.match(/(\d+(?:\.\d+)?)\s+(?:3-pointers?|three-pointers?|threes|3ptm|three point field goals made)/i);
  const vals = { Points: pts && Number(pts[1]), Rebounds: reb && Number(reb[1]), Assists: ast && Number(ast[1]), '3PTM': threes && Number(threes[1]), '3PT Made': threes && Number(threes[1]) };
  if (p === 'Points') return vals.Points ?? null;
  if (p === 'Rebounds') return vals.Rebounds ?? null;
  if (p === 'Assists') return vals.Assists ?? null;
  if (p === '3PTM' || p === '3PT Made') return vals['3PTM'] ?? vals['3PT Made'] ?? null;
  if (p === 'PRA' && vals.Points != null && vals.Rebounds != null && vals.Assists != null) return vals.Points + vals.Rebounds + vals.Assists;
  if (p === 'Pts+Rebs' && vals.Points != null && vals.Rebounds != null) return vals.Points + vals.Rebounds;
  if (p === 'Pts+Asts' && vals.Points != null && vals.Assists != null) return vals.Points + vals.Assists;
  if (p === 'Rebs+Asts' && vals.Rebounds != null && vals.Assists != null) return vals.Rebounds + vals.Assists;
  return null;
}

function bestSearchValue(text, row, key){
  const cleaned = String(text||'').replace(/\s+/g,' ').trim();
  if (!cleaned) return null;
  if (/no results found|subscribe now|advertisement/i.test(cleaned)) return null;
  const parsed = parseAverageSentence(cleaned, row);
  if (parsed != null && parsed >= 0 && parsed < 100) return parsed;

  const avgCombo = cleaned.match(/has averaged\s+(\d+(?:\.\d+)?)\s+points?,\s+(\d+(?:\.\d+)?)\s+rebounds?\s+and\s+(\d+(?:\.\d+)?)\s+assists?/i);
  if (avgCombo) {
    const pts=Number(avgCombo[1]), reb=Number(avgCombo[2]), ast=Number(avgCombo[3]);
    if (row.propFamily === 'Points') return pts;
    if (row.propFamily === 'Rebounds') return reb;
    if (row.propFamily === 'Assists') return ast;
    if (row.propFamily === 'PRA') return pts+reb+ast;
    if (row.propFamily === 'Pts+Rebs') return pts+reb;
    if (row.propFamily === 'Pts+Asts') return pts+ast;
    if (row.propFamily === 'Rebs+Asts') return reb+ast;
  }
  const avgThrees = cleaned.match(/has averaged\s+(\d+(?:\.\d+)?)\s+(?:3-pointers?|threes|three point field goals made)/i);
  if (avgThrees && (row.propFamily === '3PTM' || row.propFamily === '3PT Made')) return Number(avgThrees[1]);

  if (key === 'minutes') {
    const m = cleaned.match(/(?:averag(?:e|ed)|minutes? per game).{0,40}?(\d+(?:\.\d+)?)\s+minutes?/i);
    if (m) return Number(m[1]);
  }
  if (key === 'homeaway') {
    const m = cleaned.match(/(?:home|away).{0,80}?(\d+(?:\.\d+)?)\s+(?:points|rebounds|assists|minutes)/i);
    if (m) return Number(m[1]);
  }
  if (key === 'starters') {
    if (/will start|starting lineup|expected lineup|confirmed lineup/i.test(cleaned)) return 100;
    if (/bench|coming off the bench/i.test(cleaned)) return 20;
  }
  if (key === 'injury') {
    if (/out for season|out/i.test(cleaned)) return 0;
    if (/doubtful/i.test(cleaned)) return 10;
    if (/questionable/i.test(cleaned)) return 50;
    if (/probable/i.test(cleaned)) return 90;
    if (/available|active/i.test(cleaned)) return 100;
  }
  if (key === 'schedule') {
    const yearCount = (cleaned.match(/20\d{2}/g) || []).length;
    if (yearCount >= 2) return Math.min(4, yearCount - 1);
  }
  return null;
}

export async function mineNbaRow(row){
  ensureDiagState(row);
  const liveKeys = NBA_FACTORS.filter(f=>f.live).map(f=>f.key);

  let espnBundle = null, espnCore = null, scoreboard = null, nbaAdv = null, bbrRatings = null, injuryHtml = null;
  try { espnBundle = await fetchEspnStatsBundle(row.entity); } catch (e) { upsertDiagEntry(row,'espn',{error:String(e.message||e)}); }
  try { espnCore = await fetchEspnCoreStats(row.entity); } catch (e) { upsertDiagEntry(row,'espnCore',{error:String(e.message||e)}); }
  try { scoreboard = await fetchNbaScoreboard(); } catch (e) { upsertDiagEntry(row,'scoreboard',{error:String(e.message||e)}); }
  try { nbaAdv = await fetchNbaAdvancedTeamStats(); } catch (e) { upsertDiagEntry(row,'nbaAdv',{error:String(e.message||e)}); }
  if (!nbaAdv) {
    try { bbrRatings = await fetchBbrRatings(); } catch (e) { upsertDiagEntry(row,'bbr',{error:String(e.message||e)}); }
  }
  try { injuryHtml = await fetchEspnInjuries(); } catch (e) { upsertDiagEntry(row,'injuries',{error:String(e.message||e)}); }

  for (const key of liveKeys) {
    try {
      if (key === 'validation') {
        setCard(row, key, { status:'ready', statusLabel:'Parsed from ingested row', parsedResult:`${row.entity} • ${row.lineText} • vs/@ ${row.opponent} • team ${row.team}`, evidence:'Parsed from ingested row' });
        continue;
      }
      if (key === 'coverage') {
        const live = NBA_FACTORS.filter(f=>f.live).map(f=>f.key).join(',');
        const paused = NBA_FACTORS.filter(f=>!f.live).map(f=>f.key).join(',');
        setCard(row, key, { status:'ready', statusLabel:'Internal factor map', parsedResult:`live:${live} | paused:${paused}`, evidence:`live:${live} | paused:${paused}` });
        continue;
      }

      if (['last5','last10','last20'].includes(key) && espnBundle?.events?.length) {
        const nMap = { last5:5,last10:10,last20:20 };
        const val = computePropAverage(espnBundle.events, row.propFamily, nMap[key]);
        if (val != null) { setCard(row, key, { ...asReady((Math.round(val*10)/10).toFixed(1),'direct'), sourcesLabel:'ESPN direct' }); continue; }
      }
      if (key === 'season') {
        let val = null;
        if (espnCore) val = computePropFromTotals(espnCore, row.propFamily);
        if (val == null && espnBundle?.events?.length) val = computePropAverage(espnBundle.events, row.propFamily, espnBundle.events.length);
        if (val != null) { setCard(row,key,{ ...asReady((Math.round(val*10)/10).toFixed(1),'direct'), sourcesLabel:'ESPN core/direct' }); continue; }
      }
      if (key === 'career') {
        const text = await safeSearch(row,key,`${row.propFamily} career stats per game`);
        const val = bestSearchValue(text, row, key);
        if (val != null) { setCard(row,key,{ ...asReady((Math.round(val*10)/10).toFixed(1),'search'), sourcesLabel:'backup search • winner: ddg' }); continue; }
        setCard(row,key, asFailed('No trusted direct or search source returned usable data.')); continue;
      }
      if (key === 'projection') {
        const l5 = espnBundle?.events?.length ? (computePropAverage(espnBundle.events,row.propFamily,5) ?? 0) : null;
        const season = (espnCore ? computePropFromTotals(espnCore,row.propFamily) : null) ?? (espnBundle?.events?.length ? computePropAverage(espnBundle.events,row.propFamily,espnBundle.events.length) : null);
        if (l5 != null || season != null) {
          const projection = Math.round((((l5 ?? season ?? 0)*0.6)+((season ?? l5 ?? 0)*0.4))*10)/10;
          setCard(row,key,{ ...asReady(projection,'direct'), sourcesLabel:'Internal derived from ESPN history' });
          continue;
        }
      }
      if (key === 'minutes') {
        if (espnBundle?.events?.length) {
          const mins = computeProjectedMinutes(espnBundle.events);
          if (mins != null) { setCard(row,key,{ ...asReady(mins,'direct'), sourcesLabel:'Internal from ESPN history' }); continue; }
        }
      }
      if (key === 'injury' && injuryHtml) {
        const status = parseEspnInjuryStatus(injuryHtml,row.entity);
        if (status) { setCard(row,key,{ ...asReady(status.score,'direct', status.status), sourcesLabel:'ESPN injuries' }); continue; }
      }
      if (key === 'starters') {
        const search = await safeSearch(row,key,`${row.entity} starting lineup expected lineup`);
        const val = /will start|starting lineup|expected lineup|confirmed lineup/i.test(search) ? 100 : (/bench|coming off the bench/i.test(search)?20:null);
        if (val != null) { setCard(row,key,{ ...asReady(val,'search', String(val)), sourcesLabel:'backup search • winner: ddg' }); continue; }
      }
      if (key === 'schedule' && espnBundle?.events?.length) {
        const fatigue = computeScheduleFatigue(espnBundle.events);
        if (fatigue != null) { setCard(row,key,{ ...asReady(fatigue,'direct'), sourcesLabel: scoreboard ? 'NBA CDN scoreboard + ESPN history' : 'ESPN history', evidence:String(fatigue) }); continue; }
      }
      if (key === 'pace') {
        let metric = nbaAdv ? extractTeamMetrics(nbaAdv,row.team) : null;
        if ((!metric || metric.pace == null) && bbrRatings) metric = extractBbrTeamMetrics(bbrRatings,row.team);
        if (metric?.pace != null) { setCard(row,key,{ ...asReady(Math.round(metric.pace), 'direct', String(metric.pace)), sourcesLabel: nbaAdv ? 'NBA stats advanced' : 'Basketball-Reference backup' }); continue; }
      }
      if (key === 'oppdef') {
        let metric = nbaAdv ? extractTeamMetrics(nbaAdv,row.opponent) : null;
        if ((!metric || metric.defRating == null) && bbrRatings) metric = extractBbrTeamMetrics(bbrRatings,row.opponent);
        if (metric?.defRating != null) { setCard(row,key,{ ...asReady(Math.round(metric.defRating), 'direct', String(metric.defRating)), sourcesLabel: nbaAdv ? 'NBA stats advanced' : 'Basketball-Reference backup' }); continue; }
      }
      if (key === 'homeaway' && espnBundle?.events?.length) {
        const gc = scoreboard ? getGameContext(scoreboard,row.team,row.opponent) : null;
        const currentAway = gc ? !gc.isHome : row.isAwayHint;
        if (currentAway !== null && currentAway !== undefined) {
          const score = computeHomeAwaySplitScore(espnBundle.events,currentAway);
          if (score != null) { setCard(row,key,{ ...asReady(score,'direct'), sourcesLabel: gc ? 'ESPN direct + scoreboard' : 'ESPN direct' }); continue; }
        }
      }

      const fallbackPurposeMap = { last5:'last 5 games', last10:'last 10 games', last20:'last 20 games', season:'season averages', career:'career stats per game', minutes:'minutes', schedule:'recent schedule nba', homeaway:'home away splits nba', injury:'injury status', starters:'starting lineup expected lineup', projection:'projection' };
      if (fallbackPurposeMap[key] && row.entity && !/\s{2,}/.test(row.entity)) {
        const text = await safeSearch(row,key,`${row.propFamily} ${fallbackPurposeMap[key]}`);
        const val = bestSearchValue(text, row, key);
        if (val != null) { setCard(row,key,{ ...asReady((Math.round(val*10)/10).toFixed(1),'search'), sourcesLabel:'backup search • winner: ddg' }); continue; }
      }
      setCard(row,key, asFailed('No trusted direct or search source returned usable data.'));
    } catch (err) {
      setCard(row,key,{ status:'failed', statusLabel:'Live probe failed', parsedResult:'Mining failed.', evidence:String(err.message||err) });
    }
  }
}

