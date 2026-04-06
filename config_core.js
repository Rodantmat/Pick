export const VERSION = 'v5.7.39 modular';
export const SEARCH_TIMEOUT_MS = 5000;
export const FETCH_TIMEOUT_MS = 6500;
export const STORAGE_KEY = 'pickcalc-prompt1-v5-7-39-modular';

export const TYPE_META = {
  REGULAR: {icon:'⚪', label:'Regular'},
  GOBLIN: {icon:'🟢', label:'Goblin'},
  DEMON: {icon:'😈', label:'Demon'},
  TACO: {icon:'🌮', label:'Taco'},
  FREE_PICK: {icon:'🎁', label:'Free Pick'}
};

export const LEAGUES = [
  { id:'nba', label:'NBA', sport:'NBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'wnba', label:'WNBA', sport:'WNBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'cbb', label:'CBB', sport:'CBB', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'nhl', label:'NHL', sport:'NHL', propCatalog:['Goals','Assists','Points','Shots On Goal','Blocked Shots','Saves'] },
  { id:'mlb', label:'MLB', sport:'MLB', propCatalog:['Hits','Runs','RBIs','Bases','Strikeouts','Pitching Outs'] },
  { id:'soccer', label:'Soccer', sport:'SOCCER', propCatalog:['Shots','Shots On Target','Goals','Assists','Passes','Tackles'] },
  { id:'golf', label:'Golf', sport:'GOLF', propCatalog:['Birdies','Pars','Bogeys','Strokes'] },
  { id:'tennis', label:'Tennis', sport:'TENNIS', propCatalog:['Total Games','Break Points Won','Double Faults','Aces','Games Won','Sets Won'] },
  { id:'nfl', label:'NFL', sport:'NFL', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Longest Reception','Touchdowns'] },
  { id:'mma', label:'MMA', sport:'MMA', propCatalog:['Significant Strikes','Takedowns','Fantasy Score'] },
  { id:'ncaaf', label:'NCAAF', sport:'NCAAF', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Touchdowns'] }
];

export const DISPLAY_PROP_ALIASES = {
  '3PTM':['3ptm','3pm','3pt','3 ptm','3pt made','3pt made more','3 pointers made','threes made','three pointers made'],
  'Pts+Rebs+Asts':['pts+rebs+asts','pra','points rebounds assists'],
  'Pts+Rebs':['pts+rebs','points+rebounds','points rebounds','pr'],
  'Pts+Asts':['pts+asts','points+assists','points assists','pa'],
  'Rebs+Asts':['rebs+asts','rebounds+assists','rebounds assists','rebs asts','ra'],
  'Blks+Stls':['blks+stls','stocks','blocks+steals'],
  'Fantasy Score':['fantasy score','fantasy points','fantasy']
};

export const NBA_FACTORS = [
  { key:'last5', title:'Last 5 Games - New', live:true, sources:['ESPN direct','backup search'], note:'Recent 5-game prop average from stable sources only.' },
  { key:'last10', title:'Last 10 Games - New', live:true, sources:['ESPN direct','backup search'], note:'Recent 10-game prop average from stable sources only.' },
  { key:'last20', title:'Last 20 Games - New', live:true, sources:['ESPN direct','backup search'], note:'Recent 20-game prop average from stable sources only.' },
  { key:'season', title:'Season History - New', live:true, sources:['ESPN direct','backup search'], note:'Season prop average from stable sources only.' },
  { key:'career', title:'Career History - New', live:true, sources:['ESPN direct','backup search'], note:'Career prop average using repeatable fallback only.' },
  { key:'matchup', title:'Matchup Context - Paused', live:false, sources:['Paused'], note:'Paused for stable rollout. Will return later after the stable layer is locked.' },
  { key:'odds', title:'Market Odds - Paused', live:false, sources:['Paused'], note:'Paused on card. Projection still derives internally from structured inputs when available.' },
  { key:'projection', title:'Projection Source - New', live:true, sources:['Internal derived','backup search'], note:'Derived projection number using stable sources only.' },
  { key:'minutes', title:'Projected Minutes - New', live:true, sources:['Internal from ESPN history','backup search'], note:'Derived projected minutes from recent history plus status adjustments.' },
  { key:'injury', title:'Injury Report Score - New', live:true, sources:['Official injuries','backup search'], note:'Availability score from stable injury sources.' },
  { key:'starters', title:'Starting Lineup Score - New', live:true, sources:['Official injuries','backup search'], note:'Starter / lineup context from stable sources.' },
  { key:'schedule', title:'Schedule / Fatigue - New', live:true, sources:['NBA CDN scoreboard','backup search'], note:'Rest and recent cadence from stable sources.' },
  { key:'pace', title:'Pace Score - New', live:true, sources:['NBA stats advanced','Basketball-Reference backup'], note:'Tempo / possession environment score from stable source.' },
  { key:'blowout', title:'Blowout Risk - Paused', live:false, sources:['Paused'], note:'Paused for stable rollout.' },
  { key:'oppdef', title:'Opponent Defense Score - New', live:true, sources:['NBA stats advanced','Basketball-Reference backup'], note:'Opponent defensive resistance score from stable source.' },
  { key:'position', title:'Vs-Position Score - Paused', live:false, sources:['Paused'], note:'Paused for stable rollout.' },
  { key:'teammates', title:'Teammate Impact Score - Paused', live:false, sources:['Paused'], note:'Paused for stable rollout.' },
  { key:'homeaway', title:'Home-Away Split Score - New', live:true, sources:['ESPN direct','backup search'], note:'Home / road split score from stable sources only.' },
  { key:'role', title:'Role / Usage Score - Paused', live:false, sources:['Paused'], note:'Paused for stable rollout.' },
  { key:'coverage', title:'Factor Coverage - New', live:true, sources:['Internal factor map'], note:'Shows what is live vs paused in the new rollout.' },
  { key:'validation', title:'Prop-Source Validation - New', live:true, sources:['Ingested row'], note:'Parsed row identity and line are already grounded.' }
];

export const TEAM_TRICODES = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets', CHA:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers', DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons', GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers', LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies', MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves', NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'Oklahoma City Thunder', ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns', POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs', TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards'
};
