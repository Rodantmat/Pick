export const VERSION = 'v5.8.0 total fix';
export const SEARCH_TIMEOUT_MS = 7000;
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
  '3PT Made':['3pt made','3ptm','3pm','3pt','three pointers made','3 pointers made','threes made'],
  'Pts+Rebs+Asts':['pts+rebs+asts','points rebounds assists'],
  'PRA':['pra'],
  'Pts+Rebs':['pts+rebs','points rebounds','pr'],
  'Pts+Asts':['pts+asts','points assists','pa'],
  'Rebs+Asts':['rebs+asts','rebounds assists','ra'],
  'Blks+Stls':['blks+stls','blocks steals','stocks'],
  'Fantasy Score':['fantasy score','fantasy points'],
  'Shots on Goal':['shots on goal','sog'],
  'Goalie Saves':['goalie saves','saves'],
  'Pitcher Strikeouts':['pitcher strikeouts','strikeouts'],
  'Outs Recorded':['outs recorded','pitching outs'],
  'Birdies or Better':['birdies or better','birdies'],
  'Rush Attempts':['rush attempts','rushing attempts'],
  'Passes Attempted':['passes attempted','passes'],
  'Shots On Target':['shots on target'],
  'Tackles Won':['tackles won','tackles']
};

export const NBA_FACTORS = [
  { key:'last5', title:'Last 5 games', live:true, sources:['StatMuse search','ESPN search','Basketball-Reference search'], note:'Recent 5-game prop average.' },
  { key:'last10', title:'Last 10 games', live:true, sources:['StatMuse search','ESPN search','Basketball-Reference search'], note:'Recent 10-game prop average.' },
  { key:'last20', title:'Last 20 games', live:true, sources:['StatMuse search','ESPN search','Basketball-Reference search'], note:'Recent 20-game prop average.' },
  { key:'season', title:'Season history', live:true, sources:['NBA.com search','ESPN search','Basketball-Reference search'], note:'Season prop average.' },
  { key:'career', title:'Career history', live:true, sources:['StatMuse search','ESPN search','Basketball-Reference search'], note:'Career prop average.' },
  { key:'matchup', title:'Matchup context', live:true, sources:['StatMuse matchup search','news search'], note:'Opponent-specific prop average.' },
  { key:'odds', title:'Market odds', live:true, sources:['Odds search','sportsbook search','Gemini structured fallback'], note:'Moneyline / game context.' },
  { key:'projection', title:'Projection source', live:true, sources:['projection search','Gemini structured fallback'], note:'Projection number for the active prop.' },
  { key:'minutes', title:'Projected minutes', live:true, sources:['minutes search','Gemini structured fallback'], note:'Projected or expected minutes.' },
  { key:'injury', title:'Injury report score', live:true, sources:['injury report search','Gemini structured fallback'], note:'Availability / usage context score.' },
  { key:'starters', title:'Starting lineup score', live:true, sources:['starting lineup search','Gemini structured fallback'], note:'Starter / lineup context score.' },
  { key:'schedule', title:'Schedule / fatigue', live:true, sources:['Game log search','schedule search','Gemini structured fallback'], note:'Rest and prior game cadence.' },
  { key:'coverage', title:'Factor coverage', live:false, sources:['Internal factor map'], note:'Which NBA factors are wired vs pending.' },
  { key:'validation', title:'Prop-source validation', live:true, sources:['Ingested row'], note:'Parsed row identity and line are already grounded.' }
];

export const TEAM_TRICODES = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets', CHA:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers', DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons', GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers', LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies', MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves', NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'Oklahoma City Thunder', ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns', POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs', TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards'
};
