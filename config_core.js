export const VERSION = 'v5.8.0 Full Recovery';
export const STORAGE_KEY = 'pickcalc-prompt1-v5-7-3';
export const FETCH_TIMEOUT_MS = 7000;
export const SEARCH_TIMEOUT_MS = 8000;

export const TYPE_META = {
  REGULAR: { icon: '⚪', label: 'Regular' },
  GOBLIN: { icon: '🟢', label: 'Goblin' },
  DEMON: { icon: '😈', label: 'Demon' },
  TACO: { icon: '🌮', label: 'Taco' },
  FREE_PICK: { icon: '🎁', label: 'Free Pick' }
};

export const LEAGUES = [
  { id:'nba', label:'NBA', sport:'NBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'wnba', label:'WNBA', sport:'WNBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'cbb', label:'CBB', sport:'CBB', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PTM','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'nfl', label:'NFL', sport:'NFL', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Longest Reception','Touchdowns'] },
  { id:'ncaaf', label:'NCAAF', sport:'NCAAF', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Touchdowns'] },
  { id:'mlb', label:'MLB', sport:'MLB', propCatalog:['Hits','Runs','RBIs','Bases','Strikeouts','Pitching Outs'] },
  { id:'nhl', label:'NHL', sport:'NHL', propCatalog:['Goals','Assists','Points','Shots On Goal','Blocked Shots','Saves'] },
  { id:'soccer', label:'Soccer', sport:'SOCCER', propCatalog:['Shots','Shots On Target','Goals','Assists','Passes','Tackles'] },
  { id:'tennis', label:'Tennis', sport:'TENNIS', propCatalog:['Total Games','Break Points Won','Double Faults','Aces','Games Won','Sets Won'] },
  { id:'golf', label:'Golf', sport:'GOLF', propCatalog:['Birdies','Pars','Bogeys','Strokes'] },
  { id:'mma', label:'MMA', sport:'MMA', propCatalog:['Significant Strikes','Takedowns','Fantasy Score'] }
];

export const DISPLAY_PROP_ALIASES = {
  '3PTM':['3ptm','3pm','3pt','3 ptm','3pt made','3 pointers made','threes made','three pointers made'],
  'Pts+Rebs+Asts':['pts+rebs+asts','points rebounds assists'],
  'PRA':['pra'],
  'Pts+Rebs':['pts+rebs','points+rebounds','points rebounds','pr'],
  'Pts+Asts':['pts+asts','points+assists','points assists','pa'],
  'Rebs+Asts':['rebs+asts','rebounds+assists','rebounds assists','ra'],
  'Blks+Stls':['blks+stls','stocks','blocks+steals'],
  'Fantasy Score':['fantasy score','fantasy points','fantasy'],
  'Shots On Goal':['sog']
};

export const NBA_FACTORS = [
  { key:'last5', title:'Last 5 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 5-game prop average.' },
  { key:'last10', title:'Last 10 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 10-game prop average.' },
  { key:'last20', title:'Last 20 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 20-game prop average.' },
  { key:'season', title:'Season History', live:true, sources:['ESPN direct','backup search'], note:'Season prop average.' },
  { key:'career', title:'Career History', live:true, sources:['backup search'], note:'Career prop average.' },
  { key:'projection', title:'Projection Source', live:true, sources:['Internal derived','backup search'], note:'Derived projection number.' },
  { key:'minutes', title:'Projected Minutes', live:true, sources:['ESPN direct','backup search'], note:'Derived projected minutes.' },
  { key:'injury', title:'Injury Report Score', live:true, sources:['Official injuries','backup search'], note:'Availability score.' },
  { key:'starters', title:'Starting Lineup Score', live:true, sources:['Official injuries','backup search'], note:'Starter / lineup context.' },
  { key:'schedule', title:'Schedule / Fatigue', live:true, sources:['NBA scoreboard','backup search'], note:'Rest and recent cadence.' },
  { key:'pace', title:'Pace Score', live:true, sources:['NBA advanced','Basketball-Reference backup'], note:'Tempo / possession environment.' },
  { key:'oppdef', title:'Opponent Defense Score', live:true, sources:['NBA advanced','Basketball-Reference backup'], note:'Opponent defensive resistance.' },
  { key:'homeaway', title:'Home-Away Split Score', live:true, sources:['ESPN direct','backup search'], note:'Home / road split score.' },
  { key:'coverage', title:'Factor Coverage', live:true, sources:['Internal factor map'], note:'Shows what is live.' },
  { key:'validation', title:'Prop-Source Validation', live:true, sources:['Ingested row'], note:'Parsed row identity and line.' }
];

export const TEAM_TRICODES = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets', CHA:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers', DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons', GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers', LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies', MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves', NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'Oklahoma City Thunder', ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns', POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs', TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards'
};
