const LEAGUES = [
  { id:'nba', label:'NBA', sport:'NBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'wnba', label:'WNBA', sport:'WNBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'cbb', label:'CBB', sport:'CBB', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'nfl', label:'NFL', sport:'NFL', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Rush Attempts','Touchdowns'] },
  { id:'cfb', label:'CFB', sport:'CFB', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Rush Attempts','Touchdowns'] },
  { id:'mlb', label:'MLB', sport:'MLB', propCatalog:['Hits','Total Bases','Pitcher Strikeouts','Runs','RBIs','Outs Recorded','Home Runs','Hits Allowed'] },
  { id:'nhl', label:'NHL', sport:'NHL', propCatalog:['Shots on Goal','Goalie Saves','Points','Assists','Goals','Blocked Shots','Hits'] },
  { id:'soccer', label:'Soccer', sport:'SOCCER', propCatalog:['Goalie Saves','Passes Attempted','Shots Assisted','Attempted Dribbles','Shots On Target','Shots','Tackles Won','Crosses','Clearances','Fouls Committed','Goals','Assists'] },
  { id:'tennis', label:'Tennis', sport:'TENNIS', propCatalog:['Total Games','Break Points Won','Double Faults','Aces','Games Won','Sets Won'] },
  { id:'golf', label:'Golf', sport:'GOLF', propCatalog:['Birdies or Better','Strokes','Pars','Bogeys'] },
  { id:'ufc', label:'UFC / MMA', sport:'UFC', propCatalog:['Significant Strikes','Takedowns','Fight Time'] },
  { id:'nascar', label:'NASCAR', sport:'NASCAR', propCatalog:['Finishing Position','Fastest Laps'] },
  { id:'esports-cs2', label:'Esports CS2', sport:'ESPORTS', propCatalog:['MAP 1 Headshots','MAP 2 Headshots','MAP 3 Headshots','MAP 1 Kills','MAP 2 Kills','MAP 3 Kills','Headshots','Kills','Assists'] },
  { id:'esports-valorant', label:'Esports Valorant', sport:'ESPORTS', propCatalog:['Headshots','Kills','Assists','Maps Won'] },
  { id:'esports-lol', label:'Esports LoL', sport:'ESPORTS', propCatalog:['Kills','Assists','Deaths','CS','Towers'] },
  { id:'esports-dota2', label:'Esports Dota 2', sport:'ESPORTS', propCatalog:['Kills','Assists','Deaths'] }
];

const STORAGE_KEY = 'pickcalc-prompt1-v4-5-0';
const TYPE_META = {
  REGULAR: {icon:'⚪', label:'Regular'},
  GOBLIN: {icon:'🟢', label:'Goblin'},
  DEMON: {icon:'😈', label:'Demon'},
  TACO: {icon:'🌮', label:'Taco'},
  FREE_PICK: {icon:'🎁', label:'Free Pick'}
};

const TENNIS_MINING_FACTORS = [
  { key:'last5', title:'Last 5 matches', live:true, sources:['SofaScore API','Flashscore search'], note:'Recent match log block.' },
  { key:'last10', title:'Last 10 matches', live:true, sources:['SofaScore API','Flashscore search'], note:'Short sample trend block.' },
  { key:'last20', title:'Last 20 matches', live:true, sources:['SofaScore API','Flashscore search'], note:'Larger sample stability block.' },
  { key:'season', title:'Season history', live:true, sources:['ATP/Flashscore web search'], note:'Season-long splits.' },
  { key:'career', title:'Career history', live:true, sources:['ATP/Flashscore web search'], note:'Long-run baseline.' },
  { key:'h2h', title:'Head-to-head', live:true, sources:['Head-to-head web search'], note:'Opponent-specific history.' },
  { key:'surface', title:'Surface split', live:true, sources:['ATP/TennisExplorer web search'], note:'Clay / hard / grass context.' },
  { key:'odds', title:'Market odds', live:true, sources:['Odds web search'], note:'Moneyline / game context.' },
  { key:'projection', title:'Projection source', live:false, sources:['Model / manual projection'], note:'Needed later for 2A math.' },
  { key:'schedule', title:'Schedule / fatigue', live:true, sources:['SofaScore API'], note:'Rest and prior match cadence.' },
  { key:'form', title:'Recent form notes', live:true, sources:['SofaScore API'], note:'Micro trend layer.' },
  { key:'validation', title:'Prop-source validation', live:true, sources:['Ingested row'], note:'Parsed row identity and line are already grounded.' }
];

const state = loadState();
const PROP_LOOKUP = buildPropLookup();

function defaultState() {
  return { dayScope:'Today', selectedLeagueIds:[], cleanedRows:[], lastMessage:'', ran:false, activeRowId:null };
}
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed ? { ...defaultState(), ...parsed } : defaultState();
  } catch {
    return defaultState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const runtimeMiningCache = {};

function cacheKeyForRow(row) {
  return row ? row.rowId : '';
}


function norm(s='') {
  return String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/￼/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function escapeHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function canon(s='') { return norm(s).toLowerCase(); }

function buildPropLookup() {
  const entries = [];
  for (const league of LEAGUES) {
    for (const prop of league.propCatalog) {
      entries.push({ leagueId: league.id, prop, key: canon(prop) });
    }
  }
  entries.sort((a,b)=> b.prop.length - a.prop.length);
  return entries;
}

function findLeague(id){ return LEAGUES.find(x=>x.id===id); }
function selectedLeagues(){ return state.selectedLeagueIds.map(findLeague).filter(Boolean); }

function activeRow() {
  return state.cleanedRows.find(r => r.rowId === state.activeRowId) || state.cleanedRows[0] || null;
}

function displayTeam(row) {
  if (!row) return '';
  return row.leagueId === 'tennis' ? '' : (row.team || '');
}

function render() {
  renderDayScope();
  renderLeagues();
  renderFeedStatus();
  renderRunSummary();
  renderResults();
  renderAnalysis();
  applyScreen();
}

function applyScreen() {
  const analysis = window.location.hash === '#analysis';
  document.getElementById('intakeScreen').classList.toggle('hidden', analysis);
  document.getElementById('analysisScreen').classList.toggle('hidden', !analysis);
}

function renderDayScope() {
  document.querySelectorAll('input[name="dayScope"]').forEach(input => {
    input.checked = input.value === state.dayScope;
    input.onchange = () => { state.dayScope = input.value; saveState(); renderRunSummary(); renderAnalysis(); };
  });
}

function renderLeagues() {
  const wrap = document.getElementById('leagueChecklist');
  wrap.innerHTML = LEAGUES.map(l => `
    <label><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id) ? 'checked':''}> ${escapeHtml(l.label)}</label>
  `).join('');
  wrap.querySelectorAll('input[type="checkbox"]').forEach(el => {
    el.onchange = () => {
      const id = el.dataset.id;
      if (el.checked) {
        if (!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id);
      } else {
        state.selectedLeagueIds = state.selectedLeagueIds.filter(x => x !== id);
      }
      saveState();
      renderFeedStatus();
      renderRunSummary();
    };
  });
}

function getFedPropCounts() {
  const fed = {};
  for (const row of state.cleanedRows) {
    fed[row.leagueId] ||= {};
    fed[row.leagueId][row.propKey] = (fed[row.leagueId][row.propKey] || 0) + 1;
  }
  return fed;
}

function renderFeedStatus() {
  const wrap = document.getElementById('feedStatus');
  const fed = getFedPropCounts();
  if (!state.selectedLeagueIds.length) {
    wrap.innerHTML = '<div class="message">Select at least one league.</div>';
    return;
  }
  wrap.innerHTML = selectedLeagues().map(league => {
    const count = state.cleanedRows.filter(r => r.leagueId === league.id).length;
    const chips = league.propCatalog.map(prop => {
      const key = canon(prop);
      const n = fed[league.id]?.[key] || 0;
      return `<div class="prop-chip ${n > 0 ? 'prop-fed':'prop-missing'}"><span>${n > 0 ? '✅':'❌'}</span><span>${escapeHtml(prop)}</span><small>${n}</small></div>`;
    }).join('');
    return `
      <div class="status-panel">
        <div class="status-panel-head">
          <div><strong>${escapeHtml(league.label)}</strong><div class="mini-muted">${count} clean row${count===1?'':'s'}</div></div>
          <div class="status-badge ${count>0?'status-ok':'status-no'}">${count>0?'FED':'NOT FED'}</div>
        </div>
        <div class="prop-grid">${chips}</div>
      </div>`;
  }).join('');
}

function renderRunSummary() {
  const fedLeagues = new Set(state.cleanedRows.map(r => r.leagueId)).size;
  document.getElementById('runSummary').innerHTML = `
    <div class="pill">Day: ${escapeHtml(state.dayScope)}</div>
    <div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div>
    <div class="pill">Fed leagues: ${fedLeagues}</div>
    <div class="pill">Clean rows: ${state.cleanedRows.length}</div>
  `;
}

function resultsRowsHtml(rows, includeIndex = false) {
  if (!rows.length) return `<tr><td colspan="${includeIndex ? 7 : 6}" class="empty">No clean rows yet.</td></tr>`;
  return rows.map((row, idx) => `
    <tr data-row-id="${escapeHtml(row.rowId)}" class="pick-row ${row.rowId===state.activeRowId?'selected-row':''}">
      ${includeIndex ? `<td>${idx+1}</td>` : ''}
      <td>${escapeHtml(row.sport)}</td>
      <td>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</td>
      <td>${escapeHtml(row.entity)}</td>
      <td>${escapeHtml(displayTeam(row) || '')}</td>
      <td>${escapeHtml(row.lineText)}</td>
      <td class="type-cell">${TYPE_META[row.type]?.icon || '⚪'}</td>
    </tr>`).join('');
}

function bindRowSelection(tbodyId) {
  const body = document.getElementById(tbodyId);
  body.querySelectorAll('tr[data-row-id]').forEach(tr => {
    tr.onclick = () => {
      state.activeRowId = tr.dataset.rowId;
      saveState();
      renderResults();
      renderAnalysis();
    };
  });
}

function renderResults() {
  const body = document.getElementById('resultsBody');
  const msg = document.getElementById('resultsMessage');
  msg.textContent = state.ran ? `${state.cleanedRows.length} clean rows ready.` : 'Run after ingesting to view the clean pool.';
  body.innerHTML = resultsRowsHtml(state.cleanedRows, false);
  bindRowSelection('resultsBody');
}


async function withTimeout(promise, ms, label='timeout') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function proxiedFetchText(url) {
  const tries = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//,'')}`
  ];
  let lastErr = null;
  for (const target of tries) {
    try {
      const res = await withTimeout(fetch(target, { method:'GET' }), 4500, 'fetch timeout');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('fetch failed');
}

async function proxiedFetchJson(url) {
  const txt = await withTimeout(proxiedFetchText(url), 5000, 'json timeout');
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('json parse failed');
  }
}

function cleanSnippet(s='') {
  return String(s).replace(/\s+/g,' ').trim();
}

function tennisNameVariants(name) {
  const base = cleanSnippet(name);
  const parts = base.split(/\s+/).filter(Boolean);
  const variants = new Set([base, canon(base)]);
  if (parts.length >= 2) {
    variants.add(`${parts[0]} ${parts[parts.length-1]}`);
    variants.add(`${parts[0]} ${parts[parts.length-1][0]}.`);
    variants.add(`${parts[parts.length-1]} ${parts[0]}`);
    variants.add(`${parts[parts.length-1]} ${parts[0][0]}.`);
  }
  return [...variants].map(v => cleanSnippet(v)).filter(Boolean);
}

function scoreTennisPlayerCandidate(name, rawName) {
  const cName = canon(name);
  const cRaw = canon(rawName);
  if (!cName || !cRaw) return 0;
  if (cName == cRaw) return 100;
  let score = 0;
  const rawParts = cRaw.split(' ').filter(Boolean);
  const candParts = cName.split(' ').filter(Boolean);
  if (rawParts.length && candParts.length) {
    if (candParts[0] === rawParts[0]) score += 25;
    if (candParts[candParts.length-1] === rawParts[rawParts.length-1]) score += 45;
    if (candParts.some(p => rawParts.includes(p))) score += 15;
  }
  if (cName.includes(cRaw) || cRaw.includes(cName)) score += 20;
  return score;
}

function shortDate(ts) {
  if (!ts) return '';
  try {
    const d = new Date(Number(ts) * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  } catch {
    return '';
  }
}

function flattenSearchResults(obj) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const maybeName = node.name || node.entity?.name || node.title;
    const maybeId = node.id || node.entity?.id;
    const sport = node.sport?.slug || node.entity?.sport?.slug || node.sport || '';
    const type = node.type || node.entity?.type || '';
    if (maybeName && maybeId) out.push({ name: maybeName, id: maybeId, sport: String(sport), type: String(type), raw: node });
    Object.values(node).forEach(walk);
  }
  walk(obj);
  return out;
}

async function ddgSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await withTimeout(proxiedFetchText(url), 5000, 'search timeout');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = [];
  doc.querySelectorAll('.result').forEach((el) => {
    const title = cleanSnippet(el.querySelector('.result__title')?.textContent || el.querySelector('a')?.textContent || '');
    const snippet = cleanSnippet(el.querySelector('.result__snippet')?.textContent || '');
    const href = el.querySelector('a')?.href || '';
    if (title || snippet) results.push({ title, snippet, href });
  });
  return results.slice(0, 5);
}


async function bingSearch(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const html = await withTimeout(proxiedFetchText(url), 7000, 'search timeout');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results = [];
  doc.querySelectorAll('li.b_algo').forEach((el) => {
    const title = cleanSnippet(el.querySelector('h2')?.textContent || el.querySelector('a')?.textContent || '');
    const snippet = cleanSnippet(el.querySelector('.b_caption')?.textContent || el.textContent || '');
    const href = el.querySelector('a')?.href || '';
    if (title || snippet) results.push({ title, snippet, href });
  });
  return results.slice(0, 5);
}

async function multiSearch(query) {
  const providers = [
    { name: 'ddg', fn: ddgSearch },
    { name: 'bing', fn: bingSearch }
  ];
  let lastErr = null;
  for (const p of providers) {
    try {
      const res = await p.fn(query);
      if (res && res.length) return { provider: p.name, results: res };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return { provider: 'none', results: [] };
}

function summarizeSearchMatches(results, count=3) {
  const picked = (results || []).slice(0, count);
  return {
    summary: picked[0]?.title || 'Search result found',
    evidence: picked.map(r => cleanSnippet(r.snippet || r.title)).filter(Boolean).join(' • ')
  };
}

function summarizeEvents(events, n) {
  const items = (events || []).slice(0, n);
  if (!items.length) return { summary:'No recent events parsed.', evidence:'' };
  const lines = items.map(ev => {
    const opp = ev.opponent || 'Unknown';
    const date = ev.date || '';
    const result = ev.result || '';
    return `${date} vs ${opp}${result ? ` (${result})` : ''}`;
  });
  return {
    summary: `${items.length} matches parsed.`,
    evidence: lines.slice(0, 3).join(' • ')
  };
}


function buildRecentFallbackFromSearch(playerName) {
  return [
    `${playerName} recent tennis results`,
    `${playerName} last matches tennis`,
    `${playerName} flashscore tennis results`,
    `${playerName} sofascore tennis results`
  ];
}

function parseSofaEvents(data, playerName) {
  const arr = data?.events || data?.results || data?.data || (Array.isArray(data) ? data : []);
  const pname = canon(playerName);
  const out = [];
  for (const ev of arr) {
    const a = ev.homeTeam?.name || ev.firstTeam?.name || ev.player1?.name || ev.home?.name || '';
    const b = ev.awayTeam?.name || ev.secondTeam?.name || ev.player2?.name || ev.away?.name || '';
    let opponent = '';
    if (canon(a) === pname) opponent = b;
    else if (canon(b) === pname) opponent = a;
    else opponent = b || a || '';
    const homeScore = ev.homeScore?.current ?? ev.homeScore?.display ?? ev.homeScore ?? '';
    const awayScore = ev.awayScore?.current ?? ev.awayScore?.display ?? ev.awayScore ?? '';
    const firstScore = ev.firstScore?.current ?? ev.firstScore ?? '';
    const secondScore = ev.secondScore?.current ?? ev.secondScore ?? '';
    let result = '';
    if (homeScore !== '' || awayScore !== '') result = `${homeScore}-${awayScore}`;
    else if (firstScore !== '' || secondScore !== '') result = `${firstScore}-${secondScore}`;
    out.push({
      date: shortDate(ev.startTimestamp || ev.startTimeTimestamp || ev.startDateTimestamp),
      opponent: cleanSnippet(opponent),
      result: cleanSnippet(result),
      ts: Number(ev.startTimestamp || ev.startTimeTimestamp || 0)
    });
  }
  return out.filter(x => x.opponent || x.date || x.result).sort((a,b) => (b.ts||0)-(a.ts||0));
}

async function mineTennisRow(row) {
  const result = {};
  TENNIS_MINING_FACTORS.forEach(f => {
    result[f.key] = {
      ...f,
      status: f.key === 'validation' ? 'ready' : (f.live ? 'loading' : 'waiting'),
      statusLabel: f.key === 'validation' ? 'Parsed from ingested row' : (f.live ? 'Loading live probe...' : 'Source wiring next'),
      sourcesLabel: f.sources.join(' • '),
      parsedResult: f.key === 'validation' ? `${row.entity} • ${row.propFamily} ${row.line}` : '',
      evidence: f.key === 'validation' ? 'Parsed from ingested row' : ''
    };
  });

  let playerEvents = [];
  let playerFound = null;
  let playerSearchReason = '';

  try {
    const searchUrl = `https://api.sofascore.com/api/v1/search/all/${encodeURIComponent(row.entity)}`;
    const searchData = await withTimeout(proxiedFetchJson(searchUrl), 5500, 'json timeout');
    const variants = tennisNameVariants(row.entity);
    const items = flattenSearchResults(searchData)
      .map(x => ({...x, matchScore: Math.max(...variants.map(v => scoreTennisPlayerCandidate(x.name, v)))}))
      .filter(x => (String(x.sport).includes('tennis') || String(x.type).includes('player')))
      .sort((a,b) => (b.matchScore||0) - (a.matchScore||0));
    playerFound = items.find(x => (x.matchScore||0) >= 45) || items[0] || null;

    if (!playerFound?.id) {
      playerSearchReason = 'No player match found.';
    } else {
      const candidates = [
        `https://api.sofascore.com/api/v1/player/${playerFound.id}/events/last/0`,
        `https://api.sofascore.com/api/v1/player/${playerFound.id}/events/last/20`
      ];
      for (const url of candidates) {
        try {
          const eventsData = await withTimeout(proxiedFetchJson(url), 5500, 'json timeout');
          playerEvents = parseSofaEvents(eventsData, row.entity);
          if (playerEvents.length) break;
        } catch {}
      }
      if (!playerEvents.length) playerSearchReason = `No usable recent events returned${playerFound?.name ? ` for ${playerFound.name}` : ''}.`;
    }
  } catch (err) {
    playerSearchReason = String(err && err.message || err);
  }

  if (playerEvents.length) {
    const s5 = summarizeEvents(playerEvents, 5);
    const s10 = summarizeEvents(playerEvents, 10);
    const s20 = summarizeEvents(playerEvents, 20);
    result.last5 = { ...result.last5, status:'ready', statusLabel:'Live data found', parsedResult:s5.summary, evidence:s5.evidence };
    result.last10 = { ...result.last10, status:'ready', statusLabel:'Live data found', parsedResult:s10.summary, evidence:s10.evidence };
    result.last20 = { ...result.last20, status:'ready', statusLabel:'Live data found', parsedResult:s20.summary, evidence:s20.evidence };
    const dates = playerEvents.slice(0,4).map(x => x.date).filter(Boolean);
    result.schedule = { ...result.schedule, status:'ready', statusLabel:'Live data found', parsedResult:`Recent dates parsed: ${dates.length}`, evidence: dates.join(' • ') || 'Recent event dates parsed.' };
    result.form = { ...result.form, status:'ready', statusLabel:'Live data found', parsedResult:'Recent match sequence parsed', evidence: playerEvents.slice(0,3).map(x => `${x.date} vs ${x.opponent}`).join(' • ') };
  } else {
    // fallback search-based recent history
    let recentSearchResults = [];
    let recentProvider = '';
    for (const q of buildRecentFallbackFromSearch(row.entity)) {
      try {
        const searched = await withTimeout(multiSearch(q), 7000, 'recent search timeout');
        if (searched.results.length) {
          recentSearchResults = searched.results;
          recentProvider = searched.provider;
          break;
        }
      } catch {}
    }
    if (recentSearchResults.length) {
      const snap = summarizeSearchMatches(recentSearchResults, 3);
      ['last5','last10','last20'].forEach((k, idx) => {
        result[k] = {
          ...result[k],
          status:'ready',
          statusLabel:'Search evidence found',
          parsedResult: idx === 0 ? 'Search-based recent history found' : idx === 1 ? 'Search-based short history found' : 'Search-based larger history found',
          evidence: snap.evidence || snap.summary
        };
      });
      result.schedule = {
        ...result.schedule,
        status:'ready',
        statusLabel:'Search evidence found',
        parsedResult:'Recent match timing evidence found',
        evidence: snap.evidence || snap.summary
      };
      result.form = {
        ...result.form,
        status:'ready',
        statusLabel:'Search evidence found',
        parsedResult:'Recent form evidence found',
        evidence: snap.evidence || snap.summary
      };
    } else {
      ['last5','last10','last20','schedule','form'].forEach(k => {
        result[k] = {
          ...result[k],
          status:'failed',
          statusLabel:'Probe failed',
          parsedResult:'No structured recent-match feed parsed.',
          evidence: playerSearchReason || 'Live probe failed.'
        };
      });
    }
  }

  const searches = [
    ['h2h', `${row.entity} ${row.opponent} head to head tennis`],
    ['surface', `${row.entity} tennis surface record`],
    ['season', `${row.entity} tennis season stats`],
    ['career', `${row.entity} ATP profile career win loss`],
    ['odds', `${row.entity} ${row.opponent} odds tennis`]
  ];
  for (const [key, query] of searches) {
    try {
      const searched = await withTimeout(multiSearch(query), 8000, `${key} timeout`);
      const res = searched.results;
      if (res.length) {
        const snap = summarizeSearchMatches(res, 2);
        result[key] = {
          ...result[key],
          status:'ready',
          statusLabel:'Search evidence found',
          parsedResult: snap.summary,
          evidence: snap.evidence || `Provider: ${searched.provider}`
        };
      } else {
        result[key] = { ...result[key], status:'failed', statusLabel:'Probe failed', parsedResult:'No search evidence found.', evidence:'No usable snippets returned.' };
      }
    } catch (err) {
      result[key] = { ...result[key], status:'failed', statusLabel:'Probe failed', parsedResult:'Search request failed.', evidence:String(err && err.message || err) };
    }
  }

  return result;
}

async function ensureTennisMining(row) {
  if (!row || row.leagueId !== 'tennis') return;
  const key = cacheKeyForRow(row);
  const existing = runtimeMiningCache[key];
  if (existing && (existing.status === 'done' || existing.status === 'loading')) return;

  runtimeMiningCache[key] = { status:'loading', cards: TENNIS_MINING_FACTORS.map(f => ({
    ...f,
    status: f.key === 'validation' ? 'ready' : (f.live ? 'loading' : 'waiting'),
    statusLabel: f.key === 'validation' ? 'Parsed from ingested row' : (f.live ? 'Loading live probe...' : 'Source wiring next'),
    sourcesLabel: f.sources.join(' • '),
    parsedResult: f.key === 'validation' ? `${row.entity} • ${row.propFamily} ${row.line}` : '',
    evidence: f.key === 'validation' ? 'Parsed from ingested row' : ''
  })) };
  renderAnalysis();

  try {
    const mined = await mineTennisRow(row);
    runtimeMiningCache[key] = { status:'done', cards: TENNIS_MINING_FACTORS.map(f => mined[f.key] || f) };
  } catch (err) {
    runtimeMiningCache[key] = { status:'done', cards: TENNIS_MINING_FACTORS.map(f => ({
      ...f,
      status: f.key === 'validation' ? 'ready' : 'failed',
      statusLabel: f.key === 'validation' ? 'Parsed from ingested row' : 'Live probe failed',
      sourcesLabel: f.sources.join(' • '),
      parsedResult: f.key === 'validation' ? `${row.entity} • ${row.propFamily} ${row.line}` : 'Mining failed.',
      evidence: f.key === 'validation' ? 'Parsed from ingested row' : String(err && err.message || err)
    })) };
  }
  renderAnalysis();
}

function buildMiningStatus(row) {
  if (!row || row.leagueId !== 'tennis') return [];
  const key = cacheKeyForRow(row);
  const cached = runtimeMiningCache[key];
  if (cached?.cards?.length) return cached.cards;
  return TENNIS_MINING_FACTORS.map(f => ({
    ...f,
    status: f.key === 'validation' ? 'ready' : (f.live ? 'loading' : 'waiting'),
    statusLabel: f.key === 'validation' ? 'Parsed from ingested row' : (f.live ? 'Loading live probe...' : 'Source wiring next'),
    sourcesLabel: f.sources.join(' • '),
    parsedResult: f.key === 'validation' ? `${row.entity} • ${row.propFamily} ${row.line}` : '',
    evidence: f.key === 'validation' ? 'Parsed from ingested row' : ''
  }));
}

function renderAnalysis() {
  const row = activeRow();
  const summary = document.getElementById('analysisSummary');
  const hint = document.getElementById('analysisHint');
  const rowCard = document.getElementById('analysisRowCard');
  const miningGrid = document.getElementById('miningGrid');
  const analysisBody = document.getElementById('analysisResultsBody');

  summary.innerHTML = `
    <div class="pill">Day: ${escapeHtml(state.dayScope)}</div>
    <div class="pill">Rows in pool: ${state.cleanedRows.length}</div>
    <div class="pill">Selected row: ${row ? escapeHtml(row.entity) : 'None'}</div>
    <div class="pill">League: ${row ? escapeHtml(findLeague(row.leagueId)?.label || row.leagueId) : 'None'}</div>
  `;

  if (!row) {
    hint.textContent = 'Ingest at least one row, then hit Run.';
    rowCard.innerHTML = '<div class="message">No row selected yet.</div>';
    miningGrid.innerHTML = '<div class="message">No data-mining matrix yet.</div>';
  } else if (row.leagueId !== 'tennis') {
    hint.textContent = 'Tennis-first debug screen is wired. Your selected row parsed correctly, but live factor cards are only scaffolded for tennis right now.';
    rowCard.innerHTML = rowCardHtml(row);
    miningGrid.innerHTML = '<div class="message">Select or ingest a tennis row to see the factor matrix.</div>';
  } else {
    hint.textContent = 'Tennis live mining is now wired in debug mode. Some factors may succeed, others may fail, depending on source availability.';
    rowCard.innerHTML = rowCardHtml(row);
    ensureTennisMining(row);
    miningGrid.innerHTML = buildMiningStatus(row).map(card => `
      <div class="mining-card">
        <h3>${escapeHtml(card.title)}</h3>
        <div class="mining-status ${card.status}">${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${escapeHtml(card.statusLabel)}</div>
        <div class="mining-meta"><b>Sources:</b> ${escapeHtml(card.sourcesLabel)}</div>
        <div class="mining-meta"><b>Purpose:</b> ${escapeHtml(card.note)}</div>
        <div class="mining-meta"><b>Parsed result:</b> ${escapeHtml(card.parsedResult || '—')}</div>
        <div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence || '—')}</div>
      </div>`).join('');
  }

  analysisBody.innerHTML = resultsRowsHtml(state.cleanedRows, true);
  bindRowSelection('analysisResultsBody');
}


function buildAnalysisCopyText(row) {
  const matrix = buildMiningStatus(row);
  const lines = [
    'Run Analysis',
    `Version: v4.5.0`,
    `Day: ${state.dayScope}`,
    `Rows in pool: ${state.cleanedRows.length}`,
    `Selected row: ${row ? row.entity : 'None'}`,
    `League: ${row ? (findLeague(row.leagueId)?.label || row.leagueId) : 'None'}`,
    '',
    'Selected Test Row',
    `SPORT\n${row ? row.sport : ''}`,
    `LEAGUE\n${row ? (findLeague(row.leagueId)?.label || row.leagueId) : ''}`,
    `PLAYER / ENTITY\n${row ? row.entity : ''}`,
    `TEAM\n${row ? displayTeam(row) : ''}`,
    `OPPONENT\n${row ? (row.opponent || '') : ''}`,
    `PROP\n${row ? row.propFamily : ''}`,
    `LINE\n${row ? row.line : ''}`,
    `TYPE\n${row ? ((TYPE_META[row.type]?.icon || '⚪') + ' ' + (TYPE_META[row.type]?.label || row.type)) : ''}`,
    `RAW PARSE\n${row ? row.lineText : ''}`,
    '',
    'Tennis Data-Mining Matrix'
  ];
  if (matrix.length) {
    for (const card of matrix) {
      lines.push(
        card.title,
        `${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${card.statusLabel}`,
        `Sources: ${card.sourcesLabel}`,
        `Purpose: ${card.note}`,
        `Parsed result: ${card.parsedResult || '—'}`,
        `Evidence: ${card.evidence || '—'}`,
        ''
      );
    }
  }
  return lines.join('\n');
}


function rowCardHtml(row) {
  return `
    <div class="row-card">
      <div class="cell"><strong>Sport</strong>${escapeHtml(row.sport)}</div>
      <div class="cell"><strong>League</strong>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</div>
      <div class="cell"><strong>Player / Entity</strong>${escapeHtml(row.entity)}</div>
      <div class="cell"><strong>Team</strong>${escapeHtml(displayTeam(row) || '—')}</div>
      <div class="cell"><strong>Opponent</strong>${escapeHtml(row.opponent || '—')}</div>
      <div class="cell"><strong>Prop</strong>${escapeHtml(row.propFamily)}</div>
      <div class="cell"><strong>Line</strong>${escapeHtml(row.line || '—')}</div>
      <div class="cell"><strong>Type</strong>${TYPE_META[row.type]?.icon || '⚪'} ${escapeHtml(TYPE_META[row.type]?.label || row.type)}</div>
      <div class="cell"><strong>Raw Parse</strong>${escapeHtml(row.lineText)}</div>
    </div>`;
}


function normalizePhoneTennisBlock(text) {
  const lines = text.replace(/\r/g,'').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 6 && / - Player$/i.test(lines[1] || '')) {
    const top = norm(lines[0]);
    const card = norm((lines[1] || '').replace(/\s*-\s*Player\s*$/i,''));
    if (top && card && canon(top) === canon(card)) {
      lines.shift();
    }
  }
  return lines.join('\n');
}

function parsePhoneTennisBlock(block, selectedIds) {
  if (!selectedIds.includes('tennis')) return null;
  const normalized = normalizePhoneTennisBlock(block);
  const lines = normalized.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 6) return null;
  if (!/ - Player$/i.test(lines[0])) return null;

  const entity = norm(lines[1] || lines[0].replace(/\s*-\s*Player\s*$/i,''));
  const oppLine = norm(lines[2] || '');
  const lineNum = (lines[3] || '').match(/(\d+(?:\.\d+)?)/)?.[1] || '';
  const prop = norm(lines[4] || '');
  if (!entity || !oppLine || !lineNum || !prop) return null;
  if (!/\b(vs|@)\b/i.test(oppLine)) return null;

  const opp = oppLine.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  const opponent = opp ? norm(opp[1]) : '';

  return makeRow({
    entity,
    team: '',
    opponent,
    prop,
    line: lineNum,
    leagueId: 'tennis',
    type: detectType(block),
    raw: normalized
  });
}


function detectType(text) {
  const t = canon(text);
  if (/free[ _]?pick/.test(t)) return 'FREE_PICK';
  if (t.includes('taco')) return 'TACO';
  if (t.includes('demon')) return 'DEMON';
  if (t.includes('goblin')) return 'GOBLIN';
  return 'REGULAR';
}

function findPropCandidates(text, selectedIds) {
  const hay = canon(text);
  const allowed = new Set(selectedIds);
  const matches = [];
  for (const entry of PROP_LOOKUP) {
    if (!allowed.has(entry.leagueId)) continue;
    const idx = hay.indexOf(entry.key);
    if (idx >= 0) matches.push({ ...entry, idx });
  }
  matches.sort((a,b) => b.prop.length - a.prop.length || b.idx - a.idx);
  return matches;
}

function inferLeagueFromProp(prop, block, selectedIds) {
  const candidates = PROP_LOOKUP.filter(x => x.key === canon(prop) && selectedIds.includes(x.leagueId));
  if (candidates.length === 1) return candidates[0].leagueId;
  const low = canon(block);
  if (prop.includes('MAP')) return selectedIds.includes('esports-cs2') ? 'esports-cs2' : candidates[0]?.leagueId;
  if (['Total Games','Double Faults','Break Points Won','Aces','Games Won','Sets Won'].includes(prop)) return selectedIds.includes('tennis') ? 'tennis' : candidates[0]?.leagueId;
  if (['Goalie Saves','Passes Attempted','Shots Assisted','Attempted Dribbles','Shots','Shots On Target'].includes(prop)) return selectedIds.includes('soccer') ? 'soccer' : candidates[0]?.leagueId;
  if (['Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Points','Rebounds','Assists','3PT Made','Blocks','Steals'].includes(prop)) {
    if (selectedIds.includes('nba')) return 'nba';
    if (selectedIds.includes('wnba')) return 'wnba';
    if (selectedIds.includes('cbb')) return 'cbb';
  }
  if (/\bmap\b|headshots|kills/.test(low) && selectedIds.includes('esports-cs2')) return 'esports-cs2';
  return candidates[0]?.leagueId || null;
}

function parseDesktopLine(line, selectedIds) {
  const cols = line.split(/\t+/).map(norm).filter(Boolean);
  if (cols.length < 3) return null;
  const raw = cols.join(' ');
  const propMatch = findPropCandidates(raw, selectedIds)[0];
  if (!propMatch) return null;
  const prop = propMatch.prop;
  const leagueId = inferLeagueFromProp(prop, raw, selectedIds);
  if (!leagueId) return null;
  const low = raw.toLowerCase();
  const propIdx = low.lastIndexOf(prop.toLowerCase());
  const beforeProp = raw.slice(0, propIdx).trim();
  const lineNum = (beforeProp.match(/(\d+(?:\.\d+)?)\s*$/) || [])[1] || '';
  const team = (cols[1].split(' - ')[0] || '').trim();
  const entity = cols[0].replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig,'').trim();
  const oppMatch = raw.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  const opponent = oppMatch ? norm(oppMatch[1]) : '';
  return makeRow({ entity, team, opponent, prop, line: lineNum, leagueId, type: detectType(raw), raw });
}

function splitIntoBlocks(text) {
  let cleaned = text
    .replace(/\r/g,'')
    .replace(/[•●▪]/g,' ')
    .replace(/Trending\s+\d+(?:\.\d+)?K/gi,' ')
    .replace(/\b\d+(?:\.\d+)?K\b/g,' ')
    .replace(/\n{3,}/g,'\n\n');
  const lines = cleaned.split('\n').map(x => x.trim()).filter(Boolean);
  const blocks = [];
  let current = [];
  const flush = () => { if (current.length) { blocks.push(current.join(' ').trim()); current = []; } };
  for (const line of lines) {
    current.push(line);
    if (/(?:\bLess\b\s*\bMore\b|\bMore\b\s*\bLess\b|\bMore\b|\bLess\b)$/i.test(line)) flush();
  }
  flush();
  return blocks.filter(Boolean);
}

function parseBlock(block, selectedIds) {
  const tennisRow = parsePhoneTennisBlock(block, selectedIds);
  if (tennisRow) return tennisRow;
  const raw = norm(block);
  const propMatch = findPropCandidates(raw, selectedIds)[0];
  if (!propMatch) return null;
  const prop = propMatch.prop;
  const leagueId = inferLeagueFromProp(prop, raw, selectedIds);
  if (!leagueId) return null;

  const low = raw.toLowerCase();
  const propIdx = low.lastIndexOf(prop.toLowerCase());
  const beforeProp = raw.slice(0, propIdx).trim();
  const lineNum = (beforeProp.match(/(\d+(?:\.\d+)?)\s*$/) || [])[1] || '';

  let entity = '';
  let team = '';
  let opponent = '';

  const teamRoleName = raw.match(/([A-Za-z0-9'().&\- ]+)\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|Guard|Center|F|G|C|F-G|G-F|F-C|C-F|G-C)\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
  if (teamRoleName) {
    team = norm(teamRoleName[1]);
    entity = norm(teamRoleName[2]);
  }

  if (!entity) {
    const abbrThenName = raw.match(/\b([A-Z]{2,4})\s-\s[A-Z-]+\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
    if (abbrThenName) {
      team = norm(abbrThenName[1]);
      entity = norm(abbrThenName[2]);
    }
  }

  if (!entity) {
    const namedRole = raw.match(/([A-Za-z0-9'().&\- ]+?)\s+(?:Goblin|Demon|Taco|Free Pick)?\s*([A-Za-z0-9'().&\- ]+)\s-\sPlayer\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
    if (namedRole) entity = norm(namedRole[3] || namedRole[1]);
  }

  if (!entity) {
    const simpleVs = raw.match(/([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s+[A-Za-z0-9'().&\- ]+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d+m)/i);
    if (simpleVs) entity = norm(simpleVs[1].replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig,''));
  }

  if (!entity) {
    const words = raw.split(/\s+/).slice(0,5).join(' ');
    entity = words.replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig,'').trim();
  }

  if (!team) {
    const teamFirst = raw.match(/^([A-Za-z0-9'().&\- ]+)\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|F|G|C|F-G|G-F|F-C|C-F|G-C)\b/i);
    if (teamFirst) team = norm(teamFirst[1]);
  }
  const oppMatch = raw.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  if (oppMatch) opponent = norm(oppMatch[1]);

  return makeRow({ entity, team, opponent, prop, line: lineNum, leagueId, type: detectType(raw), raw });
}

function makeRow({ entity, team, opponent='', prop, line, leagueId, type, raw }) {
  const sport = findLeague(leagueId)?.sport || '';
  const lineText = `${prop} ${line}`.trim();
  return {
    rowId: `${leagueId}|${canon(entity)}|${canon(team)}|${canon(prop)}|${line}|${type}`,
    sport,
    leagueId,
    entity: norm(entity),
    team: norm(team),
    opponent: norm(opponent),
    propFamily: prop,
    propKey: canon(prop),
    line,
    lineText,
    type,
    rawText: raw
  };
}

function ingestText(text) {
  const selectedIds = [...state.selectedLeagueIds];
  if (!selectedIds.length) return { added:0, message:'Select at least one league first.' };
  const found = [];

  const lines = text.replace(/\r/g,'').split('\n');
  for (const line of lines) {
    if (line.includes('\t')) {
      const row = parseDesktopLine(line, selectedIds);
      if (row) found.push(row);
    }
  }

  const nonTabText = lines.filter(x => !x.includes('\t')).join('\n');
  const blocks = splitIntoBlocks(nonTabText);
  for (const block of blocks) {
    const row = parseBlock(block, selectedIds);
    if (row) found.push(row);
  }

  const existing = new Map(state.cleanedRows.map(r => [r.rowId, r]));
  let added = 0;
  for (const row of found) {
    if (!existing.has(row.rowId)) {
      existing.set(row.rowId, row);
      added += 1;
    }
  }
  state.cleanedRows = [...existing.values()];
  state.cleanedRows.sort((a,b) => a.sport.localeCompare(b.sport) || a.leagueId.localeCompare(b.leagueId) || a.entity.localeCompare(b.entity) || a.lineText.localeCompare(b.lineText));
  if (!state.activeRowId && state.cleanedRows.length) state.activeRowId = state.cleanedRows[0].rowId;
  saveState();

  if (!added) {
    return { added:0, message:'No recognizable rows found for the leagues you selected. Try one clean chunk from one board section, or check that the right league is selected.' };
  }
  return { added, message:`Ingested ${added} clean row${added===1?'':'s'}.` };
}

function bindActions() {
  document.getElementById('clearBoxBtn').onclick = () => { document.getElementById('boardInput').value = ''; };
  document.getElementById('resetAllBtn').onclick = () => {
    const keepDay = state.dayScope;
    Object.assign(state, defaultState());
    state.dayScope = keepDay;
    saveState();
    document.getElementById('boardInput').value = '';
    document.getElementById('ingestMessage').textContent = 'Reset done.';
    window.location.hash = '#intake';
    render();
  };
  document.getElementById('ingestBtn').onclick = () => {
    const text = document.getElementById('boardInput').value;
    const res = ingestText(text);
    document.getElementById('ingestMessage').textContent = res.message;
    render();
  };
  document.getElementById('runBtn').onclick = () => {
    state.ran = true;
    if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId;
    saveState();
    window.location.hash = '#analysis';
    render();
  };
  document.getElementById('backBtn').onclick = () => {
    window.location.hash = '#intake';
    render();
  };
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const row = activeRow();
      try {
        await navigator.clipboard.writeText(buildAnalysisCopyText(row));
        document.getElementById('analysisHint').textContent = 'Copied.';
      } catch {
        document.getElementById('analysisHint').textContent = 'Copy failed.';
      }
    };
  }
  window.addEventListener('hashchange', applyScreen);
}

render();
bindActions();
