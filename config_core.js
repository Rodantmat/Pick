export const VERSION = 'v5.8.0 Full Fix';
export const SEARCH_TIMEOUT_MS = 5000;
export const FETCH_TIMEOUT_MS = 7000;
export const STORAGE_KEY = 'pickcalc-prompt1-v5-7-3';

export const TYPE_META = {
  REGULAR: {icon:'⚪', label:'Regular'},
  GOBLIN: {icon:'🟢', label:'Goblin'},
  DEMON: {icon:'😈', label:'Demon'},
  TACO: {icon:'🌮', label:'Taco'},
  FREE_PICK: {icon:'🎁', label:'Free Pick'}
};

export const LEAGUES = [
  { id:'nba', label:'NBA', sport:'NBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'wnba', label:'WNBA', sport:'WNBA', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'cbb', label:'CBB', sport:'CBB', propCatalog:['Points','Rebounds','Assists','Pts+Rebs','Pts+Asts','Rebs+Asts','PRA','Pts+Rebs+Asts','3PT Made','Fantasy Score','Blocks','Steals','Blks+Stls','Turnovers'] },
  { id:'nfl', label:'NFL', sport:'NFL', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Rush Attempts','Touchdowns'] },
  { id:'cfb', label:'CFB', sport:'CFB', propCatalog:['Passing Yards','Rushing Yards','Receiving Yards','Receptions','Rush Attempts','Touchdowns'] },
  { id:'mlb', label:'MLB', sport:'MLB', propCatalog:['Hits','Total Bases','Pitcher Strikeouts','Runs','RBIs','Outs Recorded','Home Runs','Hits Allowed'] },
  { id:'nhl', label:'NHL', sport:'NHL', propCatalog:['Shots on Goal','Goalie Saves','Points','Assists','Goals','Blocked Shots','Hits'] },
  { id:'soccer', label:'Soccer', sport:'SOCCER', propCatalog:['Goalie Saves','Passes Attempted','Shots Assisted','Attempted Dribbles','Shots On Target','Shots','Tackles Won','Crosses','Clearances','Fouls Committed','Goals','Assists'] },
  { id:'tennis', label:'Tennis', sport:'TENNIS', propCatalog:['Total Games','Break Points Won','Double Faults','Aces','Games Won','Sets Won'] },
  { id:'golf', label:'Golf', sport:'GOLF', propCatalog:['Birdies or Better','Strokes','Pars','Bogeys'] },
  { id:'ufc', label:'UFC / MMA', sport:'UFC', propCatalog:['Significant Strikes','Takedowns','Fight Time'] },
  { id:'nascar', label:'NASCAR', sport:'NASCAR', propCatalog:['Finishing Position','Fastest Laps'] },
  { id:'esports-cs2', label:'Esports CS2', sport:'ESPORTS', propCatalog:['MAP 1 Headshots','MAP 2 Headshots','MAP 3 Headshots','MAP 1 Kills','MAP 2 Kills','MAP 3 Kills','Headshots','Kills','Assists'] },
  { id:'esports-valorant', label:'Esports Valorant', sport:'ESPORTS', propCatalog:['Headshots','Kills','Assists','Maps Won'] },
  { id:'esports-lol', label:'Esports LoL', sport:'ESPORTS', propCatalog:['Kills','Assists','Deaths','CS','Towers'] },
  { id:'esports-dota2', label:'Esports Dota 2', sport:'ESPORTS', propCatalog:['Kills','Assists','Deaths'] }
];

export const DISPLAY_PROP_ALIASES = {
  '3PT Made':['3pt made','3 pt made','3ptm','3pm','3pt','threes made','three pointers made','3 pointers made','3-pointers made'],
  'Pts+Rebs+Asts':['pts+rebs+asts','points rebounds assists'],
  'PRA':['pra'],
  'Pts+Rebs':['pts+rebs','points rebounds','points+rebounds','pr'],
  'Pts+Asts':['pts+asts','points assists','points+assists','pa'],
  'Rebs+Asts':['rebs+asts','rebounds assists','rebounds+assists','ra'],
  'Blks+Stls':['blks+stls','blocks+steals','stocks'],
  'Fantasy Score':['fantasy score','fantasy points','fantasy'],
  'Shots on Goal':['shots on goal','sog'],
  'Goalie Saves':['goalie saves','saves'],
  'Total Bases':['bases','total bases'],
  'Pitcher Strikeouts':['strikeouts','pitcher strikeouts','k'],
  'Outs Recorded':['outs recorded','pitching outs'],
  'Passes Attempted':['passes attempted','passes'],
  'Shots On Target':['shots on target','sot'],
  'Attempted Dribbles':['attempted dribbles','dribbles'],
  'Birdies or Better':['birdies or better','birdies'],
  'Significant Strikes':['significant strikes','sig strikes']
};

export const NBA_FACTORS = [
  { key:'last5', title:'Last 5 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 5-game prop average from stable sources only.' },
  { key:'last10', title:'Last 10 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 10-game prop average from stable sources only.' },
  { key:'last20', title:'Last 20 Games', live:true, sources:['ESPN direct','backup search'], note:'Recent 20-game prop average from stable sources only.' },
  { key:'season', title:'Season History', live:true, sources:['ESPN direct','backup search'], note:'Season prop average from stable sources only.' },
  { key:'career', title:'Career History', live:true, sources:['ESPN direct','backup search'], note:'Career prop average using repeatable fallback only.' },
  { key:'matchup', title:'Matchup Context', live:false, sources:['Paused'], note:'Paused.' },
  { key:'odds', title:'Market Odds', live:false, sources:['Paused'], note:'Paused.' },
  { key:'projection', title:'Projection Source', live:true, sources:['Internal derived','backup search'], note:'Derived projection number using stable sources only.' },
  { key:'minutes', title:'Projected Minutes', live:true, sources:['Internal from ESPN history','backup search'], note:'Derived projected minutes from recent history plus status adjustments.' },
  { key:'injury', title:'Injury Report Score', live:true, sources:['Official injuries','backup search'], note:'Availability score from stable injury sources.' },
  { key:'starters', title:'Starting Lineup Score', live:true, sources:['Official injuries','backup search'], note:'Starter / lineup context from stable sources.' },
  { key:'schedule', title:'Schedule / Fatigue', live:true, sources:['NBA CDN scoreboard','backup search'], note:'Rest and recent cadence from stable sources.' },
  { key:'pace', title:'Pace Score', live:true, sources:['NBA stats advanced','Basketball-Reference backup'], note:'Tempo / possession environment score from stable source.' },
  { key:'blowout', title:'Blowout Risk', live:false, sources:['Paused'], note:'Paused.' },
  { key:'oppdef', title:'Opponent Defense Score', live:true, sources:['NBA stats advanced','Basketball-Reference backup'], note:'Opponent defensive resistance score from stable source.' },
  { key:'position', title:'Vs-Position Score', live:false, sources:['Paused'], note:'Paused.' },
  { key:'teammates', title:'Teammate Impact Score', live:false, sources:['Paused'], note:'Paused.' },
  { key:'homeaway', title:'Home-Away Split Score', live:true, sources:['ESPN direct','backup search'], note:'Home / road split score from stable sources only.' },
  { key:'role', title:'Role / Usage Score', live:false, sources:['Paused'], note:'Paused.' },
  { key:'coverage', title:'Factor Coverage', live:true, sources:['Internal factor map'], note:'Shows what is live vs paused.' },
  { key:'validation', title:'Prop-Source Validation', live:true, sources:['Ingested row'], note:'Parsed row identity and line are already grounded.' }
];

export const TEAM_TRICODES = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets', CHA:'Charlotte Hornets',
  CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers', DAL:'Dallas Mavericks', DEN:'Denver Nuggets',
  DET:'Detroit Pistons', GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers',
  LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies', MIA:'Miami Heat',
  MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves', NOP:'New Orleans Pelicans', NYK:'New York Knicks',
  OKC:'Oklahoma City Thunder', ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs', TOR:'Toronto Raptors',
  UTA:'Utah Jazz', WAS:'Washington Wizards'
};
