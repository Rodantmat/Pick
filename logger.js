export function createLogEntry({ rowId = '', factor = 'system', level = 'info', message = '', meta = null }) {
  return { ts: new Date().toISOString(), rowId, factor, level, message, meta: meta || null };
}
export function pushLog(state, entryLike) {
  if (!state) return null;
  state.logs ||= [];
  const entry = createLogEntry(entryLike || {});
  state.logs.push(entry);
  if (state.logs.length > 500) state.logs = state.logs.slice(-500);
  return entry;
}
export function logFetchStart(state, rowId, factor, url) { return pushLog(state, { rowId, factor, level: 'info', message: 'fetch:start', meta: { url } }); }
export function logFetchSuccess(state, rowId, factor, url, extra = {}) { return pushLog(state, { rowId, factor, level: 'info', message: 'fetch:success', meta: { url, ...extra } }); }
export function logFetchFailure(state, rowId, factor, url, error) { return pushLog(state, { rowId, factor, level: 'warn', message: 'fetch:failure', meta: { url, error: String(error && error.message || error) } }); }
export function logSkip(state, rowId, factor, reason, meta = {}) { return pushLog(state, { rowId, factor, level: 'info', message: 'logic:skip', meta: { reason, ...meta } }); }
export function logParseError(state, rowId, factor, error, source = '') { return pushLog(state, { rowId, factor, level: 'warn', message: 'parse:error', meta: { source, error: String(error && error.message || error) } }); }
