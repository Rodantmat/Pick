import { withTimeout, parseMinutesValue, average, canon, jinaUrl } from './utils_core.js';
import { FETCH_TIMEOUT_MS } from './config_core.js';

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

export async function searchEspnAthlete(playerName){
  const q = encodeURIComponent(playerName);
  const url = `https://site.web.api.espn.com/apis/search/v2?query=${q}&limit=5&type=player`;
  const json = await fetchJson(url);
  const results = json.results || [];
  const normalized = canon(playerName);
  const picked = results.find(r => canon(r.displayName||r.name||'') === normalized) || results.find(r => canon(r.displayName||r.name||'').includes(normalized.split(' ')[0]||'')) || results[0];
  return picked ? { id: picked.id, displayName: picked.displayName || picked.name } : null;
}

export async function fetchEspnGameLog(playerName){
  const athlete = await searchEspnAthlete(playerName);
  if (!athlete?.id) throw new Error('ESPN athlete id not found');
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athlete.id}/gamelog`;
  const json = await fetchJson(url, { Referer: 'https://www.espn.com/' });
  const seasonTypes = json.seasonTypes || [];
  const category = seasonTypes?.[0]?.categories?.[0];
  const labels = category?.labels || [];
  const events = category?.events || [];
  return { athleteId: athlete.id, labels, events };
}

function mapEvent(event, labels){
  const stats = event.stats || [];
  const lookup = {};
  labels.forEach((lab, idx)=>{ lookup[String(lab).toUpperCase()] = stats[idx]; });
  const opp = event.opponent || event.team?.displayName || event.displayName || event.name || '';
  const oppline = event.gameLocation || event.opponent || '';
  const isAway = /@/.test(oppline) || String(event.gameLocation||'').toLowerCase()==='away';
  return {
    date: event.gameDate || event.date || event.dateString || '',
    points: Number(lookup.PTS ?? lookup.POINTS ?? NaN),
    rebounds: Number(lookup.REB ?? lookup.TRB ?? NaN),
    assists: Number(lookup.AST ?? NaN),
    threes: Number(lookup['3PM'] ?? lookup.FG3M ?? NaN),
    minutes: parseMinutesValue(lookup.MIN),
    opponent: typeof opp === 'string' ? opp : '',
    isAway
  };
}

export async function fetchEspnStatsBundle(playerName){
  const { labels, events, athleteId } = await fetchEspnGameLog(playerName);
  const mapped = (events || []).map(ev => mapEvent(ev, labels)).filter(ev => ev.date);
  return { athleteId, events: mapped };
}

export function computePropAverage(events, propFamily, n){
  const sliced = (events || []).slice(0, n);
  const vals = sliced.map(ev => {
    switch (propFamily) {
      case 'Points': return ev.points;
      case 'Rebounds': return ev.rebounds;
      case 'Assists': return ev.assists;
      case '3PTM':
      case '3PT Made': return ev.threes;
      case 'PRA': return (ev.points??0)+(ev.rebounds??0)+(ev.assists??0);
      case 'Pts+Rebs': return (ev.points??0)+(ev.rebounds??0);
      case 'Pts+Asts': return (ev.points??0)+(ev.assists??0);
      case 'Rebs+Asts': return (ev.rebounds??0)+(ev.assists??0);
      case 'Fantasy Score': return (ev.points??0)+(ev.rebounds??0)*1.2+(ev.assists??0)*1.5;
      default: return null;
    }
  });
  return average(vals);
}

export function computeHomeAwaySplitScore(events, currentAway){
  const split = (events || []).filter(ev => Boolean(ev.isAway) === Boolean(currentAway));
  const recent = split.slice(0, 10);
  if (!recent.length) return null;
  const avgMin = average(recent.map(ev => ev.minutes));
  if (avgMin == null) return null;
  return Math.round(Math.max(0, Math.min(100, (avgMin / 40) * 100)));
}

export function computeProjectedMinutes(events){
  const mins = (events || []).map(ev => ev.minutes).filter(v => Number.isFinite(v));
  if (!mins.length) return null;
  const l3 = average(mins.slice(0,3)) ?? 0;
  const l5 = average(mins.slice(0,5)) ?? l3;
  const l10 = average(mins.slice(0,10)) ?? l5;
  const season = average(mins) ?? l10;
  const proj = (season*0.10)+(l10*0.20)+(l5*0.30)+(l3*0.40);
  return Math.round(Math.max(0, Math.min(42, proj))*10)/10;
}

export function computeScheduleFatigue(events){
  if (!events?.length) return null;
  const dates = events.map(ev => new Date(ev.date)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a);
  if (dates.length < 2) return 0;
  const now = dates[0];
  const count = dates.filter(d => (now - d) <= 5*24*3600*1000).length;
  return Math.max(0, count-1);
}


export async function fetchEspnCoreStats(playerName){
  const athlete = await searchEspnAthlete(playerName);
  if (!athlete?.id) throw new Error('ESPN athlete id not found');
  const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/types/2/athletes/${athlete.id}/statistics`;
  const json = await fetchJson(url, { 'User-Agent':'Mozilla/5.0', 'Accept':'application/json' });
  const categories = json?.splits?.categories || [];
  const pick = (want) => {
    for (const cat of categories) {
      for (const st of (cat.stats||[])) {
        if (String(st.name||'').toLowerCase() === want.toLowerCase()) return Number(st.value);
      }
    }
    return null;
  };
  return {
    athleteId: athlete.id,
    points: pick('avgPoints'),
    rebounds: pick('avgRebounds'),
    assists: pick('avgAssists'),
    threes: pick('avgThreePointFieldGoalsMade')
  };
}

export function computePropFromTotals(stats, propFamily){
  if (!stats) return null;
  switch (propFamily) {
    case 'Points': return stats.points;
    case 'Rebounds': return stats.rebounds;
    case 'Assists': return stats.assists;
    case '3PTM':
    case '3PT Made': return stats.threes;
    case 'PRA':
    case 'Pts+Rebs+Asts': return (stats.points??0)+(stats.rebounds??0)+(stats.assists??0);
    case 'Pts+Rebs': return (stats.points??0)+(stats.rebounds??0);
    case 'Pts+Asts': return (stats.points??0)+(stats.assists??0);
    case 'Rebs+Asts': return (stats.rebounds??0)+(stats.assists??0);
    default: return null;
  }
}
