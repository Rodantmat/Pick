import { withTimeout, cleanSnippet, isGarbageHtml } from './utils_core.js';
import { SEARCH_TIMEOUT_MS } from './config_core.js';

async function ddg(query){
  const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(fetch(url), SEARCH_TIMEOUT_MS, 'search timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
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
    if (/duckduckgo|sign in|subscription|advertis|bettingpros|rotowire news|story\//i.test(joined)) continue;
    if (isGarbageHtml(joined)) continue;
    return { title, snippet: body.slice(0, 500), url };
  }
  return { title: '', snippet: cleanSnippet(text).slice(0, 500), url: 'duckduckgo' };
}

export async function searchWebOneQuery(query){
  const text = await ddg(query);
  const best = extractBestResult(text);
  return { title: best.title || query, snippet: best.snippet || '', url: best.url || 'duckduckgo' };
}
