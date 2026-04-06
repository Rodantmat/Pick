export function ensureDiagState(row){ row._diag ||= {}; return row._diag; }
export function upsertDiagEntry(row, key, patch){ const d = ensureDiagState(row); d[key] ||= {}; Object.assign(d[key], patch); return d[key]; }
export function finishDiag(row, key, final){ return upsertDiagEntry(row, key, final); }
export function rawPreview(text, n=260){ return String(text||'').replace(/\s+/g,' ').slice(0,n); }
