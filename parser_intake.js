import { LEAGUES, DISPLAY_PROP_ALIASES } from './config_core.js';
import { canon, norm } from './utils_core.js';

function buildPropLookup() {
  const entries = [];
  for (const league of LEAGUES) {
    for (const prop of league.propCatalog) {
      const aliasList = DISPLAY_PROP_ALIASES[prop] || [];
      const keys = [prop, ...aliasList].map(canon).filter(Boolean);
      [...new Set(keys)].forEach((key) => {
        entries.push({ leagueId: league.id, prop, key });
      });
    }
  }
  entries.sort((a, b) => b.key.length - a.key.length);
  return entries;
}

const PROP_LOOKUP = buildPropLookup();

function dedupeRepeatedEntity(name = '') {
  const raw = norm(name);
  if (!raw) return '';

  const repeated = raw.match(/^(.+?)\s{2,}\1$/i);
  if (repeated) return norm(repeated[1]);

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4 && tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    const a = tokens.slice(0, half).join(' ');
    const b = tokens.slice(half).join(' ');
    if (canon(a) === canon(b)) return a;
  }

  return raw;
}

export function normalizeNbaPropFamily(prop = '') {
  const p = canon(prop);
  if (!p) return '';

  if (/\b3\s*ptm\b|\b3ptm\b|\b3pm\b|\b3pt\b|\b3 pointers made\b|\bthree pointers made\b|\bthrees made\b/.test(p)) return '3PT Made';
  if (p === 'pts+rebs+asts' || p === 'points rebounds assists') return 'Pts+Rebs+Asts';
  if (p === 'pra') return 'PRA';
  if (p === 'pts+rebs' || p === 'points rebounds' || p === 'pr') return 'Pts+Rebs';
  if (p === 'pts+asts' || p === 'points assists' || p === 'pa') return 'Pts+Asts';
  if (p === 'rebs+asts' || p === 'rebounds assists' || p === 'ra') return 'Rebs+Asts';
  if (p.includes('fantasy')) return 'Fantasy Score';
  if (p.includes('blocks') && p.includes('steals')) return 'Blks+Stls';
  if (p.includes('turnover')) return 'Turnovers';
  if (p.includes('rebound')) return 'Rebounds';
  if (p.includes('assist')) return 'Assists';
  if (p.includes('point')) return 'Points';
  if (p.includes('block')) return 'Blocks';
  if (p.includes('steal')) return 'Steals';

  return prop;
}

function detectType(text = '') {
  const t = canon(text);
  if (/free[ _-]?pick/.test(t)) return 'FREE_PICK';
  if (t.includes('taco')) return 'TACO';
  if (t.includes('demon')) return 'DEMON';
  if (t.includes('goblin')) return 'GOBLIN';
  return 'REGULAR';
}

function findLeague(id) {
  return LEAGUES.find((x) => x.id === id) || null;
}

function buildRowId(leagueId, entity, team, prop, line, type, opponent = '') {
  return [
    leagueId,
    canon(entity),
    canon(team),
    canon(opponent),
    canon(prop),
    String(line || '').trim(),
    type
  ].join('|');
}

function splitIntoBlocks(text = '') {
  const cleaned = String(text || '')
    .replace(/\r/g, '')
    .replace(/[•●▪]/g, ' ')
    .replace(/Trending\s+\d+(?:\.\d+)?K/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?K\b/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const lines = cleaned
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  const blocks = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current.join('\n').trim());
      current = [];
    }
  };

  for (const line of lines) {
    current.push(line);
    if (/(?:\bLess\b\s*\bMore\b|\bMore\b\s*\bLess\b|\bMore\b|\bLess\b)$/i.test(line)) flush();
  }

  flush();
  return blocks.filter(Boolean);
}

function findPropCandidates(text, selectedIds) {
  const hay = canon(text);
  const allowed = new Set(selectedIds || []);
  const matches = [];

  for (const entry of PROP_LOOKUP) {
    if (!allowed.has(entry.leagueId)) continue;
    const idx = hay.indexOf(entry.key);
    if (idx >= 0) matches.push({ ...entry, idx });
  }

  matches.sort((a, b) => {
    if (b.key.length !== a.key.length) return b.key.length - a.key.length;
    return a.idx - b.idx;
  });

  return matches;
}

function canonicalCatalogProp(leagueId, prop = '') {
  const c = canon(prop);
  if (!c) return '';

  const exact = PROP_LOOKUP.find((x) => x.leagueId === leagueId && x.key === c);
  if (exact) return exact.prop;

  if (['nba', 'wnba', 'cbb'].includes(leagueId)) {
    const normalized = normalizeNbaPropFamily(prop);
    const exactNormalized = PROP_LOOKUP.find((x) => x.leagueId === leagueId && x.key === canon(normalized));
    return exactNormalized ? exactNormalized.prop : normalized;
  }

  return prop;
}

function inferLeagueFromProp(prop, block, selectedIds) {
  const propCanon = canon(prop);
  const candidates = PROP_LOOKUP.filter((x) => x.key === propCanon && (selectedIds || []).includes(x.leagueId));
  if (candidates.length === 1) return candidates[0].leagueId;

  const low = canon(block);

  if (prop.includes('MAP') && (selectedIds || []).includes('esports-cs2')) return 'esports-cs2';
  if (['Total Games', 'Double Faults', 'Break Points Won', 'Aces', 'Games Won', 'Sets Won'].includes(prop)) return (selectedIds || []).includes('tennis') ? 'tennis' : candidates[0]?.leagueId;
  if (['Goalie Saves', 'Passes Attempted', 'Shots Assisted', 'Attempted Dribbles', 'Shots', 'Shots On Target', 'Tackles Won'].includes(prop)) return (selectedIds || []).includes('soccer') ? 'soccer' : candidates[0]?.leagueId;
  if (['Points', 'Rebounds', 'Assists', 'Pts+Rebs', 'Pts+Asts', 'Rebs+Asts', 'PRA', 'Pts+Rebs+Asts', '3PT Made', 'Blocks', 'Steals', 'Fantasy Score', 'Blks+Stls', 'Turnovers'].includes(prop)) {
    if ((selectedIds || []).includes('nba')) return 'nba';
    if ((selectedIds || []).includes('wnba')) return 'wnba';
    if ((selectedIds || []).includes('cbb')) return 'cbb';
  }
  if (['Passing Yards', 'Rushing Yards', 'Receiving Yards', 'Receptions', 'Rush Attempts', 'Touchdowns'].includes(prop)) {
    if ((selectedIds || []).includes('nfl')) return 'nfl';
    if ((selectedIds || []).includes('cfb')) return 'cfb';
  }
  if (['Hits', 'Total Bases', 'Pitcher Strikeouts', 'Runs', 'RBIs', 'Outs Recorded', 'Home Runs', 'Hits Allowed'].includes(prop)) return (selectedIds || []).includes('mlb') ? 'mlb' : candidates[0]?.leagueId;
  if (['Shots on Goal', 'Goalie Saves', 'Goals', 'Assists', 'Points', 'Blocked Shots', 'Hits'].includes(prop)) return (selectedIds || []).includes('nhl') ? 'nhl' : candidates[0]?.leagueId;
  if (['Birdies or Better', 'Strokes', 'Pars', 'Bogeys'].includes(prop)) return (selectedIds || []).includes('golf') ? 'golf' : candidates[0]?.leagueId;
  if (['Significant Strikes', 'Takedowns', 'Fight Time'].includes(prop)) return (selectedIds || []).includes('ufc') ? 'ufc' : candidates[0]?.leagueId;
  if (/\bmap\b|headshots|kills/.test(low) && (selectedIds || []).includes('esports-cs2')) return 'esports-cs2';

  return candidates[0]?.leagueId || null;
}

function normalizePhoneTennisBlock(text = '') {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length >= 6 && / - Player$/i.test(lines[1] || '')) {
    const top = norm(lines[0]);
    const card = norm((lines[1] || '').replace(/\s*-\s*Player\s*$/i, ''));
    if (top && card && canon(top) === canon(card)) lines.shift();
  }

  return lines.join('\n');
}

function makeRow({ entity, team, opponent = '', prop, line, leagueId, type, raw }) {
  const sport = findLeague(leagueId)?.sport || '';
  const normalizedEntity = dedupeRepeatedEntity(entity);
  const normalizedTeam = norm(team);
  const normalizedOpponent = norm(opponent);
  const normalizedProp = canonicalCatalogProp(leagueId, prop);
  const lineText = `${normalizedProp} ${line}`.trim();

  return {
    rowId: buildRowId(leagueId, normalizedEntity, normalizedTeam, normalizedProp, line, type, normalizedOpponent),
    sport,
    leagueId,
    entity: normalizedEntity,
    team: normalizedTeam,
    opponent: normalizedOpponent,
    propFamily: normalizedProp,
    propKey: canon(normalizedProp),
    line: String(line || '').trim(),
    lineText,
    type,
    rawText: raw
  };
}

function parsePhoneTennisBlock(block, selectedIds) {
  if (!(selectedIds || []).includes('tennis')) return null;

  const normalized = normalizePhoneTennisBlock(block);
  const lines = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length < 6) return null;
  if (!/ - Player$/i.test(lines[0])) return null;

  const entity = norm(lines[1] || lines[0].replace(/\s*-\s*Player\s*$/i, ''));
  const canonicalEntity = canon(entity);

  let idx = 2;
  while (idx < lines.length && canon(lines[idx]) === canonicalEntity) idx += 1;

  const oppLine = norm(lines[idx] || '');
  const lineNum = (lines[idx + 1] || '').match(/(\d+(?:\.\d+)?)/)?.[1] || '';
  const prop = norm(lines[idx + 2] || '');
  if (!entity || !oppLine || !lineNum || !prop) return null;
  if (!/\b(vs|@)\b/i.test(oppLine)) return null;

  const opp = oppLine.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  const opponent = opp ? norm(opp[1]) : '';

  return makeRow({
    entity,
    team: '',
    opponent,
    prop,
    line: lineNum,
    leagueId: 'tennis',
    type: detectType(block),
    raw: normalized
  });
}

function parsePhoneStatBlock(block, selectedIds) {
  const lines = String(block || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(norm)
    .filter(Boolean);

  if (lines.length < 5) return null;

  let start = 0;
  while (
    start < lines.length &&
    !/^[A-Z]{2,4}\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|Guard|Center|F|G|C|F-G|G-F|F-C|C-F|G-C)\b/i.test(lines[start])
  ) {
    start += 1;
  }
  if (start >= lines.length) return null;

  const teamRole = norm(lines[start] || '');
  const teamMatch = teamRole.match(/^([A-Z]{2,4})\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|Guard|Center|F|G|C|F-G|G-F|F-C|C-F|G-C)\b/i);
  if (!teamMatch) return null;

  const team = norm(teamMatch[1] || '');
  const entity = dedupeRepeatedEntity(lines[start + 1] || '');
  if (!entity) return null;

  let idx = start + 2;
  const entityCanon = canon(entity);
  while (idx < lines.length && canon(lines[idx]) === entityCanon) idx += 1;

  const oppLine = norm(lines[idx] || '');
  const lineNum = (lines[idx + 1] || '').match(/(\d+(?:\.\d+)?)/)?.[1] || '';
  const prop = norm(lines[idx + 2] || '');
  if (!oppLine || !lineNum || !prop) return null;
  if (!/(?:\bvs\b|@)/i.test(oppLine)) return null;

  const leagueId = inferLeagueFromProp(prop, block, selectedIds);
  if (!leagueId) return null;

  const opp = oppLine.match(/(?:\bvs\b|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+:\d+(?:am|pm)\b|\s+\d+m|\s+\d+h|$)/i);
  const opponent = opp ? norm(opp[1]) : '';

  return makeRow({
    entity,
    team,
    opponent,
    prop,
    line: lineNum,
    leagueId,
    type: detectType(block),
    raw: norm(block)
  });
}

function parseDesktopLine(line, selectedIds) {
  const cols = String(line || '')
    .split(/\t+/)
    .map(norm)
    .filter(Boolean);

  if (cols.length < 3) return null;

  const raw = cols.join(' ');
  const propMatch = findPropCandidates(raw, selectedIds)[0];
  if (!propMatch) return null;

  const prop = propMatch.prop;
  const leagueId = inferLeagueFromProp(prop, raw, selectedIds);
  if (!leagueId) return null;

  const low = raw.toLowerCase();
  const propIdx = low.lastIndexOf(prop.toLowerCase());
  const beforeProp = propIdx >= 0 ? raw.slice(0, propIdx).trim() : raw;
  const lineNum = (beforeProp.match(/(\d+(?:\.\d+)?)\s*$/) || [])[1] || '';

  const team = norm((cols[1] || '').split(' - ')[0] || '');
  const entity = dedupeRepeatedEntity((cols[0] || '').replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig, '').trim());
  const oppMatch = raw.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  const opponent = oppMatch ? norm(oppMatch[1]) : '';

  if (!entity) return null;

  return makeRow({
    entity,
    team,
    opponent,
    prop,
    line: lineNum,
    leagueId,
    type: detectType(raw),
    raw
  });
}

function parseBlock(block, selectedIds) {
  const tennisRow = parsePhoneTennisBlock(block, selectedIds);
  if (tennisRow) return tennisRow;

  const phoneStatRow = parsePhoneStatBlock(block, selectedIds);
  if (phoneStatRow) return phoneStatRow;

  const raw = norm(block);
  const propMatch = findPropCandidates(raw, selectedIds)[0];
  if (!propMatch) return null;

  const prop = propMatch.prop;
  const leagueId = inferLeagueFromProp(prop, raw, selectedIds);
  if (!leagueId) return null;

  const low = raw.toLowerCase();
  const propIdx = low.lastIndexOf(prop.toLowerCase());
  const beforeProp = propIdx >= 0 ? raw.slice(0, propIdx).trim() : raw;
  const lineNum = (beforeProp.match(/(\d+(?:\.\d+)?)\s*$/) || [])[1] || '';

  let entity = '';
  let team = '';
  let opponent = '';

  const teamRoleName = raw.match(/([A-Za-z0-9'().&\- ]+)\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|Guard|Center|F|G|C|F-G|G-F|F-C|C-F|G-C)\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
  if (teamRoleName) {
    team = norm(teamRoleName[1]);
    entity = dedupeRepeatedEntity(teamRoleName[2]);
  }

  if (!entity) {
    const abbrThenName = raw.match(/\b([A-Z]{2,4})\s-\s[A-Z-]+\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
    if (abbrThenName) {
      team = norm(abbrThenName[1]);
      entity = dedupeRepeatedEntity(abbrThenName[2]);
    }
  }

  if (!entity) {
    const namedRole = raw.match(/([A-Za-z0-9'().&\- ]+?)\s+(?:Goblin|Demon|Taco|Free Pick)?\s*([A-Za-z0-9'().&\- ]+)\s-\sPlayer\s+([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s/i);
    if (namedRole) entity = dedupeRepeatedEntity(namedRole[3] || namedRole[1]);
  }

  if (!entity) {
    const simpleVs = raw.match(/([A-Za-z0-9'().&\- ]+?)\s+(?:vs|@)\s+[A-Za-z0-9'().&\- ]+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|\d+m)/i);
    if (simpleVs) entity = dedupeRepeatedEntity(simpleVs[1].replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig, ''));
  }

  if (!entity) {
    const words = raw.split(/\s+/).slice(0, 5).join(' ');
    entity = dedupeRepeatedEntity(words.replace(/\b(Goblin|Demon|Taco|Free Pick)\b/ig, '').trim());
  }

  if (!team) {
    const teamFirst = raw.match(/^([A-Za-z0-9'().&\- ]+)\s-\s(?:Player|Attacker|Defender|Midfielder|Goalkeeper|Forward|F|G|C|F-G|G-F|F-C|C-F|G-C)\b/i);
    if (teamFirst) team = norm(teamFirst[1]);
  }

  const oppMatch = raw.match(/\b(?:vs|@)\s+(.+?)(?:\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\s+\d+m|\s+\d+h|$)/i);
  if (oppMatch) opponent = norm(oppMatch[1]);

  if (!entity) return null;

  return makeRow({
    entity,
    team,
    opponent,
    prop,
    line: lineNum,
    leagueId,
    type: detectType(raw),
    raw
  });
}

function dedupeRows(rows = []) {
  const seen = new Map();
  for (const row of rows) {
    if (!row || !row.rowId) continue;
    if (!seen.has(row.rowId)) seen.set(row.rowId, row);
  }
  return [...seen.values()];
}

export function ingestText(text, state) {
  const selectedIds = Array.isArray(state?.selectedLeagueIds) ? [...state.selectedLeagueIds] : [];
  if (!selectedIds.length) {
    return { added: 0, message: 'Select at least one league first.' };
  }

  const found = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n');

  for (const line of lines) {
    if (line.includes('\t')) {
      const row = parseDesktopLine(line, selectedIds);
      if (row) found.push(row);
    }
  }

  const nonTabText = lines.filter((x) => !x.includes('\t')).join('\n');
  const blocks = splitIntoBlocks(nonTabText);

  for (const block of blocks) {
    const row = parseBlock(block, selectedIds);
    if (row) found.push(row);
  }

  const existing = new Map((state.cleanedRows || []).map((r) => [r.rowId, r]));
  let added = 0;

  for (const row of dedupeRows(found)) {
    if (!existing.has(row.rowId)) {
      existing.set(row.rowId, row);
      added += 1;
    }
  }

  state.cleanedRows = [...existing.values()].sort((a, b) => {
    return (
      String(a.sport || '').localeCompare(String(b.sport || '')) ||
      String(a.leagueId || '').localeCompare(String(b.leagueId || '')) ||
      String(a.entity || '').localeCompare(String(b.entity || '')) ||
      String(a.lineText || '').localeCompare(String(b.lineText || ''))
    );
  });

  if (!state.activeRowId && state.cleanedRows.length) state.activeRowId = state.cleanedRows[0].rowId;

  if (!added) {
    return {
      added: 0,
      message: 'No recognizable rows found for the leagues you selected. Try one clean chunk from one board section, or check that the right league is selected.'
    };
  }

  return {
    added,
    message: `Ingested ${added} clean row${added === 1 ? '' : 's'}.`
  };
}
