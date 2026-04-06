import { withTimeout, jinaUrl } from './utils_core.js';
import { FETCH_TIMEOUT_MS, TEAM_TRICODES } from './config_core.js';

async function fetchJson(url, headers={}){
  try {
    const res = await withTimeout(fetch(url,{headers}), FETCH_TIMEOUT_MS, 'fetch timeout');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const proxy = await withTimeout(fetch(jinaUrl(url), { headers:{ 'Accept':'application/json,text/plain,*/*' } }), FETCH_TIMEOUT_MS + 1500, 'fetch timeout');
    if (!proxy.ok) throw err;
    const text = await proxy.text();
    const clean = String(text||'').trim();
    const start = clean.search(/[\[{]/);
    if (start < 0) throw err;
    return JSON.parse(clean.slice(start));
  }
}

export async function fetchNbaScoreboard(){
  const url = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
  return await fetchJson(url, { Origin:'https://www.nba.com', Referer:'https://www.nba.com/' });
}

export async function fetchNbaAdvancedTeamStats(){
  const url = 'https://stats.nba.com/stats/leaguedashteamstats?MeasureType=Advanced&PerMode=PerGame&Season=2025-26&SeasonType=Regular+Season';
  return await fetchJson(url, {
    Host: 'stats.nba.com',
    Connection: 'keep-alive',
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    Origin: 'https://www.nba.com',
    Referer: 'https://www.nba.com/',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9'
  });
}

export function getGameContext(scoreboard, team, opponent){
  const games = scoreboard?.scoreboard?.games || [];
  const game = games.find(g => (g.homeTeam?.teamTricode===team || g.awayTeam?.teamTricode===team) && (g.homeTeam?.teamTricode===opponent || g.awayTeam?.teamTricode===opponent));
  if (!game) return null;
  const isHome = game.homeTeam?.teamTricode === team;
  return { isHome, opponent: isHome ? game.awayTeam?.teamTricode : game.homeTeam?.teamTricode, gameTime: game.gameEt, status: game.gameStatusText || '' };
}

export function extractTeamMetrics(json, teamTricode){
  const rs = json?.resultSets?.[0];
  const rows = rs?.rowSet || [];
  const headers = rs?.headers || [];
  const idxTeam = headers.findIndex(h => String(h).toUpperCase()==='TEAM_NAME');
  const idxPace = headers.findIndex(h => String(h).toUpperCase()==='PACE');
  const idxDef = headers.findIndex(h => String(h).toUpperCase()==='DEF_RATING');
  const full = TEAM_TRICODES[teamTricode] || teamTricode;
  const row = rows.find(r => String(r[idxTeam]||'').toLowerCase() === full.toLowerCase());
  if (!row) return null;
  return { pace: Number(row[idxPace]), defRating: Number(row[idxDef]) };
}


export async function fetchBbrRatings(){
  const url = 'https://www.basketball-reference.com/leagues/NBA_2026_ratings.html';
  try {
    const res = await withTimeout(fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}}), FETCH_TIMEOUT_MS, 'fetch timeout');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    const res = await withTimeout(fetch(jinaUrl(url)), FETCH_TIMEOUT_MS + 1500, 'fetch timeout');
    if (!res.ok) throw err;
    return await res.text();
  }
}

export function extractBbrTeamMetrics(html, teamTricode){
  const full = TEAM_TRICODES[teamTricode] || teamTricode;
  const body = String(html||'');
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  for (const row of rows) {
    if (!new RegExp(full.replace(/ /g,'\s+'),'i').test(row)) continue;
    const tds = [...row.matchAll(/<td[^>]*data-stat="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi)];
    const obj = Object.fromEntries(tds.map(m=>[m[1], m[2].replace(/<[^>]+>/g,'').trim()]));
    const pace = Number(obj.pace);
    const defRating = Number(obj.def_rtg);
    return { pace: Number.isFinite(pace)?pace:null, defRating: Number.isFinite(defRating)?defRating:null };
  }
  return null;
}
