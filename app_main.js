import { LEAGUES, STORAGE_KEY, TYPE_META, VERSION } from './config_core.js';
import { escapeHtml } from './utils_core.js';
import { ingestText } from './parser_intake.js';
import { ensureNbaMining } from './factor_nba.js';

function defaultState() {
  return { dayScope: 'Today', selectedLeagueIds: [], cleanedRows: [], lastMessage: '', ran: false, activeRowId: null };
}

function sanitizeState(raw) {
  const base = defaultState();
  const out = Object.assign({}, base, raw || {});
  if (!Array.isArray(out.selectedLeagueIds)) out.selectedLeagueIds = [];
  out.selectedLeagueIds = out.selectedLeagueIds.filter((id) => LEAGUES.some((l) => l.id === id));
  if (!Array.isArray(out.cleanedRows)) out.cleanedRows = [];
  out.cleanedRows = out.cleanedRows.filter((r) => r && typeof r === 'object');
  if (typeof out.dayScope !== 'string') out.dayScope = 'Today';
  if (typeof out.lastMessage !== 'string') out.lastMessage = '';
  if (typeof out.activeRowId !== 'string') out.activeRowId = null;
  if (typeof out.ran !== 'boolean') out.ran = false;
  return out;
}

function loadState() {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return defaultState();
  }
}

const state = loadState();

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function findLeague(id) {
  return LEAGUES.find((x) => x.id === id) || null;
}

function selectedLeagues() {
  return state.selectedLeagueIds.map(findLeague).filter(Boolean);
}

function activeRow() {
  return state.cleanedRows.find((r) => r.rowId === state.activeRowId) || state.cleanedRows[0] || null;
}

function displayTeam(row) {
  if (!row) return '';
  return row.leagueId === 'tennis' ? '' : (row.team || '');
}

function requestRender() {
  window.requestAnimationFrame(() => safeRenderAnalysis());
}

function applyScreen() {
  const analysis = window.location.hash === '#analysis';
  document.getElementById('intakeScreen')?.classList.toggle('hidden', analysis);
  document.getElementById('analysisScreen')?.classList.toggle('hidden', !analysis);
}

function renderDayScope() {
  document.querySelectorAll('input[name="dayScope"]').forEach((input) => {
    input.checked = input.value === state.dayScope;
  });
}

function renderLeagues() {
  const wrap = document.getElementById('leagueChecklist');
  if (!wrap) return;
  wrap.innerHTML = LEAGUES.map((l) => `<label class="league-option"><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id) ? 'checked' : ''}> <span>${escapeHtml(l.label)}</span></label>`).join('');
}

function getFedPropCounts() {
  const fed = {};
  for (const row of state.cleanedRows) {
    fed[row.leagueId] ||= {};
    fed[row.leagueId][row.propFamily] = (fed[row.leagueId][row.propFamily] || 0) + 1;
  }
  return fed;
}

function renderFeedStatus() {
  const wrap = document.getElementById('feedStatus');
  if (!wrap) return;
  if (!state.selectedLeagueIds.length) {
    wrap.innerHTML = '<div class="message">Select at least one league.</div>';
    return;
  }
  const fed = getFedPropCounts();
  wrap.innerHTML = selectedLeagues().map((league) => {
    const count = state.cleanedRows.filter((r) => r.leagueId === league.id).length;
    const chips = league.propCatalog.map((prop) => {
      const n = fed[league.id]?.[prop] || 0;
      return `<div class="prop-chip ${n > 0 ? 'prop-fed' : 'prop-missing'}"><span>${n > 0 ? '✅' : '❌'}</span><span>${escapeHtml(prop)}</span><small>${n}</small></div>`;
    }).join('');
    return `<div class="status-panel"><div class="status-panel-head"><div><strong>${escapeHtml(league.label)}</strong><div class="mini-muted">${count} clean row${count === 1 ? '' : 's'}</div></div><div class="status-badge ${count > 0 ? 'status-ok' : 'status-no'}">${count > 0 ? 'FED' : 'NOT FED'}</div></div><div class="prop-grid">${chips}</div></div>`;
  }).join('');
}

function renderRunSummary() {
  const fedLeagues = new Set(state.cleanedRows.map((r) => r.leagueId)).size;
  const el = document.getElementById('runSummary');
  if (!el) return;
  el.innerHTML = `<div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div><div class="pill">Fed leagues: ${fedLeagues}</div><div class="pill">Clean rows: ${state.cleanedRows.length}</div>`;
}

function resultsRowsHtml(rows, includeIndex = false) {
  if (!rows.length) return `<tr><td colspan="${includeIndex ? 7 : 6}" class="empty">No clean rows yet.</td></tr>`;
  return rows.map((row, idx) => `<tr data-row-id="${escapeHtml(row.rowId)}"><td>${includeIndex ? idx + 1 : ''}</td>${includeIndex ? '' : ''}<td>${escapeHtml(row.sport)}</td><td>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</td><td>${escapeHtml(row.entity)}</td><td>${escapeHtml(displayTeam(row))}</td><td>${escapeHtml(row.lineText)}</td><td class="type-cell">${TYPE_META[row.type]?.icon || '⚪'}</td></tr>`.replace('<td></td>','')).join('');
}

function bindRowSelection(tbodyId) {
  const body = document.getElementById(tbodyId);
  if (!body) return;
  body.querySelectorAll('tr[data-row-id]').forEach((tr) => {
    tr.addEventListener('click', () => {
      state.activeRowId = tr.dataset.rowId;
      saveState();
      safeRenderAnalysis();
    });
  });
}

function buildMiningStatus(row) {
  return row?.miningStatus || [];
}

function rowCardHtml(row) {
  return `<div class="row-card"><div class="cell"><strong>Sport</strong>${escapeHtml(row.sport)}</div><div class="cell"><strong>League</strong>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</div><div class="cell"><strong>Player / Entity</strong>${escapeHtml(row.entity)}</div><div class="cell"><strong>Team</strong>${escapeHtml(displayTeam(row) || '—')}</div><div class="cell"><strong>Opponent</strong>${escapeHtml(row.opponent || '—')}</div><div class="cell"><strong>Prop</strong>${escapeHtml(row.propFamily)}</div><div class="cell"><strong>Line</strong>${escapeHtml(row.line || '—')}</div><div class="cell"><strong>Type</strong>${TYPE_META[row.type]?.icon || '⚪'} ${escapeHtml(TYPE_META[row.type]?.label || row.type)}</div><div class="cell"><strong>Raw Parse</strong>${escapeHtml(row.lineText)}</div></div>`;
}

function renderAnalysis() {
  const row = activeRow();
  const summary = document.getElementById('analysisSummary');
  const hint = document.getElementById('analysisHint');
  const rowCard = document.getElementById('analysisRowCard');
  const miningGrid = document.getElementById('miningGrid');
  const analysisBody = document.getElementById('analysisResultsBody');
  const diagPanel = document.getElementById('diagPanel');
  const title = document.getElementById('analysisTitle');
  const version = document.getElementById('analysisVersion');
  if (title) title.textContent = `Run Analysis ${VERSION}`;
  if (version) version.textContent = `Version: ${VERSION}`;
  if (summary) summary.innerHTML = `<div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Rows in pool: ${state.cleanedRows.length}</div><div class="pill">Selected row: ${row ? escapeHtml(row.entity) : 'None'}</div><div class="pill">League: ${row ? escapeHtml(findLeague(row.leagueId)?.label || row.leagueId) : 'None'}</div>`;
  if (!row) {
    if (hint) hint.textContent = 'Ingest at least one row, then hit Run.';
    if (rowCard) rowCard.innerHTML = '<div class="message">No row selected yet.</div>';
    if (miningGrid) miningGrid.innerHTML = '<div class="message">No data-mining matrix yet.</div>';
  } else if (row.leagueId === 'nba') {
    if (hint) hint.textContent = 'NBA live mining is wired.';
    if (rowCard) rowCard.innerHTML = rowCardHtml(row);
    ensureNbaMining(row, requestRender);
    if (miningGrid) miningGrid.innerHTML = buildMiningStatus(row).map((card) => `<div class="mining-card"><h3>${escapeHtml(card.title)}</h3><div class="mining-status ${escapeHtml(card.status)}">${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${escapeHtml(card.statusLabel)}</div><div class="mining-meta"><b>Sources:</b> ${escapeHtml(card.sourcesLabel)}</div><div class="mining-meta"><b>Purpose:</b> ${escapeHtml(card.note)}</div><div class="mining-meta"><b>Parsed result:</b> ${escapeHtml(card.parsedResult || '—')}</div><div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence || '—')}</div></div>`).join('');
  } else {
    if (hint) hint.textContent = 'League-specific live mining is only wired for NBA in this recovery build.';
    if (rowCard) rowCard.innerHTML = rowCardHtml(row);
    if (miningGrid) miningGrid.innerHTML = '<div class="message">League-specific mining cards are not wired yet for this sport.</div>';
  }
  if (analysisBody) analysisBody.innerHTML = resultsRowsHtml(state.cleanedRows, true);
  bindRowSelection('analysisResultsBody');
  if (diagPanel) {
    const diag = row?._diag || {};
    const keys = Object.keys(diag);
    diagPanel.innerHTML = keys.length ? keys.map((k) => `<div class="diag-entry"><div class="diag-key">${escapeHtml(k)}</div><div class="diag-mini">${escapeHtml(JSON.stringify(diag[k], null, 2))}</div></div>`).join('') : '<div class="message">No diagnostics yet.</div>';
  }
}

function safeRenderAnalysis() {
  try { renderAnalysis(); } catch (err) { console.error(err); }
}

function buildAnalysisCopyText(row) {
  const matrix = buildMiningStatus(row);
  const lines = [
    'Run Analysis',
    `Version: ${VERSION}`,
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
    `${findLeague(row?.leagueId)?.label || row?.leagueId || 'League'} Data-Mining Matrix`
  ];
  for (const card of matrix) {
    lines.push(card.title, `${card.status === 'ready' ? '✅' : card.status === 'failed' ? '❌' : '🟡'} ${card.statusLabel}`, `Sources: ${card.sourcesLabel}`, `Purpose: ${card.note}`, `Parsed result: ${card.parsedResult || '—'}`, `Evidence: ${card.evidence || '—'}`, '');
  }
  return lines.join('\n');
}

function bindActions() {
  document.getElementById('clearBoxBtn')?.addEventListener('click', () => {
    const box = document.getElementById('boardInput');
    if (box) box.value = '';
  });
  document.getElementById('resetAllBtn')?.addEventListener('click', () => {
    Object.assign(state, defaultState());
    saveState();
    const box = document.getElementById('boardInput');
    const msg = document.getElementById('ingestMessage');
    if (box) box.value = '';
    if (msg) msg.textContent = '';
    window.location.hash = '#intake';
    safeRenderAll();
  });
  document.getElementById('ingestBtn')?.addEventListener('click', () => {
    const text = document.getElementById('boardInput')?.value || '';
    const res = ingestText(text, state);
    const msg = document.getElementById('ingestMessage');
    if (msg) {
      msg.textContent = res.added > 0 ? `✅ ${res.message}` : res.message;
      msg.classList.toggle('ok', res.added > 0);
    }
    if (res.added > 0 && document.getElementById('boardInput')) document.getElementById('boardInput').value = '';
    saveState();
    safeRenderAll();
  });
  document.getElementById('runBtn')?.addEventListener('click', () => {
    state.ran = true;
    if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId;
    saveState();
    window.location.hash = '#analysis';
    safeRenderAll();
  });
  document.getElementById('backBtn')?.addEventListener('click', () => {
    window.location.hash = '#intake';
    applyScreen();
  });
  document.getElementById('copyBtn')?.addEventListener('click', async () => {
    const hint = document.getElementById('analysisHint');
    try {
      await navigator.clipboard.writeText(buildAnalysisCopyText(activeRow()));
      if (hint) hint.textContent = 'Copied.';
    } catch {
      if (hint) hint.textContent = 'Copy failed.';
    }
  });
  document.getElementById('dayScope')?.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'dayScope') return;
    state.dayScope = target.value;
    saveState();
    renderDayScope();
    renderRunSummary();
    safeRenderAnalysis();
  });
  document.getElementById('leagueChecklist')?.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
    const id = target.dataset.id;
    if (!id) return;
    if (target.checked) {
      if (!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id);
    } else {
      state.selectedLeagueIds = state.selectedLeagueIds.filter((x) => x !== id);
    }
    saveState();
    renderLeagues();
    renderFeedStatus();
    renderRunSummary();
  });
  window.addEventListener('hashchange', applyScreen);
  window.addEventListener('pickcalc:nba-update', (e) => {
    const row = activeRow();
    if (row && e.detail?.rowId === row.rowId) safeRenderAnalysis();
  });
}

function safeRenderAll() {
  renderDayScope();
  renderLeagues();
  renderFeedStatus();
  renderRunSummary();
  safeRenderAnalysis();
  applyScreen();
}

function boot() {
  bindActions();
  safeRenderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
