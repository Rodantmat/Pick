import { LEAGUES, STORAGE_KEY, TYPE_META, VERSION } from "./config_core.js";
import { escapeHtml } from "./utils_core.js";
import { ingestText } from "./parser_intake.js";
import { ensureNbaMining, getInitialNbaCards } from "./factor_nba.js";
import { pushLog } from "./logger.js";

function requestRender() { window.requestAnimationFrame(() => safeRenderAnalysis()); }
function defaultState() { return { dayScope: "Today", selectedLeagueIds: ["nba"], cleanedRows: [], lastMessage: "", ran: false, activeRowId: null, logs: [] }; }
function sanitizeState(raw) {
  const base = defaultState(); const out = Object.assign({}, base, raw || {});
  if (!Array.isArray(out.selectedLeagueIds)) out.selectedLeagueIds = ["nba"];
  out.selectedLeagueIds = out.selectedLeagueIds.filter((id) => LEAGUES.some((l) => l.id === id)); if (!out.selectedLeagueIds.length) out.selectedLeagueIds = ["nba"];
  if (!Array.isArray(out.cleanedRows)) out.cleanedRows = []; out.cleanedRows = out.cleanedRows.filter((r) => r && typeof r === "object");
  if (!Array.isArray(out.logs)) out.logs = [];
  if (typeof out.dayScope !== "string") out.dayScope = "Today";
  if (typeof out.activeRowId !== "string") out.activeRowId = null;
  if (typeof out.ran !== "boolean") out.ran = false;
  return out;
}
function loadState() { try { return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch { return defaultState(); } }
const state = loadState();
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function findLeague(id) { return LEAGUES.find((x) => x.id === id); }
function selectedLeagues() { return state.selectedLeagueIds.map(findLeague).filter(Boolean); }
function activeRow() { return state.cleanedRows.find((r) => r.rowId === state.activeRowId) || state.cleanedRows[0] || null; }
function displayTeam(row) { return row?.leagueId === "tennis" ? "" : (row?.team || ""); }
function buildMiningStatus(row) { return row ? (row._factorCards?.length ? row._factorCards : getInitialNbaCards(row)) : []; }
function miningStatusUi(status) { if (status === "ready") return { cls: "ready", icon: "✅" }; if (status === "warning") return { cls: "failed", icon: "⚠️" }; if (status === "failed") return { cls: "failed", icon: "❌" }; if (status === "loading") return { cls: "loading", icon: "🟡" }; return { cls: "waiting", icon: "⚪" }; }
function showBootError(message) { const wrap = document.getElementById("feedStatus"); if (wrap) wrap.innerHTML = `<div class="message">${escapeHtml(message)}</div>`; const hint = document.getElementById("analysisHint"); if (hint) hint.textContent = message; }
function renderDayScope() { document.querySelectorAll('input[name="dayScope"]').forEach((input) => { input.checked = input.value === state.dayScope; }); }
function renderLeagues() { const wrap = document.getElementById("leagueChecklist"); if (!wrap) return; wrap.innerHTML = LEAGUES.map((l) => `<label class="league-option"><input type="checkbox" data-id="${l.id}" ${state.selectedLeagueIds.includes(l.id) ? "checked" : ""}> <span>${escapeHtml(l.label)}</span></label>`).join(""); }
function renderFeedStatus() {
  const wrap = document.getElementById("feedStatus"); if (!wrap) return; if (!state.selectedLeagueIds.length) { wrap.innerHTML = '<div class="message">Select at least one league.</div>'; return; }
  const fed = {}; for (const row of state.cleanedRows) { fed[row.leagueId] ||= {}; fed[row.leagueId][row.propFamily] = (fed[row.leagueId][row.propFamily] || 0) + 1; }
  wrap.innerHTML = selectedLeagues().map((league) => {
    const count = state.cleanedRows.filter((r) => r.leagueId === league.id).length;
    const chips = league.propCatalog.map((prop) => { const n = fed[league.id]?.[prop] || 0; return `<div class="prop-chip ${n > 0 ? "prop-fed" : "prop-missing"}"><span>${n > 0 ? "✅" : "❌"}</span><span>${escapeHtml(prop)}</span><small>${n}</small></div>`; }).join("");
    return `<div class="status-panel"><div class="status-panel-head"><div><strong>${escapeHtml(league.label)}</strong><div class="mini-muted">${count} clean row${count === 1 ? "" : "s"}</div></div><div class="status-badge ${count > 0 ? "status-ok" : "status-no"}">${count > 0 ? "FED" : "NOT FED"}</div></div><div class="prop-grid">${chips}</div></div>`;
  }).join("");
}
function renderRunSummary() { const el = document.getElementById("runSummary"); if (el) el.innerHTML = `<div class="pill">Version: ${escapeHtml(VERSION)}</div><div class="pill">Day: ${escapeHtml(state.dayScope)}</div><div class="pill">Selected leagues: ${state.selectedLeagueIds.length}</div><div class="pill">Clean rows: ${state.cleanedRows.length}</div><div class="pill">Logs: ${state.logs.length}</div>`; }
function resultsRowsHtml(rows, includeIndex = false) { if (!rows.length) return `<tr><td colspan="${includeIndex ? 7 : 6}" class="empty">No clean rows yet.</td></tr>`; return rows.map((row, idx) => `<tr data-row-id="${escapeHtml(row.rowId)}">${includeIndex ? `<td>${idx + 1}</td>` : ""}<td>${escapeHtml(row.sport)}</td><td>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</td><td>${escapeHtml(row.entity)}</td><td>${escapeHtml(displayTeam(row))}</td><td>${escapeHtml(row.lineText)}</td><td class="type-cell">${TYPE_META[row.type]?.icon || "⚪"}</td></tr>`).join(""); }
function bindRowSelection(id) { const body = document.getElementById(id); if (!body) return; body.querySelectorAll("tr[data-row-id]").forEach((tr) => { tr.addEventListener("click", () => { state.activeRowId = tr.dataset.rowId; saveState(); safeRenderAnalysis(); }); }); }
function rowCardHtml(row) { return `<div class="row-card"><div class="cell"><strong>Sport</strong>${escapeHtml(row.sport)}</div><div class="cell"><strong>League</strong>${escapeHtml(findLeague(row.leagueId)?.label || row.leagueId)}</div><div class="cell"><strong>Player / Entity</strong>${escapeHtml(row.entity)}</div><div class="cell"><strong>Team</strong>${escapeHtml(displayTeam(row))}</div><div class="cell"><strong>Opponent</strong>${escapeHtml(row.opponent || "")}</div><div class="cell"><strong>Prop</strong>${escapeHtml(row.propFamily)}</div><div class="cell"><strong>Line</strong>${escapeHtml(row.line || "")}</div><div class="cell"><strong>Type</strong>${escapeHtml((TYPE_META[row.type]?.icon || "⚪") + " " + (TYPE_META[row.type]?.label || row.type))}</div><div class="cell"><strong>Standalone</strong>${escapeHtml(String(row._standaloneProbability ?? "—"))}</div><div class="cell"><strong>Relational</strong>${escapeHtml(String(row._relationalSurvivability ?? "—"))}</div></div>`; }
function renderFactorCard(card) {
  const ui = miningStatusUi(card.status); const warningHtml = card.warning ? `<div class="mining-meta"><b>Warning:</b> ${escapeHtml(card.warning)}</div>` : ""; const recommendation = card.recommendation ? `<div class="mining-meta"><b>Recommendation:</b> ${escapeHtml(card.recommendation)}</div>` : "";
  return `<div class="mining-card"><h3>${escapeHtml(card.title)} <span class="mini-muted">[${escapeHtml(card.tier)}]</span></h3><div class="mining-status ${ui.cls}">${ui.icon} ${escapeHtml(card.statusLabel)}</div><div class="mining-meta"><b>Magnitude:</b> ${escapeHtml(card.magnitude == null ? "—" : String(card.magnitude))}</div><div class="mining-meta"><b>Confidence:</b> ${escapeHtml(card.confidence == null ? "—" : String(card.confidence) + "%")}</div><div class="mining-meta"><b>Evidence:</b> ${escapeHtml(card.evidence || "—")}</div><div class="mining-meta"><b>Source:</b> ${escapeHtml(card.source || "—")}</div>${warningHtml}${recommendation}</div>`;
}
function renderAnalysis() {
  const row = activeRow(); const analysisSummary = document.getElementById("analysisSummary"); const hint = document.getElementById("analysisHint"); const rowCard = document.getElementById("analysisRowCard"); const miningGrid = document.getElementById("miningGrid"); const analysisBody = document.getElementById("analysisResultsBody"); const diagPanel = document.getElementById("diagPanel"); const matrixTitle = document.getElementById("miningMatrixTitle");
  if (analysisSummary) analysisSummary.innerHTML = `<div class="pill">Version: ${escapeHtml(VERSION)}</div><div class="pill">Rows: ${state.cleanedRows.length}</div><div class="pill">Selected: ${escapeHtml(row?.entity || "None")}</div><div class="pill">Logs: ${state.logs.length}</div>`;
  if (!row) {
    if (hint) hint.textContent = "Ingest at least one row, then hit Run."; if (rowCard) rowCard.innerHTML = '<div class="message">No row selected yet.</div>'; if (miningGrid) miningGrid.innerHTML = '<div class="message">No sweep yet.</div>';
  } else if (row.leagueId === "nba") {
    if (hint) hint.textContent = "Phase 2 sweep runs live with logging and fail-safe recovery."; if (rowCard) rowCard.innerHTML = rowCardHtml(row); if (matrixTitle) matrixTitle.textContent = "NBA Full Sweep Factor Matrix";
    ensureNbaMining(row, { state, saveState, requestRender }); if (miningGrid) miningGrid.innerHTML = buildMiningStatus(row).map(renderFactorCard).join("");
  } else {
    if (hint) hint.textContent = "Phase 2 connector sweep is wired for NBA rows only."; if (rowCard) rowCard.innerHTML = rowCardHtml(row); if (miningGrid) miningGrid.innerHTML = '<div class="message">Connector sweep not wired for this league.</div>';
  }
  if (analysisBody) analysisBody.innerHTML = resultsRowsHtml(state.cleanedRows, true);
  if (diagPanel) {
    const logs = row ? state.logs.filter((l) => l.rowId === row.rowId).slice(-20).reverse() : state.logs.slice(-20).reverse();
    diagPanel.innerHTML = logs.length ? logs.map((entry) => `<div class="diag-entry"><div class="diag-key">${escapeHtml(entry.factor)} • ${escapeHtml(entry.level)} • ${escapeHtml(entry.ts)}</div><div class="diag-mini">${escapeHtml(entry.message)}${entry.meta ? " • " + escapeHtml(JSON.stringify(entry.meta)) : ""}</div></div>`).join("") : '<div class="message">No logs yet.</div>';
  }
  bindRowSelection("analysisResultsBody");
}
function safeRenderAnalysis() { try { renderAnalysis(); } catch (err) { console.error(err); showBootError(`Analysis render error: ${err.message || err}`); } }
function applyScreen() { const analysis = window.location.hash === "#analysis"; const intake = document.getElementById("intakeScreen"); const analysisScreen = document.getElementById("analysisScreen"); if (intake) intake.classList.toggle("hidden", analysis); if (analysisScreen) analysisScreen.classList.toggle("hidden", !analysis); }
function buildAnalysisCopyText(row) {
  const cards = buildMiningStatus(row); const lines = ["Run Analysis", `Version: ${VERSION}`, `Day: ${state.dayScope}`, `Rows in pool: ${state.cleanedRows.length}`, `Selected row: ${row ? row.entity : "None"}`, `Standalone: ${row ? row._standaloneProbability ?? "—" : "—"}`, `Relational: ${row ? row._relationalSurvivability ?? "—" : "—"}`, ""];
  cards.forEach((card) => { lines.push(`${card.title} [${card.tier}]`, `${card.statusLabel}`, `Magnitude: ${card.magnitude ?? "—"}`, `Confidence: ${card.confidence ?? "—"}`, `Evidence: ${card.evidence || "—"}`, `Source: ${card.source || "—"}`); if (card.warning) lines.push(`Warning: ${card.warning}`); if (card.recommendation) lines.push(`Recommendation: ${card.recommendation}`); lines.push(""); });
  return lines.join("\n");
}
function onLeagueChecklistChange(event) { const target = event.target; if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return; const id = target.dataset.id; if (!id) return; if (target.checked) { if (!state.selectedLeagueIds.includes(id)) state.selectedLeagueIds.push(id); } else { state.selectedLeagueIds = state.selectedLeagueIds.filter((x) => x !== id); if (!state.selectedLeagueIds.length) state.selectedLeagueIds = ["nba"]; } saveState(); renderLeagues(); renderFeedStatus(); renderRunSummary(); }
function onDayScopeChange(event) { const target = event.target; if (!(target instanceof HTMLInputElement) || target.name !== "dayScope") return; state.dayScope = target.value; saveState(); renderDayScope(); renderRunSummary(); safeRenderAnalysis(); }
function resetStateToDefault() { Object.assign(state, defaultState()); saveState(); }
function bindActions() {
  const clearBtn = document.getElementById("clearBoxBtn"); const resetBtn = document.getElementById("resetAllBtn"); const ingestBtn = document.getElementById("ingestBtn"); const runBtn = document.getElementById("runBtn"); const backBtn = document.getElementById("backBtn"); const copyBtn = document.getElementById("copyBtn"); const leagueWrap = document.getElementById("leagueChecklist"); const dayScopeWrap = document.getElementById("dayScope");
  clearBtn?.addEventListener("click", () => { const bi = document.getElementById("boardInput"); if (bi) bi.value = ""; });
  resetBtn?.addEventListener("click", () => { resetStateToDefault(); const bi = document.getElementById("boardInput"); const msg = document.getElementById("ingestMessage"); if (bi) bi.value = ""; if (msg) { msg.textContent = ""; msg.classList.remove("ok"); } window.location.hash = "#intake"; safeRenderAll(); });
  ingestBtn?.addEventListener("click", () => { const bi = document.getElementById("boardInput"); const msg = document.getElementById("ingestMessage"); const res = ingestText((bi && bi.value) || "", state); pushLog(state, { rowId: "", factor: "ingest", level: res.added > 0 ? "info" : "warn", message: res.message }); if (msg) { msg.textContent = res.added > 0 ? `✅ ${res.message}` : res.message; msg.classList.toggle("ok", res.added > 0); } if (res.added > 0 && bi) bi.value = ""; saveState(); safeRenderAll(); });
  runBtn?.addEventListener("click", () => { state.ran = true; if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId; saveState(); window.location.hash = "#analysis"; safeRenderAll(); });
  backBtn?.addEventListener("click", () => { window.location.hash = "#intake"; applyScreen(); });
  copyBtn?.addEventListener("click", async () => { const row = activeRow(); const hint = document.getElementById("analysisHint"); try { await navigator.clipboard.writeText(buildAnalysisCopyText(row)); if (hint) hint.textContent = "Copied."; } catch { if (hint) hint.textContent = "Copy failed."; } });
  leagueWrap?.addEventListener("change", onLeagueChecklistChange); dayScopeWrap?.addEventListener("change", onDayScopeChange); window.addEventListener("hashchange", applyScreen);
}
function safeRenderAll() { try { renderDayScope(); } catch (err) { console.error(err); } try { renderLeagues(); } catch (err) { console.error(err); } try { renderFeedStatus(); } catch (err) { console.error(err); showBootError(`Feed render error: ${err.message || err}`); } try { renderRunSummary(); } catch (err) { console.error(err); } safeRenderAnalysis(); applyScreen(); }
function boot() { bindActions(); safeRenderAll(); }
window.addEventListener("error", (e) => showBootError(`Runtime error: ${e.message}`)); window.addEventListener("unhandledrejection", (e) => showBootError(`Promise error: ${e.reason?.message || e.reason || "unknown"}`));
if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot, { once: true }); } else { boot(); }
