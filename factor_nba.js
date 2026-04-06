import { NBA_FACTORS } from './config_core.js';
import { ensureDiagState, upsertDiagEntry, finishDiag, rawPreview } from './diagnostics.js';
import { fetchEspnStatsBundle, computePropAverage, computeProjectedMinutes, computeScheduleFatigue, computeHomeAwaySplitScore } from './connector_espn.js';
import { fetchNbaScoreboard, fetchNbaAdvancedTeamStats, getGameContext, extractTeamMetrics } from './connector_nba.js';
import { fetchEspnInjuries, parseEspnInjuryStatus } from './connector_injuries.js';
import { searchWebOneQuery } from './connector_search.js';
import { average, clampNumber } from './utils_core.js';

function baseCard(spec){
  return { ...spec, status: spec.live ? 'loading':'waiting', statusLabel: spec.live ? 'Loading live probe...' : 'Paused', sourcesLabel: spec.sources.join(' • '), parsedResult:'—', evidence: spec.live ? '—' : spec.note };
}

export function ensureNbaMining(row){
  if (row._miningLoaded) return;
  row.miningStatus = NBA_FACTORS.map(baseCard);
  row._miningLoaded = true;
  mineNbaRow(row).catch(err => console.error(err));
}

function setCard(row, key, patch){
  const card = row.miningStatus.find(c=>c.key===key); if (!card) return;
  Object.assign(card, patch);
}

function asReady(val, provider='direct', evidence=''){
  return { status:'ready', statusLabel: provider==='direct' ? 'Direct source found' : 'Search evidence found', parsedResult: String(val), evidence: evidence || String(val) };
}
function asRaw(evidence, provider='backup search'){ return { status:'waiting', statusLabel:'Trusted raw captured', parsedResult:'Raw data captured.', evidence, sourcesLabel: provider }; }
function asFailed(msg='No trusted source return.'){ return { status:'failed', statusLabel:'Probe failed', parsedResult:'No trusted source return.', evidence: msg }; }

function queryFor(row, purpose){ return `${row.entity} ${purpose} nba`; }

async function safeSearch(row, key, purpose){
  const res = await searchWebOneQuery(queryFor(row, purpose));
  const text = `${res.title} ${res.snippet}`;
  upsertDiagEntry(row, key, { searchQuery: queryFor(row,purpose), rawSearch: rawPreview(text) });
  return text;
}

export async function mineNbaRow(row){
  ensureDiagState(row);
  const liveKeys = NBA_FACTORS.filter(f=>f.live).map(f=>f.key);

  let espnBundle = null, scoreboard = null, nbaAdv = null, injuryHtml = null;
  try { espnBundle = await fetchEspnStatsBundle(row.entity); } catch (e) { upsertDiagEntry(row,'espn',{error:String(e.message||e)}); }
  try { scoreboard = await fetchNbaScoreboard(); } catch (e) { upsertDiagEntry(row,'scoreboard',{error:String(e.message||e)}); }
  try { nbaAdv = await fetchNbaAdvancedTeamStats(); } catch (e) { upsertDiagEntry(row,'nbaAdv',{error:String(e.message||e)}); }
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
      if (['last5','last10','last20','season'].includes(key) && espnBundle?.events?.length) {
        const nMap = { last5:5,last10:10,last20:20,season:espnBundle.events.length };
        const val = computePropAverage(espnBundle.events, row.propFamily, nMap[key]);
        if (val != null) { setCard(row, key, { ...asReady((Math.round(val*10)/10).toFixed(1),'direct'), sourcesLabel:'ESPN direct • backup search' }); continue; }
      }
      if (key === 'career') {
        const text = await safeSearch(row,key,'career stats per game');
        setCard(row,key, asRaw(text,'backup search • winner: ddg'));
        continue;
      }
      if (key === 'projection') {
        if (espnBundle?.events?.length) {
          const l5 = computePropAverage(espnBundle.events,row.propFamily,5) ?? 0;
          const season = computePropAverage(espnBundle.events,row.propFamily,espnBundle.events.length) ?? l5;
          const projection = Math.round((((l5*0.6)+(season*0.4)))*10)/10;
          setCard(row,key,{ ...asReady(projection,'direct'), sourcesLabel:'Internal derived • backup search', note:'Derived from recent history using no-account stable inputs.'});
          continue;
        }
      }
      if (key === 'minutes') {
        if (espnBundle?.events?.length) {
          const mins = computeProjectedMinutes(espnBundle.events);
          if (mins != null) { setCard(row,key,{ ...asReady(mins,'direct'), sourcesLabel:'Internal from ESPN history • backup search' }); continue; }
        }
      }
      if (key === 'injury' && injuryHtml) {
        const status = parseEspnInjuryStatus(injuryHtml,row.entity);
        if (status) { setCard(row,key,{ ...asReady(status.score,'direct', status.status), sourcesLabel:'Official injuries • backup search' }); continue; }
      }
      if (key === 'starters') {
        const search = await safeSearch(row,key,'starting lineup');
        const val = /will start|starting lineup|expected lineup|confirmed lineup/i.test(search) ? 100 : null;
        if (val != null) { setCard(row,key,{ ...asReady(val,'search', String(val)), sourcesLabel:'Official injuries • backup search • winner: ddg' }); continue; }
      }
      if (key === 'schedule' && scoreboard) {
        const gc = getGameContext(scoreboard,row.team,row.opponent);
        if (gc && espnBundle?.events?.length) {
          const fatigue = computeScheduleFatigue(espnBundle.events);
          if (fatigue != null) { setCard(row,key,{ ...asReady(fatigue,'direct'), sourcesLabel:'NBA CDN scoreboard • backup search', evidence:String(fatigue) }); continue; }
        }
      }
      if (key === 'pace' && nbaAdv) {
        const metric = extractTeamMetrics(nbaAdv,row.team);
        if (metric?.pace != null) { setCard(row,key,{ ...asReady(Math.round(metric.pace), 'direct', String(metric.pace)), sourcesLabel:'NBA stats advanced • Basketball-Reference backup' }); continue; }
      }
      if (key === 'oppdef' && nbaAdv) {
        const metric = extractTeamMetrics(nbaAdv,row.opponent);
        if (metric?.defRating != null) { setCard(row,key,{ ...asReady(Math.round(metric.defRating), 'direct', String(metric.defRating)), sourcesLabel:'NBA stats advanced • Basketball-Reference backup' }); continue; }
      }
      if (key === 'homeaway' && espnBundle?.events?.length && scoreboard) {
        const gc = getGameContext(scoreboard,row.team,row.opponent);
        if (gc) {
          const score = computeHomeAwaySplitScore(espnBundle.events,!gc.isHome);
          if (score != null) { setCard(row,key,{ ...asReady(score,'direct'), sourcesLabel:'ESPN direct • backup search' }); continue; }
        }
      }
      // fallback search capture when direct failed
      const fallbackPurposeMap = { last5:'last 5 games', last10:'last 10 games', last20:'last 20 games', season:'season averages', minutes:'minutes', homeaway:'home away splits', schedule:'recent schedule' };
      if (fallbackPurposeMap[key]) {
        const text = await safeSearch(row,key,fallbackPurposeMap[key]);
        setCard(row,key, asRaw(text,'backup search • winner: ddg'));
      } else {
        setCard(row,key, asFailed('No trusted direct source returned usable data.'));
      }
    } catch (err) {
      setCard(row,key,{ status:'failed', statusLabel:'Live probe failed', parsedResult:'Mining failed.', evidence:String(err.message||err) });
    }
  }
}
