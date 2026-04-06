import { LEAGUES, DISPLAY_PROP_ALIASES } from './config_core.js';
import { canon, norm } from './utils_core.js';

function buildPropLookup(){
  const entries=[];
  for (const league of LEAGUES){
    for (const prop of league.propCatalog){
      const keys=[canon(prop), ...((DISPLAY_PROP_ALIASES[prop]||[]).map(canon))];
      [...new Set(keys)].forEach(key=>entries.push({leagueId:league.id, prop, key}));
    }
  }
  return entries.sort((a,b)=>b.key.length-a.key.length);
}
const PROP_LOOKUP = buildPropLookup();

function dedupeRepeatedEntity(name=''){
  const raw = norm(name).trim();
  if (!raw) return '';
  const repeated = raw.match(/^(.+?)\s{2,}\1$/i);
  if (repeated) return repeated[1].trim();
  const tokens = raw.split(/\s+/);
  if (tokens.length >= 4 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    if (tokens.slice(0,half).join(' ').toLowerCase() === tokens.slice(half).join(' ').toLowerCase()) {
      return tokens.slice(0,half).join(' ');
    }
  }
  return raw;
}

export function normalizeNbaPropFamily(prop=''){
  const p = canon(prop);
  if (/\b3\s*pt|\b3pt|\b3pm|three/.test(p)) return '3PTM';
  if (p==='pra' || p.includes('points rebounds assists') || p.includes('pts+rebs+asts')) return 'PRA';
  if (p==='pr' || p.includes('points rebounds') || p.includes('pts+rebs')) return 'Pts+Rebs';
  if (p==='pa' || p.includes('points assists') || p.includes('pts+asts')) return 'Pts+Asts';
  if (p==='ra' || p.includes('rebounds assists') || p.includes('rebs+asts')) return 'Rebs+Asts';
  if (p.includes('fantasy')) return 'Fantasy Score';
  if (p.includes('rebound')) return 'Rebounds';
  if (p.includes('assist')) return 'Assists';
  if (p.includes('point')) return 'Points';
  return prop;
}

function canonicalCatalogProp(leagueId, prop=''){
  const c = canon(prop);
  const exact = PROP_LOOKUP.find(x=>x.leagueId===leagueId && x.key===c);
  if (exact) return exact.prop;
  if (['nba','wnba','cbb'].includes(leagueId)) return normalizeNbaPropFamily(prop);
  return prop;
}

function detectType(line){
  const s = canon(line);
  if (s.includes('goblin')) return 'GOBLIN';
  if (s.includes('demon')) return 'DEMON';
  if (s.includes('taco')) return 'TACO';
  if (s.includes('free pick')) return 'FREE_PICK';
  return 'REGULAR';
}

function splitChunks(text){
  return norm(text).replace(/([a-z])([A-Z][a-z])/g,'$1\n$2').split(/\n{2,}|\r\n\r\n/).map(s=>s.trim()).filter(Boolean);
}

function extractOpponent(text){ const m = text.match(/\bvs\s+([A-Z]{2,4})\b/i); return m?m[1].toUpperCase():''; }
function extractTeam(text){ const m = text.match(/\b([A-Z]{2,4})\s*-\s*[A-Z]\b/); return m?m[1].toUpperCase():''; }
function extractLine(text){ const m = text.match(/\b(\d+(?:\.\d+)?)\b(?=\s+(?:3PTM|3PT|Points|Rebounds|Assists|PRA|Rebs\+Asts|Pts\+Asts|Pts\+Rebs|Fantasy))/i) || text.match(/\b(\d+(?:\.\d+)?)\b/); return m?m[1]:''; }

function extractProp(text){
  const candidates = ['3PTM','Rebs+Asts','Pts+Asts','Pts+Rebs','Fantasy Score','Rebounds','Assists','Points','PRA'];
  const lower = canon(text);
  for (const c of candidates){ if (lower.includes(canon(c))) return c; }
  if (/\b3\s*pt|\b3pt|\b3pm/i.test(text)) return '3PTM';
  return '';
}

function extractPlayer(text){
  const cleaned = text
    .replace(/Goblin|Demon|Regular|Taco|Free Pick|More/gi,' ')
    .replace(/\bvs\b[\s\S]*$/i,' ')
    .replace(/\b[A-Z]{2,4}\s*-\s*[A-Z]\b/g,' ');
  const lines = cleaned.split(/\n/).map(s=>s.trim()).filter(Boolean);
  let best = lines.find(l => /^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){1,3}$/.test(l));
  if (best) return dedupeRepeatedEntity(best);
  const m = cleaned.match(/([A-Z][a-z'.-]+\s+[A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)*)/);
  return m ? dedupeRepeatedEntity(m[1].trim()) : '';
}

function parseChunk(chunk, idx, selectedLeagueIds){
  const text = chunk.replace(/([a-z])([A-Z][a-z])/g,'$1\n$2');
  const leagueId = selectedLeagueIds.find(id=>['nba','wnba','cbb'].includes(id)) || 'nba';
  const prop = canonicalCatalogProp(leagueId, extractProp(text));
  if (!prop) return null;
  const entity = dedupeRepeatedEntity(extractPlayer(text));
  if (!entity) return null;
  const line = extractLine(text);
  const team = extractTeam(text);
  const opponent = extractOpponent(text);
  const type = detectType(text);
  return {
    rowId: `r${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`,
    sport:(leagueId==='wnba'?'WNBA':leagueId==='cbb'?'CBB':'NBA'), leagueId, entity, team, opponent,
    propFamily: prop,
    propKey: canon(prop),
    line: line || '',
    lineText: `${prop} ${line || ''}`.trim(),
    type, rawChunk: chunk
  };
}

export function ingestText(text, state){
  const chunks = splitChunks(text);
  const addedRows=[];
  chunks.forEach((chunk, idx)=>{
    const row = parseChunk(chunk, idx, state.selectedLeagueIds);
    if (row) addedRows.push(row);
  });
  if (!addedRows.length) return { added:0, message:'No recognizable rows found for the leagues you selected. Try one clean chunk from one board section, or check that the right league is selected.' };
  state.cleanedRows.push(...addedRows);
  if (!state.activeRowId && state.cleanedRows[0]) state.activeRowId = state.cleanedRows[0].rowId;
  return { added: addedRows.length, message:`Ingested ${addedRows.length} clean row${addedRows.length===1?'':'s'}.` };
}
