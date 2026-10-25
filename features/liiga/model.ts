// liiga data after normalising: what the engine, the site and the live loop work with.
// browser-safe types only

/** "{season}-{gameId}", e.g. "2027-2701404" */
export type MatchId = string;

export type LiigaStatus = "scheduled" | "live" | "final" | "cancelled";
export type LiigaDecidedIn = "regulation" | "overtime" | "shootout";
export type Side = "home" | "away";
/** [home, away] */
export type Pair = [number, number];

export interface LiigaTeam {
  /** "362185137:tappara" */
  id: string;
  /** the number before the colon; shotmap and pastAndFutureGames use it */
  internalId: number | null;
  /** "tappara", "kärpät" */
  slug: string;
  name: string;
  abbreviation: string;
  logoLight: string | null;
  logoDark: string | null;
}

export interface SideInfo {
  teamId: string;
  name: string;
  logo: string | null;
  goals: number;
}

export interface LiigaGoal {
  id: string;
  teamId: string;
  side: Side;
  gameTime: number;
  period: number;
  scorer: string | null;
  /** the scorer's player id, when the feed has it */
  scorerId: number | null;
  assists: string[];
  assistIds: number[];
  /** raw goalTypes codes, see docs/api/goal-types.md */
  types: string[];
  homeScore: number;
  awayScore: number;
  winningGoal: boolean;
  videoUrl: string | null;
  thumbUrl: string | null;
}

export interface LiigaPenalty {
  id: string;
  teamId: string;
  side: Side;
  gameTime: number;
  period: number;
  minutes: number;
  /** game seconds the penalty runs (penaltyBegintime / penaltyEndtime) */
  begin: number;
  end: number;
  fault: string | null;
  playerId: number | null;
}

export interface LiigaPeriod {
  index: number;
  category: "NORMAL" | "OVERTIME" | "EXTENDED" | "WINNING_SHOT_COMPETITION";
  home: number;
  away: number;
}

export interface LiigaGame {
  id: MatchId;
  gameId: number;
  season: number;
  /** iso utc */
  start: string;
  status: LiigaStatus;
  decidedIn: LiigaDecidedIn | null;
  home: SideInfo;
  away: SideInfo;
  currentPeriod: number | null;
  /** game seconds played so far */
  gameTime: number;
  periods: LiigaPeriod[];
  spectators: number | null;
  rink: string | null;
  goals: LiigaGoal[];
  penalties: LiigaPenalty[];
  powerPlay: { home: { instances: number; goals: number }; away: { instances: number; goals: number } } | null;
  video: { url: string; thumb: string | null } | null;
}

/** a schedule entry: lighter than a game, enough for tables and the simulation */
export interface LiigaFixture {
  id: MatchId;
  gameId: number;
  season: number;
  start: string;
  status: LiigaStatus;
  decidedIn: LiigaDecidedIn | null;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** post-game expected goals from tracking, when the feed has them */
  xg: Pair | null;
  rink: string | null;
}

export interface LiigaStandingsRow {
  teamId: string;
  internalId: number;
  name: string;
  logoLight: string | null;
  logoDark: string | null;
  ranking: number;
  liveRanking: number;
  games: number;
  liveGames: number;
  /** regulation wins */
  wins: number;
  overtimeWins: number;
  losses: number;
  overtimeLosses: number;
  points: number;
  livePoints: number;
  goals: number;
  goalsAgainst: number;
  liveGoals: number;
  liveGoalsAgainst: number;
}

export interface LiigaStandings {
  rows: LiigaStandingsRow[];
  /** last position above each line, e.g. [4, 12, 14] */
  playoffsLines: number[];
}

/** team stats for one game. null means the feed can't give it yet ("Data pending") */
export interface LiigaGameStats {
  shots: Pair | null;
  /** shots per period (1-3, 4 overtime) */
  shotsByPeriod: { period: number; home: number; away: number }[];
  blockedShots: Pair | null;
  /** faceoff win share in % */
  faceoffs: Pair | null;
  penaltyMinutes: Pair | null;
  powerPlay: { home: { goals: number; instances: number }; away: { goals: number; instances: number } } | null;
  /** puck-control share in % (contested time left out) */
  momentum: Pair | null;
  momentumByPeriod: { period: number; home: number; away: number }[];
}

export interface LineupPlayer {
  name: string;
  jersey: number | null;
  role: string | null;
  line: number | null;
}

export interface LiigaLineups {
  home: LineupPlayer[];
  away: LineupPlayer[];
}

/** a player in a game's roster, with what the feed says about them ("ask the match", trivia) */
export interface RosterPlayer {
  id: number;
  teamId: string;
  side: Side;
  name: string;
  firstName: string;
  lastName: string;
  jersey: number | null;
  /** "LEFT_WING", "GOALKEEPER" */
  role: string | null;
  line: number | null;
  /** "2000-04-16" */
  birthDate: string | null;
  birthPlace: string | null;
  /** "FIN" */
  birthCountry: string | null;
  nationality: string | null;
  /** cm, kg */
  height: number | null;
  weight: number | null;
  captain: boolean;
  pictureUrl: string | null;
}

export interface LiigaRoster {
  home: RosterPlayer[];
  away: RosterPlayer[];
}

/** a player's season so far (regular season, as of the league clock) */
export interface PlayerSeasonStats {
  games: number;
  goals: number;
  assists: number;
}

export interface LiigaGameSummary {
  id: MatchId;
  start: string;
  homeName: string;
  awayName: string;
  homeInternalId: number | null;
  awayInternalId: number | null;
  homeGoals: number;
  awayGoals: number;
  extraTime: boolean;
  shootouts: boolean;
}

export interface LiigaPastAndFuture {
  pastBetween: LiigaGameSummary[];
  futureHome: LiigaGameSummary[];
  futureAway: LiigaGameSummary[];
}

export const matchIdOf = (season: number, gameId: number): MatchId => `${season}-${gameId}`;

export function parseMatchId(id: string): { season: number; gameId: number } | null {
  const m = /^(\d{4})-(\d+)$/.exec(id);
  return m ? { season: Number(m[1]), gameId: Number(m[2]) } : null;
}
