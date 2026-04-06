export function norm(s=''){ return String(s).replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u00A0/g,' ').replace(/￼/g,' ').replace(/\s+/g,' ').trim(); }
export function canon(s=''){ return norm(s).toLowerCase(); }
export function escapeHtml(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
export function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
export function clampNumber(n,min,max){ if(!Number.isFinite(n)) return null; return Math.max(min, Math.min(max, n)); }
export function cleanSnippet(s=''){ return String(s).replace(/\s+/g,' ').trim(); }
export function shortDate(dateStr){ try { const d = new Date(dateStr); if (Number.isNaN(d.getTime())) return ''; return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});} catch { return ''; } }
export async function withTimeout(promise, ms, label='timeout'){ let t; const timeout = new Promise((_,rej)=>{ t=setTimeout(()=>rej(new Error(label)), ms); }); try { return await Promise.race([promise, timeout]); } finally { clearTimeout(t); } }
export function parseMinutesValue(v){ if (typeof v === 'number') return v; const s = String(v||'').trim(); if (!s) return null; const m = s.match(/^(\d+):(\d+)$/); if (m) return Number(m[1]) + Number(m[2])/60; const n = Number(s); return Number.isFinite(n) ? n : null; }
export function average(arr){ const nums = arr.map(Number).filter(Number.isFinite); if (!nums.length) return null; return nums.reduce((a,b)=>a+b,0)/nums.length; }
export function sum(arr){ const nums = arr.map(Number).filter(Number.isFinite); return nums.reduce((a,b)=>a+b,0); }
export function normalizePlayerName(name=''){ return canon(name).replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[.'-]/g,' ').replace(/\s+/g,' ').trim(); }
export function normalizeTeamName(name=''){ return canon(name).replace(/^\d+\.\s+/,'').replace(/\b(los angeles|la|new york|oklahoma city|golden state|san antonio|new orleans|portland|phoenix|philadelphia|washington|orlando|indiana|sacramento|brooklyn|charlotte|chicago|cleveland|dallas|denver|detroit|houston|memphis|miami|milwaukee|minnesota|toronto|utah|atlanta|boston)\b/g,'').replace(/\s+/g,' ').trim(); }
export function fuzzyIncludesName(text, name){ const a = normalizePlayerName(text); const b = normalizePlayerName(name); return a.includes(b) || b.split(' ').every(p=>a.includes(p)); }
export function numericMatches(text){ return [...String(text||'').matchAll(/\b\d+(?:\.\d+)?\b/g)].map(m=>Number(m[0])); }
export function isGarbageHtml(text=''){ const t = String(text||''); return /webpack|window\.performance|<!doctype html|<html/i.test(t); }
export function dedupe(arr){ return [...new Set(arr)]; }
export function titleCase(s=''){ return String(s).toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()); }

export function jinaUrl(url=''){ return 'https://r.jina.ai/http://' + String(url||'').replace(/^https?:\/\//,''); }
