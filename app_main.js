import { VERSION, LEAGUES, STORAGE_KEY, TYPE_META } from './config_core.js';
import { escapeHtml } from './utils_core.js';
import { ingestText } from './parser_intake.js';
import { ensureNbaMining } from './factor_nba.js';

function defaultState() {
  return { dayScope:'Today', selectedLeagueIds:[], cleanedRows:[], lastMessage:'', ran:false, activeRowId:null };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return defaultState();
    return {
      dayScope: typeof raw.dayScope === 'string' ? raw.dayScope : 'Today',
      selectedLeagueIds: Array.isArray(raw.selectedLeagueIds) ? raw.selectedLeagueIds.filter(id => LEAGUES.some(l => l.id === id)) : [],
      cleanedRows: Array.isArray(raw.cleanedRows) ? raw.cleanedRows : [],
      lastMessage: typeof raw.lastMessage === 'string' ? raw.lastMessage : '',
      ran: !!raw.ran,
      activeRowId: typeof raw.activeRowId === 'string' ? raw.activeRowId : null
    };
  } catch {
    return defaultState();
  }
}

const state = loadState();
if (!state.selectedLeagueIds.length) state.selectedLeagueIds = [];

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function findLeague(id){ return LEAGUES.find(x=>x.id===id); }
function selectedLeagues(){ return state.selectedLeagueIds.map(findLeague).filter(Boolean); }
function activeRow(){ return state.cleanedRows.find(r=>r.rowId===state.activeRowId) || state.cleanedRows[0] || null; }
function displayTeam(row){ return row?.leagueId === 'tennis' ? '' : (row?.team || ''); }
function miningCards(row){ return Array.isArray(row?.miningStatus) ? row.miningStatus : []; }
function requestRender(){ safeRenderAll(); }

function applyScreen(){
  const analysis = window.location.hash === '#analysis';
  const intake = document.getElementById('intakeScreen');
  const analysisScreen = document.getElementById('analysisScreen');
  if (intake) intake.classList.toggle('hidden', analysis);
  if (analysisScreen) analysisScreen.classList.toggle('hidden', !analysis);
}

function renderDayScope(){
  document.querySelectorAll('input[name="dayScope"]').forEach(input => {
    input.checked = input.value === state.dayScope;
  });
}

function renderLeagues(){
  const wrap = document.getElementById('leagueChecklist');
  if (!wrap) return;
  wrap.innerHTML = LEAGUES.map(l => `
    <label><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id) ? 'checked':''}> ${escapeHtml(l.label)}</label>
  `).join('');
}

function renderFeedStatus(){
  const wrap = document.getElementById('feedStatus');
  if (!wrap) return;
  const fed = {};
  for (const row of state.cleanedRows) {
    fed[row.leagueId] ||= {};
    fed[row.leagueId][row.propKey] = (fed[row.leagueId][row.propKey] || 0) + 1;
  }
  if (!state.selectedLeagueIds.length) {
    wrap.innerHTML = '<div class="message">Select at least one league.</div>';
    return;
  }
  wrap.innerHTML = selectedLeagues().map(league => {
    const count = state.cleanedRows.filter(r => r.leagueId === league.id).length;
    const chips = league.propCatalog.map(prop => {
      const key = prop.toLowerCase();
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

function renderRunSummary(){
  const el = document.getElementById('runSummary');
  if (!el) return;
  const fedLeagues = new Set(state.cleanedRows.map(r => r.leagueId)).size;
  el.innerHTML = `
    <div class="pill">Day: ${escapeHtml(state.dayScope)}</div>
    <div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div>
    <div class="pill">Fed leagues: ${fedLeagues}</div>
    <div class="pill">Clean rows: ${state.cleanedRows.length}</div>`;
}

function resultsRowsHtml(rows, includeIndex=false){
  if (!rows.length) return `<tr><td colspan="${includeIndex ? 7 : 6}" class="empty">No clean rows yet.</td></tr>`;
  return rows.map((row, idx) => `
    <tr data-row-id="${escapeHtml(row.rowId)}">
      ${includeIndex ? `<td>${idx+1}</td>` : ''}
      <td>${escapeHtml(row.sport)}</td>
      <td>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</td>
      <td>${escapeHtml(row.entity)}</td>
      <td>${escapeHtml(displayTeam(row) || '')}</td>
      <td>${escapeHtml(row.lineText)}</td>
      <td class="type-cell">${TYPE_META[row.type]?.icon || '⚪'}</td>
    </tr>`).join('');
}

function rowCardHtml(row){
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

function renderAnalysis(){
  const row = activeRow();
  const summary = document.getElementById('analysisSummary');
  const hint = document.getElementById('analysisHint');
  const rowCard = document.getElementById('analysisRowCard');
  const miningGrid = document.getElementById('miningGrid');
  const body = document.getElementById('analysisResultsBody');
  const title = document.getElementById('analysisTitle');
  const version = document.getElementById('analysisVersion');
  if (title) title.textContent = `Run Analysis ${VERSION}`;
  if (version) version.textContent = `Version: ${VERSION}`;
  if (summary) summary.innerHTML = `
    <div class="pill">Day: ${escapeHtml(state.dayScope)}</div>
    <div class="pill">Rows in pool: ${state.cleanedRows.length}</div>
    <div class="pill">Selected row: ${escapeHtml(row ? row.entity : 'None')}</div>
    <div class="pill">League: ${escapeHtml(row ? (findLeague(row.leagueId)?.label || row.leagueId) : 'None')}</div>`;
  if (!row) {
    if (hint) hint.textContent = 'Ingest at least one row, then hit Run.';
    if (rowCard) rowCard.innerHTML = '<div class="message">No row selected yet.</div>';
    if (miningGrid) miningGrid.innerHTML = '<div class="message">No data-mining matrix yet.</div>';
  } else if (row.leagueId === 'nba') {
    if (hint) hint.textContent = 'NBA live mining is now wired.';
    if (rowCard) rowCard.innerHTML = rowCardHtml(row);
    ensureNbaMining(row, requestRender);
    if (miningGrid) miningGrid.innerHTML = miningCards(row).map(card => `
      <div class="mining-card">
        <h3>${escapeHtml(card.title)}</h3>
        <div class="mining-status ${escapeHtml(card.status)}">${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${escapeHtml(card.statusLabel)}</div>
        <div class="mining-meta"><b>Sources:</b> ${escapeHtml(card.sourcesLabel)}</div>
        <div class="mining-meta"><b>Purpose:</b> ${escapeHtml(card.note)}</div>
        <div class="mining-meta"><b>Parsed result:</b> ${escapeHtml(card.parsedResult || '—')}</div>
        <div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence || '—')}</div>
      </div>`).join('');
  } else {
    if (hint) hint.textContent = 'League-specific mining cards are not wired yet for this sport.';
    if (rowCard) rowCard.innerHTML = rowCardHtml(row);
    if (miningGrid) miningGrid.innerHTML = '<div class="message">League-specific mining cards are not wired yet for this sport.</div>';
  }
  if (body) body.innerHTML = resultsRowsHtml(state.cleanedRows, true);
}

function safeRenderAll(){
  if (!document.getElementById('leagueChecklist')) return;
  renderDayScope();
  renderLeagues();
  renderFeedStatus();
  renderRunSummary();
  renderAnalysis();
  applyScreen();
}

function resetAll() {
  const fresh = defaultState();
  Object.assign(state, fresh);
  saveState();
  const box = document.getElementById('boardInput');
  const msg = document.getElementById('ingestMessage');
  if (box) box.value = '';
  if (msg) { msg.textContent = ''; msg.classList.remove('ok'); }
}

function copyAnalysis(){
  const row = activeRow();
  const lines = [
    'Run Analysis',
    `Version: ${VERSION}`,
    `Day: ${state.dayScope}`,
    `Rows in pool: ${state.cleanedRows.length}`,
    `Selected row: ${row ? row.entity : 'None'}`
  ];
  navigator.clipboard.writeText(lines.join('\n')).catch(()=>{});
}

function handleDocumentClick(e){
  const target = e.target;
  if (!target || !target.id) return;
  if (target.id === 'clearBoxBtn') {
    const box = document.getElementById('boardInput');
    if (box) box.value = '';
    return;
  }
  if (target.id === 'resetAllBtn') {
    resetAll();
    window.location.hash = '#intake';
    safeRenderAll();
    return;
  }
  if (target.id === 'ingestBtn') {
    const box = document.getElementById('boardInput');
    const msg = document.getElementById('ingestMessage');
    const res = ingestText(box ? box.value : '', state);
    state.lastMessage = res.message;
    saveState();
    if (msg) {
      msg.textContent = res.added > 0 ? `✅ ${res.message}` : res.message;
      msg.classList.toggle('ok', res.added > 0);
    }
    if (res.added > 0 && box) box.value = '';
    safeRenderAll();
    return;
  }
  if (target.id === 'runBtn') {
    state.ran = true;
    if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId;
    saveState();
    window.location.hash = '#analysis';
    safeRenderAll();
    return;
  }
  if (target.id === 'backBtn') {
    window.location.hash = '#intake';
    safeRenderAll();
    return;
  }
  if (target.id === 'copyBtn') {
    copyAnalysis();
    return;
  }
  const rowEl = target.closest && target.closest('tr[data-row-id]');
  if (rowEl) {
    state.activeRowId = rowEl.dataset.rowId;
    saveState();
    safeRenderAll();
  }
}

function handleDocumentChange(e){
  const target = e.target;
  if (!target) return;
  if (target.name === 'dayScope') {
    state.dayScope = target.value;
    saveState();
    safeRenderAll();
    return;
  }
  if (target.matches && target.matches('#leagueChecklist input[type="checkbox"]')) {
    const id = target.dataset.id;
    if (!id) return;
    if (target.checked) {
      if (!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id);
    } else {
      state.selectedLeagueIds = state.selectedLeagueIds.filter(x => x !== id);
    }
    saveState();
    safeRenderAll();
  }
}

window.addEventListener('hashchange', applyScreen);
window.addEventListener('pickcalc:nba-update', (e)=>{ const row = activeRow(); if (row && e.detail?.rowId === row.rowId) safeRenderAll(); });

function boot(){
  if (!document.getElementById('leagueChecklist')) return;
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('change', handleDocumentChange);
  renderLeagues();
  safeRenderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}
