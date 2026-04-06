import { withTimeout } from './utils_core.js';
import { FETCH_TIMEOUT_MS, TEAM_TRICODES } from './config_core.js';

async function fetchJson(url, headers={}){
  const res = await withTimeout(fetch(url,{headers}), FETCH_TIMEOUT_MS, 'fetch timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
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
