import { LEAGUES, STORAGE_KEY, TYPE_META, VERSION } from "./config_core.js";
import { escapeHtml } from "./utils_core.js";
import { ingestText } from "./parser_intake.js";
import { ensureNbaMining } from "./factor_nba.js";

function requestRender(){ window.requestAnimationFrame(()=>safeRenderAnalysis()); }

function defaultState(){ return { dayScope:"Today", selectedLeagueIds:["nba"], cleanedRows:[], lastMessage:"", ran:false, activeRowId:null }; }
function sanitizeState(raw){
  const base = defaultState();
  const out = Object.assign({}, base, raw || {});
  if (!Array.isArray(out.selectedLeagueIds)) out.selectedLeagueIds = ["nba"];
  out.selectedLeagueIds = out.selectedLeagueIds.filter(id => LEAGUES.some(l => l.id === id));
  if (!out.selectedLeagueIds.length) out.selectedLeagueIds = ["nba"];
  if (!Array.isArray(out.cleanedRows)) out.cleanedRows = [];
  out.cleanedRows = out.cleanedRows.filter(r => r && typeof r === 'object');
  if (typeof out.dayScope !== 'string') out.dayScope = 'Today';
  if (typeof out.activeRowId !== 'string') out.activeRowId = null;
  if (typeof out.ran !== 'boolean') out.ran = false;
  return out;
}
function loadState(){
  try { return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')); }
  catch { return defaultState(); }
}
const state = loadState();
function saveState(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function findLeague(id){ return LEAGUES.find(x=>x.id===id); }
function selectedLeagues(){ return state.selectedLeagueIds.map(findLeague).filter(Boolean); }
function activeRow(){ return state.cleanedRows.find(r => r.rowId===state.activeRowId) || state.cleanedRows[0] || null; }
function displayTeam(row){ return row?.leagueId==='tennis' ? '' : (row?.team||''); }
function buildMiningStatus(row){ return row?.miningStatus || []; }
function miningStatusUi(status){ if(status==='ready') return {cls:'ready', icon:'✅'}; if(status==='failed') return {cls:'failed', icon:'❌'}; return {cls:'waiting', icon:'🟡'}; }

function showBootError(message){
  const wrap = document.getElementById('feedStatus');
  if (wrap) wrap.innerHTML = `<div class="message">${escapeHtml(message)}</div>`;
  const hint = document.getElementById('analysisHint');
  if (hint) hint.textContent = message;
}

function renderDayScope(){
  document.querySelectorAll('input[name="dayScope"]').forEach(input=>{
    input.checked = input.value === state.dayScope;
    input.onchange = ()=>{ state.dayScope = input.value; saveState(); renderRunSummary(); safeRenderAnalysis(); };
  });
}
function renderLeagues(){
  const wrap=document.getElementById('leagueChecklist');
  if (!wrap) return;
  wrap.innerHTML=LEAGUES.map(l=>`<label class="league-option"><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id)?'checked':''}> <span>${escapeHtml(l.label)}</span></label>`).join('');
  wrap.querySelectorAll('input[type="checkbox"]').forEach(el=>{
    el.onchange=()=>{
      const id=el.dataset.id;
      if(el.checked){ if(!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id); }
      else { state.selectedLeagueIds=state.selectedLeagueIds.filter(x=>x!==id); if(!state.selectedLeagueIds.length) state.selectedLeagueIds=['nba']; }
      saveState(); renderFeedStatus(); renderRunSummary();
    };
  });
}
function renderFeedStatus(){
  const wrap=document.getElementById('feedStatus');
  if(!wrap) return;
  if(!state.selectedLeagueIds.length){ wrap.innerHTML='<div class="message">Select at least one league.</div>'; return; }
  const fed = {};
  for (const row of state.cleanedRows){ fed[row.leagueId] ||= {}; fed[row.leagueId][row.propFamily]=(fed[row.leagueId][row.propFamily]||0)+1; }
  const html = selectedLeagues().map(league=>{
    const count=state.cleanedRows.filter(r=>r.leagueId===league.id).length;
    const chips=league.propCatalog.map(prop=>{ const n=fed[league.id]?.[prop]||0; return `<div class="prop-chip ${n>0?'prop-fed':'prop-missing'}"><span>${n>0?'✅':'❌'}</span><span>${escapeHtml(prop)}</span><small>${n}</small></div>`; }).join('');
    return `<div class="status-panel"><div class="status-panel-head"><div><strong>${escapeHtml(league.label)}</strong><div class="mini-muted">${count} clean row${count===1?'':'s'}</div></div><div class="status-badge ${count>0?'status-ok':'status-no'}">${count>0?'FED':'NOT FED'}</div></div><div class="prop-grid">${chips}</div></div>`;
  }).join('');
  wrap.innerHTML = html || '<div class="message">No leagues selected.</div>';
}
function renderRunSummary(){ const el=document.getElementById('runSummary'); if(el) el.innerHTML=`<div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div><div class="pill">Clean rows: ${state.cleanedRows.length}</div>`; }
function resultsRowsHtml(rows, includeIndex=false){ if(!rows.length) return `<tr><td colspan="${includeIndex?7:6}" class="empty">No clean rows yet.</td></tr>`; return rows.map((row,idx)=>`<tr data-row-id="${escapeHtml(row.rowId)}">${includeIndex?`<td>${idx+1}</td>`:''}<td>${escapeHtml(row.sport)}</td><td>${escapeHtml(findLeague(row.leagueId)?.label||row.leagueId)}</td><td>${escapeHtml(row.entity)}</td><td>${escapeHtml(displayTeam(row))}</td><td>${escapeHtml(row.lineText)}</td><td class="type-cell">${TYPE_META[row.type]?.icon||'⚪'}</td></tr>`).join(''); }
function bindRowSelection(id){ const body=document.getElementById(id); if(!body) return; body.querySelectorAll('tr[data-row-id]').forEach(tr=>{ tr.onclick=()=>{ state.activeRowId=tr.dataset.rowId; saveState(); safeRenderAnalysis(); }; }); }
function rowCardHtml(row){ return `<div class="row-card"><div class="cell"><strong>Sport</strong>${escapeHtml(row.sport)}</div><div class="cell"><strong>League</strong>${escapeHtml(findLeague(row.leagueId)?.label||row.leagueId)}</div><div class="cell"><strong>Player / Entity</strong>${escapeHtml(row.entity)}</div><div class="cell"><strong>Team</strong>${escapeHtml(displayTeam(row))}</div><div class="cell"><strong>Opponent</strong>${escapeHtml(row.opponent||'')}</div><div class="cell"><strong>Prop</strong>${escapeHtml(row.propFamily)}</div><div class="cell"><strong>Line</strong>${escapeHtml(row.line||'')}</div><div class="cell"><strong>Type</strong>${escapeHtml((TYPE_META[row.type]?.icon||'⚪')+' '+(TYPE_META[row.type]?.label||row.type))}</div><div class="cell"><strong>Raw Parse</strong>${escapeHtml(row.lineText)}</div></div>`; }
function renderAnalysis(){
  const row=activeRow();
  const analysisSummary=document.getElementById('analysisSummary');
  if (analysisSummary) analysisSummary.innerHTML=`<div class="pill">Version: ${escapeHtml(VERSION)}</div><div class="pill">Rows in pool: ${state.cleanedRows.length}</div><div class="pill">Selected row: ${escapeHtml(row?.entity||'None')}</div>`;
  const hint=document.getElementById('analysisHint');
  const rowCard=document.getElementById('analysisRowCard');
  const miningGrid=document.getElementById('miningGrid');
  const analysisBody=document.getElementById('analysisResultsBody');
  const diagPanel=document.getElementById('diagPanel');
  if(!row){
    if(hint) hint.textContent='Ingest at least one row, then hit Run.';
    if(rowCard) rowCard.innerHTML='<div class="message">No row selected yet.</div>';
    if(miningGrid) miningGrid.innerHTML='<div class="message">No data-mining matrix yet.</div>';
  } else if (row.leagueId === 'nba') {
    if(hint) hint.textContent='NBA modular mining is live. Active factors run independently.';
    if(rowCard) rowCard.innerHTML=rowCardHtml(row);
    ensureNbaMining(row, requestRender);
    if(miningGrid) miningGrid.innerHTML=buildMiningStatus(row).map(card=>{ const ui=miningStatusUi(card.status); return `<div class="mining-card"><h3>${escapeHtml(card.title)}</h3><div class="mining-status ${ui.cls}">${ui.icon} ${escapeHtml(card.statusLabel)}</div><div class="mining-meta"><b>Sources:</b> ${escapeHtml(card.sourcesLabel)}</div><div class="mining-meta"><b>Purpose:</b> ${escapeHtml(card.note)}</div><div class="mining-meta"><b>Parsed result:</b> ${escapeHtml(card.parsedResult||'—')}</div><div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence||'—')}</div></div>`; }).join('');
  } else {
    if(hint) hint.textContent='Only NBA is wired in this modular stable rollout.';
    if(rowCard) rowCard.innerHTML=rowCardHtml(row);
    if(miningGrid) miningGrid.innerHTML='<div class="message">League-specific mining cards are not wired yet for this sport.</div>';
  }
  if (analysisBody) analysisBody.innerHTML=resultsRowsHtml(state.cleanedRows,true);
  if (row && diagPanel) { const diag=row._diag||{}; const keys=Object.keys(diag); diagPanel.innerHTML = keys.length ? keys.map(k=>`<div class="diag-entry"><div class="diag-key">${escapeHtml(k)}</div><div class="diag-mini">${escapeHtml(JSON.stringify(diag[k], null, 2))}</div></div>`).join('') : '<div class="message">No diagnostics yet.</div>'; }
  bindRowSelection('analysisResultsBody');
}
function safeRenderAnalysis(){ try { renderAnalysis(); } catch(err){ console.error(err); showBootError(`Analysis render error: ${err.message||err}`); } }
function applyScreen(){ const analysis = window.location.hash === '#analysis'; const intake=document.getElementById('intakeScreen'); const analysisScreen=document.getElementById('analysisScreen'); if (intake) intake.classList.toggle('hidden', analysis); if (analysisScreen) analysisScreen.classList.toggle('hidden', !analysis); }
function buildAnalysisCopyText(row){ const matrix=buildMiningStatus(row); const lines=['Run Analysis',`Version: ${VERSION}`,`Day: ${state.dayScope}`,`Rows in pool: ${state.cleanedRows.length}`,`Selected row: ${row?row.entity:'None'}`,`League: ${row?(findLeague(row.leagueId)?.label||row.leagueId):'None'}`,'','Selected Test Row',`SPORT
${row?row.sport:''}`,`LEAGUE
${row?(findLeague(row.leagueId)?.label||row.leagueId):''}`,`PLAYER / ENTITY
${row?row.entity:''}`,`TEAM
${row?displayTeam(row):''}`,`OPPONENT
${row?(row.opponent||''):''}`,`PROP
${row?row.propFamily:''}`,`LINE
${row?row.line:''}`,`TYPE
${row?((TYPE_META[row.type]?.icon||'⚪')+' '+(TYPE_META[row.type]?.label||row.type)):''}`,`RAW PARSE
${row?row.lineText:''}`,'',`${findLeague(row?.leagueId)?.label||row?.leagueId||'League'} Data-Mining Matrix`]; for (const card of matrix){ lines.push(card.title,`${card.status==='ready'?'✅':card.status==='failed'?'❌':'🟡'} ${card.statusLabel}`,`Sources: ${card.sourcesLabel}`,`Purpose: ${card.note}`,`Parsed result: ${card.parsedResult||'—'}`,`Evidence: ${card.evidence||'—'}`,''); } return lines.join('
'); }
function bindActions(){
  const clearBtn=document.getElementById('clearBoxBtn'); if(clearBtn) clearBtn.onclick=()=>{ const bi=document.getElementById('boardInput'); if(bi) bi.value=''; };
  const resetBtn=document.getElementById('resetAllBtn'); if(resetBtn) resetBtn.onclick=()=>{ Object.assign(state, defaultState()); saveState(); safeRenderAll(); window.location.hash='#intake'; };
  const ingestBtn=document.getElementById('ingestBtn'); if(ingestBtn) ingestBtn.onclick=()=>{ const bi=document.getElementById('boardInput'); const res=ingestText((bi&&bi.value)||'', state); const msg=document.getElementById('ingestMessage'); if(msg){ msg.textContent=res.added>0?`✅ ${res.message}`:res.message; msg.classList.toggle('ok', res.added>0); } if (res.added>0 && bi) bi.value=''; saveState(); safeRenderAll(); };
  const runBtn=document.getElementById('runBtn'); if(runBtn) runBtn.onclick=()=>{ state.ran=true; if(!state.activeRowId&&state.cleanedRows[0]) state.activeRowId=state.cleanedRows[0].rowId; saveState(); window.location.hash='#analysis'; safeRenderAll(); };
  const backBtn=document.getElementById('backBtn'); if(backBtn) backBtn.onclick=()=>{ window.location.hash='#intake'; applyScreen(); };
  const copyBtn=document.getElementById('copyBtn'); if(copyBtn) copyBtn.onclick=async()=>{ const row=activeRow(); try { await navigator.clipboard.writeText(buildAnalysisCopyText(row)); const hint=document.getElementById('analysisHint'); if(hint) hint.textContent='Copied.'; } catch { const hint=document.getElementById('analysisHint'); if(hint) hint.textContent='Copy failed.'; } };
  window.addEventListener('hashchange', applyScreen);
}
function safeRenderAll(){
  try { renderDayScope(); } catch(err){ console.error(err); }
  try { renderLeagues(); } catch(err){ console.error(err); }
  try { renderFeedStatus(); } catch(err){ console.error(err); showBootError(`Feed render error: ${err.message||err}`); }
  try { renderRunSummary(); } catch(err){ console.error(err); }
  safeRenderAnalysis();
  applyScreen();
}
window.addEventListener('pickcalc:nba-update', (e)=>{ const row=activeRow(); if (row && e.detail?.rowId===row.rowId) safeRenderAnalysis(); });
window.addEventListener('error', (e)=>showBootError(`Runtime error: ${e.message}`));
window.addEventListener('unhandledrejection', (e)=>showBootError(`Promise error: ${e.reason?.message||e.reason||'unknown'}`));

document.addEventListener('DOMContentLoaded', ()=>{ bindActions(); safeRenderAll(); });
