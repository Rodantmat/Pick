import { withTimeout, cleanSnippet, isGarbageHtml } from "./utils_core.js";
import { SEARCH_TIMEOUT_MS } from "./config_core.js";

function decodeDdgUrl(url="") {
  const s = String(url || "").trim();
  try {
    const u = new URL(s);
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch {}
  return s;
}

async function ddg(query) {
  const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(fetch(url), SEARCH_TIMEOUT_MS, "search timeout");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchResultPage(url) {
  const actual = decodeDdgUrl(url);
  if (!actual || /duckduckgo\.com/i.test(actual)) return "";
  try {
    const proxy = 'https://r.jina.ai/http://' + actual.replace(/^https?:\/\//, '');
    const res = await withTimeout(fetch(proxy), SEARCH_TIMEOUT_MS + 2500, 'search timeout');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    return "";
  }
}

function extractResults(markdown='') {
  const text = String(markdown || '');
  const re = /## \[(.+?)\]\((http[^)]+)\)\s*([\s\S]*?)(?=
## \[|$)/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const title = cleanSnippet(m[1] || '');
    const url = decodeDdgUrl(cleanSnippet(m[2] || ''));
    const body = cleanSnippet((m[3] || '').replace(/Markdown Content:.*/i, ''));
    const joined = `${title} ${body}`.trim();
    if (/at duckduckgo|duckduckgo html|subscribe|advertisement/i.test(joined)) continue;
    if (isGarbageHtml(joined)) continue;
    out.push({ title, snippet: body.slice(0, 1200), url });
  }
  return out;
}

export async function searchWebOneQuery(query) {
  const text = await ddg(query);
  const results = extractResults(text);
  const preferred = results.find(r => /statmuse|espn|basketball-reference|rotowire|nbcsports|fox sports/i.test(`${r.title} ${r.url}`)) || results[0] || { title: query, snippet: '', url: '' };
  const page = preferred.url ? await fetchResultPage(preferred.url) : '';
  return {
    title: preferred.title || query,
    snippet: preferred.snippet || '',
    url: preferred.url || '',
    pageContent: cleanSnippet(page).slice(0, 8000),
    allResults: results.slice(0, 5)
  };
}
