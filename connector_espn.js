import { withTimeout, jinaUrl, parseMinutesValue, average, canon, cleanSnippet } from './utils_core.js';
import { FETCH_TIMEOUT_MS } from './config_core.js';
import { searchAndExtract } from './connector_search.js';

async function fetchJson(url, headers = {}) {
  try {
    const res = await withTimeout(fetch(url, { headers }), FETCH_TIMEOUT_MS, 'fetch timeout');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const proxy = await withTimeout(fetch(jinaUrl(url), { headers: { Accept: 'application/json,text/plain,*/*' } }), FETCH_TIMEOUT_MS + 2000, 'fetch timeout');
    if (!proxy.ok) throw err;
    const text = await proxy.text();
    const start = String(text || '').search(/[\[{]/);
    if (start < 0) throw err;
    return JSON.parse(String(text || '').slice(start));
  }
}
function findAthleteId(searchJson, playerName = '') {
  const wanted = canon(playerName);
  const rows = searchJson?.results || searchJson?.items || [];
  const pick = rows.find((r) => canon(r.displayName || r.name || '') === wanted) || rows.find((r) => canon(r.displayName || r.name || '').includes(wanted.split(' ')[0] || '')) || rows[0];
  return pick ? { id: pick.id, displayName: pick.displayName || pick.name || playerName } : null;
}
function mapEvent(event, labels = []) {
  const stats = event?.stats || [];
  const lookup = {};
  labels.forEach((lab, idx) => { lookup[String(lab || '').toUpperCase()] = stats[idx]; });
  return {
    date: event?.gameDate || event?.date || '',
    opponent: event?.opponent || event?.displayName || '',
    isAway: /@/.test(String(event?.gameLocation || '')) || String(event?.gameLocation || '').toLowerCase() === 'away',
    points: Number(lookup.PTS ?? lookup.POINTS ?? NaN),
    rebounds: Number(lookup.REB ?? lookup.TRB ?? NaN),
    assists: Number(lookup.AST ?? NaN),
    steals: Number(lookup.STL ?? NaN),
    blocks: Number(lookup.BLK ?? NaN),
    turnovers: Number(lookup.TO ?? lookup.TOV ?? NaN),
    threes: Number(lookup['3PM'] ?? lookup.FG3M ?? NaN),
    minutes: parseMinutesValue(lookup.MIN)
  };
}
export async function fetchEspnPlayerBundle(playerName) {
  const searchUrl = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(playerName)}&limit=5&type=player`;
  const searchJson = await fetchJson(searchUrl);
  const athlete = findAthleteId(searchJson, playerName);
  if (!athlete?.id) throw new Error('ESPN athlete id not found');
  const gamelogUrl = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athlete.id}/gamelog`;
  const gamelog = await fetchJson(gamelogUrl, { Referer: 'https://www.espn.com/' });
  const seasonType = (gamelog?.seasonTypes || []).find(Boolean) || {};
  const category = (seasonType?.categories || []).find(Boolean) || {};
  const labels = category?.labels || [];
  const events = (category?.events || []).map((ev) => mapEvent(ev, labels)).filter((ev) => ev.date);
  return { athleteId: athlete.id, displayName: athlete.displayName, events };
}
function propValueFromEvent(event, propFamily = '') {
  switch (propFamily) {
    case 'Points': return event.points;
    case 'Rebounds': return event.rebounds;
    case 'Assists': return event.assists;
    case '3PTM': return event.threes;
    case 'Pts+Rebs': return (event.points ?? 0) + (event.rebounds ?? 0);
    case 'Pts+Asts': return (event.points ?? 0) + (event.assists ?? 0);
    case 'Rebs+Asts': return (event.rebounds ?? 0) + (event.assists ?? 0);
    case 'PRA':
    case 'Pts+Rebs+Asts': return (event.points ?? 0) + (event.rebounds ?? 0) + (event.assists ?? 0);
    case 'Fantasy Score': return (event.points ?? 0) + (event.rebounds ?? 0) * 1.2 + (event.assists ?? 0) * 1.5 + (event.blocks ?? 0) * 3 + (event.steals ?? 0) * 3 - (event.turnovers ?? 0);
    default: return null;
  }
}
export function computeRecentAverage(events = [], propFamily = '', n = 5) { return average((events || []).slice(0, n).map((ev) => propValueFromEvent(ev, propFamily))); }
export function computeSeasonAverage(events = [], propFamily = '') { return average((events || []).map((ev) => propValueFromEvent(ev, propFamily))); }
export function computeUsageLast3(events = []) {
  const last3 = (events || []).slice(0, 3);
  if (!last3.length) return null;
  const approxTouches = average(last3.map((ev) => (ev.points ?? 0) + (ev.assists ?? 0) * 2 + (ev.threes ?? 0) + (ev.turnovers ?? 0)));
  return Number.isFinite(approxTouches) ? Math.round(approxTouches * 10) / 10 : null;
}
export async function fetchEspnInjuryStatus(playerName) {
  const found = await searchAndExtract(`${playerName} ESPN injury status NBA`, { prefer: ['espn'] });
  const blob = cleanSnippet(`${found.result?.title || ''} ${found.result?.snippet || ''} ${found.pageContent || ''}`);
  const c = canon(blob);
  let status = 'Unknown'; let score = 60;
  if (/out for season|\bout\b/.test(c)) { status = 'Out'; score = 0; }
  else if (/doubtful/.test(c)) { status = 'Doubtful'; score = 20; }
  else if (/questionable/.test(c)) { status = 'Questionable'; score = 50; }
  else if (/probable/.test(c)) { status = 'Probable'; score = 85; }
  else if (/available|active|will play|good to go/.test(c)) { status = 'Available'; score = 100; }
  return { status, score, evidence: blob.slice(0, 320), confidence: found.confidence || 55, source: found.result?.href || '' };
}
