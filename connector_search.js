import { withTimeout, cleanSnippet } from './utils_core.js';
import { SEARCH_TIMEOUT_MS } from './config_core.js';

async function ddg(query){
  const url = `https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(fetch(url), SEARCH_TIMEOUT_MS, 'search timeout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function searchWebOneQuery(query){
  const text = await ddg(query);
  return { title: query, snippet: cleanSnippet(text).slice(0,500), url:'duckduckgo' };
}
