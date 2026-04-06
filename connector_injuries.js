import { withTimeout, canon } from './utils_core.js';
import { FETCH_TIMEOUT_MS } from './config_core.js';

async function fetchText(url, headers={}){
  const res = await withTimeout(fetch(url,{headers}), FETCH_TIMEOUT_MS, 'fetch timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function fetchEspnInjuries(){
  return await fetchText('https://www.espn.com/nba/injuries');
}

export function parseEspnInjuryStatus(html, playerName){
  const text = String(html||'').replace(/<[^>]+>/g,' ');
  const p = canon(playerName);
  const ix = canon(text).indexOf(p);
  if (ix < 0) return null;
  const window = text.slice(Math.max(0, ix-80), ix+220);
  if (/out for season|\bout\b/i.test(window)) return { status:'Out', score:0 };
  if (/doubtful/i.test(window)) return { status:'Doubtful', score:10 };
  if (/questionable/i.test(window)) return { status:'Questionable', score:50 };
  if (/probable/i.test(window)) return { status:'Probable', score:90 };
  return { status:'Available', score:100 };
}

export function parseStarterFromSearchEvidence(text=''){
  const t = String(text);
  if (/will start|expected lineup|confirmed lineup|starting lineup/i.test(t)) return 100;
  if (/bench|coming off the bench/i.test(t)) return 20;
  return null;
}
