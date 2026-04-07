import { withTimeout, cleanSnippet, isGarbageHtml, canon, jinaUrl } from './utils_core.js';
import { SEARCH_TIMEOUT_MS } from './config_core.js';

function decodeSearchHref(url = '') {
  const s = String(url || '').trim();
  try {
    const u = new URL(s);
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {}
  return s;
}
function parseDuckResults(markdown = '') {
  const text = String(markdown || '');
  const out = [];
  const re = /## \[(.+?)\]\((http[^)]+)\)\s*([\s\S]*?)(?=\n## \[|$)/g;
  let m;
  while ((m = re.exec(text))) {
    const title = cleanSnippet(m[1] || '');
    const href = decodeSearchHref(m[2] || '');
    const snippet = cleanSnippet(String(m[3] || '').replace(/Markdown Content:.*/i, ''));
    const blob = `${title} ${snippet}`;
    if (!title && !snippet) continue;
    if (/duckduckgo|advertisement|subscribe now/i.test(blob)) continue;
    if (isGarbageHtml(blob)) continue;
    out.push({ title, href, snippet: snippet.slice(0, 1400) });
  }
  return out.slice(0, 8);
}
async function fetchText(url, timeoutMs = SEARCH_TIMEOUT_MS + 500) {
  const res = await withTimeout(fetch(url), timeoutMs, 'search timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
export async function searchWeb(query) {
  const ddgUrl = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const text = await fetchText(ddgUrl);
  return { provider: 'duckduckgo', query, results: parseDuckResults(text) };
}
export async function fetchSearchPage(url) {
  const actual = decodeSearchHref(url);
  if (!actual) return '';
  try { return await fetchText(jinaUrl(actual), SEARCH_TIMEOUT_MS + 2500); } catch { return ''; }
}
export function reliabilityForUrl(url = '') {
  const c = canon(url);
  if (/espn|nba\.com|rotowire|covers|fantasydata|statmuse|basketball-reference/.test(c)) return 0.92;
  if (/cbssports|foxsports|actionnetwork|oddschecker|oddsportal/.test(c)) return 0.76;
  return 0.58;
}
export function inferFreshnessScore(blob = '') {
  const text = String(blob || '');
  if (/today|tonight|expected lineup|injury report|updated/i.test(text)) return 0.95;
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text)) return 0.78;
  return 0.62;
}
export async function searchAndExtract(query, opts = {}) {
  const search = await searchWeb(query);
  const preferred = (search.results || []).find((r) => {
    const blob = `${r.title} ${r.href}`;
    return (opts.prefer || []).some((term) => canon(blob).includes(canon(term)));
  }) || search.results?.[0] || null;
  if (!preferred) return { query, result: null, pageContent: '', confidence: 0, reliability: 0, freshness: 0 };
  const pageContent = await fetchSearchPage(preferred.href);
  const reliability = reliabilityForUrl(preferred.href);
  const freshness = inferFreshnessScore(`${preferred.title} ${preferred.snippet} ${pageContent.slice(0, 1200)}`);
  const confidence = Math.round(((reliability * 0.65) + (freshness * 0.35)) * 100);
  return { query, result: preferred, pageContent: cleanSnippet(pageContent).slice(0, 12000), reliability, freshness, confidence };
}
