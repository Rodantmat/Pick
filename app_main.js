import { LEAGUES, STORAGE_KEY, TYPE_META, VERSION } from './config_core.js';
import { escapeHtml, canon } from './utils_core.js';
import { ingestText } from './parser_intake.js';
import { ensureNbaMining } from './factor_nba.js';

function defaultState() {
  return { dayScope:'Today', selectedLeagueIds:['nba'], cleanedRows:[], lastMessage:'', ran:false, activeRowId:null };
}

function sanitizeState(raw) {
  const base = defaultState();
  const out = Object.assign({}, base, raw || {});
  if (!Array.isArray(out.selectedLeagueIds)) out.selectedLeagueIds = ['nba'];
  out.selectedLeagueIds = out.selectedLeagueIds.filter((id) => LEAGUES.some((l) => l.id === id));
  if (!out.selectedLeagueIds.length) out.selectedLeagueIds = ['nba'];
  if (!Array.isArray(out.cleanedRows)) out.cleanedRows = [];
  out.cleanedRows = out.cleanedRows.filter((r) => r && typeof r === 'object');
  if (typeof out.dayScope !== 'string') out.dayScope = 'Today';
  if (typeof out.activeRowId !== 'string') out.activeRowId = null;
  if (typeof out.ran !== 'boolean') out.ran = false;
  if (typeof out.lastMessage !== 'string') out.lastMessage = '';
  return out;
}

function loadState() {
  try { return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return defaultState(); }
}

const state = loadState();

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function findLeague(id) { return LEAGUES.find((x) => x.id === id) || null; }
function selectedLeagues() { return state.selectedLeagueIds.map(findLeague).filter(Boolean); }
function activeRow() { return state.cleanedRows.find((r) => r.rowId === state.activeRowId) || state.cleanedRows[0] || null; }
function displayTeam(row) { return row?.leagueId === 'tennis' ? '' : (row?.team || ''); }

function getFedPropCounts() {
  const fed = {};
  for (const row of state.cleanedRows) {
    fed[row.leagueId] ||= {};
    fed[row.leagueId][row.propKey] = (fed[row.leagueId][row.propKey] || 0) + 1;
  }
  return fed;
}

function applyScreen() {
  const analysis = window.location.hash === '#analysis';
  const intake = document.getElementById('intakeScreen');
  const analysisScreen = document.getElementById('analysisScreen');
  if (intake) intake.classList.toggle('hidden', analysis);
  if (analysisScreen) analysisScreen.classList.toggle('hidden', !analysis);
}

function renderDayScope() {
  document.querySelectorAll('input[name="dayScope"]').forEach((input) => {
    input.checked = input.value === state.dayScope;
  });
}

function renderLeagues() {
  const wrap = document.getElementById('leagueChecklist');
  if (!wrap) return;
  wrap.innerHTML = LEAGUES.map((l) => `
    <label class="league-option"><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id) ? 'checked' : ''}> <span>${escapeHtml(l.label)}</span></label>
  `).join('');
}

function renderFeedStatus() {
  const wrap = document.getElementById('feedStatus');
  if (!wrap) return;
  const fed = getFedPropCounts();
  if (!state.selectedLeagueIds.length) {
    wrap.innerHTML = '<div class="message">Select at least one league.</div>';
    return;
  }
  wrap.innerHTML = selectedLeagues().map((league) => {
    const count = state.cleanedRows.filter((r) => r.leagueId === league.id).length;
    const chips = league.propCatalog.map((prop) => {
      const n = fed[league.id]?.[canon(prop)] || 0;
      return `<div class="prop-chip ${n > 0 ? 'prop-fed' : 'prop-missing'}"><span>${n > 0 ? '✅' : '❌'}</span><span>${escapeHtml(prop)}</span><small>${n}</small></div>`;
    }).join('');
    return `<div class="status-panel"><div class="status-panel-head"><div><strong>${escapeHtml(league.label)}</strong><div class="mini-muted">${count} clean row${count === 1 ? '' : 's'}</div></div><div class="status-badge ${count > 0 ? 'status-ok' : 'status-no'}">${count > 0 ? 'FED' : 'NOT FED'}</div></div><div class="prop-grid">${chips}</div></div>`;
  }).join('');
}

function renderRunSummary() {
  const fedLeagues = new Set(state.cleanedRows.map((r) => r.leagueId)).size;
  const el = document.getElementById('runSummary');
  if (!el) return;
  el.innerHTML = `<div class="pill">Version: ${escapeHtml(VERSION)}</div><div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div><div class="pill">Fed leagues: ${fedLeagues}</div><div class="pill">Clean rows: ${state.cleanedRows.length}</div>`;
}

function resultsRowsHtml(rows, includeIndex = false) {
  if (!rows.length) return `<tr><td colspan="${includeIndex ? 7 : 6}" class="empty">No clean rows yet.</td></tr>`;
  return rows.map((row, idx) => `
    <tr data-row-id="${escapeHtml(row.rowId)}">
      ${includeIndex ? `<td>${idx + 1}</td>` : ''}
      <td>${escapeHtml(row.sport)}</td>
      <td>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</td>
      <td>${escapeHtml(row.entity)}</td>
      <td>${escapeHtml(displayTeam(row))}</td>
      <td>${escapeHtml(row.lineText)}</td>
      <td class="type-cell">${TYPE_META[row.type]?.icon || '⚪'}</td>
    </tr>`).join('');
}

function rowCardHtml(row) {
  return `<div class="row-card"><div class="cell"><strong>Sport</strong>${escapeHtml(row.sport)}</div><div class="cell"><strong>League</strong>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</div><div class="cell"><strong>Player / Entity</strong>${escapeHtml(row.entity)}</div><div class="cell"><strong>Team</strong>${escapeHtml(displayTeam(row) || '—')}</div><div class="cell"><strong>Opponent</strong>${escapeHtml(row.opponent || '—')}</div><div class="cell"><strong>Prop</strong>${escapeHtml(row.propFamily)}</div><div class="cell"><strong>Line</strong>${escapeHtml(row.line || '—')}</div><div class="cell"><strong>Type</strong>${TYPE_META[row.type]?.icon || '⚪'} ${escapeHtml(TYPE_META[row.type]?.label || row.type)}</div><div class="cell"><strong>Raw Parse</strong>${escapeHtml(row.lineText)}</div></div>`;
}

function buildMiningStatus(row) { return row?.miningStatus || []; }

function renderAnalysis() {
  const row = activeRow();
  const summary = document.getElementById('analysisSummary');
  const hint = document.getElementById('analysisHint');
  const rowCard = document.getElementById('analysisRowCard');
  const miningGrid = document.getElementById('miningGrid');
  const analysisBody = document.getElementById('analysisResultsBody');
  const matrixTitle = document.getElementById('miningMatrixTitle');
  if (summary) summary.innerHTML = `<div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Rows in pool: ${state.cleanedRows.length}</div><div class="pill">Selected row: ${escapeHtml(row ? row.entity : 'None')}</div><div class="pill">League: ${escapeHtml(row ? (findLeague(row.leagueId)?.label || row.leagueId) : 'None')}</div>`;
  if (!row) {
    if (hint) hint.textContent = 'Ingest at least one row, then hit Run.';
    if (rowCard) rowCard.innerHTML = '<div class="message">No row selected yet.</div>';
    if (miningGrid) miningGrid.innerHTML = '<div class="message">No data-mining matrix yet.</div>';
  } else {
    if (matrixTitle) matrixTitle.textContent = `${findLeague(row.leagueId)?.label || row.leagueId} Data-Mining Matrix`;
    if (rowCard) rowCard.innerHTML = rowCardHtml(row);
    if (row.leagueId === 'nba') {
      if (hint) hint.textContent = 'NBA live mining is wired.';
      ensureNbaMining(row, () => requestAnimationFrame(renderAnalysis));
      if (miningGrid) miningGrid.innerHTML = buildMiningStatus(row).map((card) => `<div class="mining-card"><h3>${escapeHtml(card.title)}</h3><div class="mining-status ${escapeHtml(card.status)}">${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${escapeHtml(card.statusLabel)}</div><div class="mining-meta"><b>Sources:</b> ${escapeHtml(card.sourcesLabel || '')}</div><div class="mining-meta"><b>Purpose:</b> ${escapeHtml(card.note || '')}</div><div class="mining-meta"><b>Parsed result:</b> ${escapeHtml(card.parsedResult || '—')}</div><div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence || '—')}</div></div>`).join('');
    } else {
      if (hint) hint.textContent = 'League-specific mining cards are not wired yet for this sport.';
      if (miningGrid) miningGrid.innerHTML = '<div class="message">League-specific mining cards are not wired yet for this sport.</div>';
    }
  }
  if (analysisBody) analysisBody.innerHTML = resultsRowsHtml(state.cleanedRows, true);
}

function renderAll() {
  renderDayScope();
  renderLeagues();
  renderFeedStatus();
  renderRunSummary();
  renderAnalysis();
  applyScreen();
}

function resetState() {
  const fresh = defaultState();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  saveState();
}

function boot() {
  if (!document.getElementById('leagueChecklist')) return;

  document.addEventListener('click', async (e) => {
    const target = e.target.closest('button, tr[data-row-id]');
    if (!target) return;

    if (target.matches('tr[data-row-id]')) {
      state.activeRowId = target.dataset.rowId;
      saveState();
      renderAnalysis();
      return;
    }
    if (target.id === 'clearBoxBtn') {
      const box = document.getElementById('boardInput');
      if (box) box.value = '';
      return;
    }
    if (target.id === 'resetAllBtn') {
      resetState();
      const box = document.getElementById('boardInput');
      const msg = document.getElementById('ingestMessage');
      if (box) box.value = '';
      if (msg) { msg.textContent = ''; msg.classList.remove('ok'); }
      window.location.hash = '#intake';
      renderAll();
      return;
    }
    if (target.id === 'ingestBtn') {
      const text = document.getElementById('boardInput')?.value || '';
      const res = ingestText(text, state);
      saveState();
      const msg = document.getElementById('ingestMessage');
      if (msg) { msg.textContent = res.added > 0 ? `✅ ${res.message}` : res.message; msg.classList.toggle('ok', res.added > 0); }
      const box = document.getElementById('boardInput');
      if (res.added > 0 && box) box.value = '';
      renderAll();
      return;
    }
    if (target.id === 'runBtn') {
      state.ran = true;
      if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId;
      saveState();
      window.location.hash = '#analysis';
      renderAll();
      return;
    }
    if (target.id === 'backBtn') {
      window.location.hash = '#intake';
      applyScreen();
      return;
    }
    if (target.id === 'copyBtn') {
      const row = activeRow();
      const text = [`Version: ${VERSION}`, `Day: ${state.dayScope}`, `Rows in pool: ${state.cleanedRows.length}`, `Selected row: ${row ? row.entity : 'None'}`, row ? `${row.entity} | ${row.lineText}` : ''].join('\n');
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  });

  document.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === 'dayScope') {
      state.dayScope = target.value;
      saveState();
      renderRunSummary();
      renderAnalysis();
      return;
    }
    if (target.closest('#leagueChecklist') && target.dataset.id) {
      const id = target.dataset.id;
      if (target.checked) {
        if (!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id);
      } else {
        state.selectedLeagueIds = state.selectedLeagueIds.filter((x) => x !== id);
      }
      saveState();
      renderLeagues();
      renderFeedStatus();
      renderRunSummary();
    }
  });

  window.addEventListener('hashchange', applyScreen);
  window.addEventListener('pickcalc:nba-update', () => renderAnalysis());

  renderLeagues();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}
