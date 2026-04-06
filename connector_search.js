import { withTimeout, cleanSnippet, isGarbageHtml } from './utils_core.js';
import { SEARCH_TIMEOUT_MS } from './config_core.js';

async function ddg(query){
  const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(fetch(url), SEARCH_TIMEOUT_MS, 'search timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchResultPage(url){
  try {
    const res = await withTimeout(fetch('https://r.jina.ai/http://' + String(url||'').replace(/^https?:\/\//,'')), SEARCH_TIMEOUT_MS + 1500, 'search timeout');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch { return ''; }
}

function extractBestResult(markdown=''){
  const text = String(markdown || '');
  const re = new RegExp(String.raw`## \[(.+?)\]\((http[^)]+)\)\s*([\s\S]*?)(?=\n## \[|$)`, 'g');
  let m;
  while ((m = re.exec(text))) {
    const title = cleanSnippet(m[1] || '');
    const url = cleanSnippet(m[2] || '');
    const body = cleanSnippet((m[3] || '').replace(/Markdown Content:.*/i, ''));
    const joined = `${title} ${body}`.trim();
    if (/duckduckgo|at duckduckgo|sign in|subscription|advertis|story\//i.test(joined)) continue;
    if (isGarbageHtml(joined)) continue;
    return { title, snippet: body.slice(0, 500), url };
  }
  return { title: '', snippet: '', url: 'duckduckgo' };
}

export async function searchWebOneQuery(query){
  const text = await ddg(query);
  const best = extractBestResult(text);
  const page = best.url && best.url !== 'duckduckgo' ? await fetchResultPage(best.url) : '';
  return { title: best.title || query, snippet: best.snippet || '', url: best.url || 'duckduckgo', pageContent: cleanSnippet(page).slice(0, 4000) };
}
