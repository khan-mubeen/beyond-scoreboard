// the subset of docs/api/liiga-openapi.json we read. field names are the spec's; nothing invented.
// everything is optional-ish because the live api leaves fields null more often than the spec says

export interface TournamentDTO {
  season: number; // the year the season ends: 2026-27 is 2027
  season_name?: string | null;
  tournament_type?: string | null;
}

export interface TeamLogosDTO {
  darkBg?: string | null;
  lightBg?: string | null;
}

export interface SimplePlayerDTO {
  playerId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  jersey?: number | null;
}

export interface GoalEventDTO {
  scorerPlayerId?: number | null;
  scorerPlayer?: SimplePlayerDTO | null;
  assistantPlayerIds?: number[] | null;
  winningGoal?: boolean | null;
  gameTime: number;
  period: number;
  eventId?: number | null;
  goalTypes?: string[] | null;
  assistantPlayers?: SimplePlayerDTO[] | null;
  homeTeamScore: number;
  awayTeamScore: number;
  videoClipUrl?: string | null;
  videoThumbnailUrl?: string | null;
}

export interface PenaltyEventDTO {
  playerId?: number | null;
  eventId?: number | null;
  gameTime: number;
  period: number;
  penaltyBegintime?: number | null;
  penaltyEndtime?: number | null;
  penaltyFaultName?: string | null;
  penaltyMinutes?: number | null;
}

export interface GoalKeeperEventDTO {
  emptyNet?: number | null;
  beginTime?: number | null;
  endTime?: number | null;
}

export interface GameTeamDTO {
  teamId?: string | null;
  teamPlaceholder?: string | null;
  teamName?: string | null;
  goals?: number | null;
  goalEvents?: GoalEventDTO[] | null;
  penaltyEvents?: PenaltyEventDTO[] | null;
  goalKeeperEvents?: GoalKeeperEventDTO[] | null;
  powerplayInstances?: number | null;
  powerplayGoals?: number | null;
  expectedGoals?: number | null;
  logos?: TeamLogosDTO | null;
}

export type PeriodCategory = "NORMAL" | "OVERTIME" | "EXTENDED" | "WINNING_SHOT_COMPETITION";

export interface GamePeriodDTO {
  index: number;
  homeTeamGoals: number;
  awayTeamGoals: number;
  category: PeriodCategory;
  startTime?: number | null;
  endTime?: number | null;
}

export type FinishedType =
  | "ACTIVE_OR_NOT_STARTED"
  | "ENDED_DURING_REGULAR_GAME_TIME"
  | "ENDED_DURING_EXTENDED_GAME_TIME"
  | "ENDED_DURING_WINNING_SHOT_COMPETITION"
  | "CANCELLED";

export interface IceRinkDTO {
  id: number;
  name?: string | null;
  city?: string | null;
}

export interface GameDTO {
  id: number;
  season: number;
  start: string;
  end?: string | null;
  homeTeam: GameTeamDTO;
  awayTeam: GameTeamDTO;
  periods?: GamePeriodDTO[] | null;
  started: boolean;
  ended: boolean;
  finishedType?: FinishedType | null;
  currentPeriod?: number | null;
  gameTime?: number | null;
  spectators?: number | null;
  videoURL?: string | null;
  thumbURL?: string | null;
  iceRink?: IceRinkDTO | null;
}

export interface GamesDTO {
  games: GameDTO[];
  previousGameDate?: string | null;
  nextGameDate?: string | null;
}

export interface ScheduleItemDTO {
  id: number;
  season: number;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeamGoals?: number | null;
  awayTeamGoals?: number | null;
  expectedHomeTeamGoals?: number | null;
  expectedAwayTeamGoals?: number | null;
  started?: boolean | null;
  ended?: boolean | null;
  start: string;
  finishedType?: FinishedType | null;
  spectators?: number | null;
  iceRink?: IceRinkDTO | null;
}

export interface StandingsItemDTO {
  internalId: number;
  teamId?: string | null;
  teamName?: string | null;
  teamLogos?: TeamLogosDTO | null;
  ranking: number;
  liveRanking: number;
  games: number;
  liveGames: number;
  wins: number; // regulation wins (checked: points = 3*wins + 2*overtimeWins + overtimeLosses)
  liveWins: number;
  overtimeWins: number;
  losses: number;
  liveLosses: number;
  overtimeLosses: number;
  points?: number | null;
  livePoints?: number | null;
  goals: number;
  goalsAgainst: number;
  liveGoals: number;
  liveGoalsAgainst: number;
}

export interface StandingsResponseDTO {
  items: StandingsItemDTO[];
  playoffsLines?: number[] | null;
  cacheUpdateDate?: string | null;
}

export interface TeamDTO {
  id: string;
  nameAbbreviation?: string | null;
  shortName?: string | null;
  logos?: TeamLogosDTO | null;
}

/** GET /api/v1/teams: a map of lists ({ teams: [...] } in practice) */
export type TeamsDTO = Record<string, TeamDTO[]>;

export interface PlayerDTO {
  id?: number | null;
  teamId?: string | null;
  teamName?: string | null;
  line?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  /** "VL", "KH", "MV" (finnish position codes) */
  roleCode?: string | null;
  jersey?: number | null;
  /** "2000-04-16" */
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  /** iso 3166 alpha-3, "FIN" */
  countryOfBirth?: string | null;
  nationality?: string | null;
  handedness?: string | null;
  /** cm */
  height?: number | null;
  /** kg */
  weight?: number | null;
  captain?: boolean | null;
  alternateCaptain?: boolean | null;
  rookie?: boolean | null;
  pictureUrl?: string | null;
  removed?: boolean | null;
}

export interface GameDetailsDTO {
  game: GameDTO;
  homeTeamPlayers?: PlayerDTO[] | null;
  awayTeamPlayers?: PlayerDTO[] | null;
}

export interface PeriodTeamStatsDTO {
  teamId?: string | null;
  period?: number | null;
  shots?: number | null;
  powerPlayInstances?: unknown[] | null;
  powerPlayGoals?: number | null;
  penaltyMinutes?: number | null;
  faceOffWins?: number | null;
}

export interface PuckStatsDTO {
  periodNumber?: number | null;
  homeTeamControlDuration?: number | null;
  awayTeamControlDuration?: number | null;
  contestedControlDuration?: number | null;
}

export interface GameStatsDTO {
  homeTeam?: PeriodTeamStatsDTO[] | null;
  awayTeam?: PeriodTeamStatsDTO[] | null;
  puckStats?: PuckStatsDTO[] | null;
}

export interface ShotDTO {
  shootingTeamId?: number | null;
  eventType?: "GOAL" | "GOALIE_BLOCKED" | "PLAYER_BLOCKED" | "MISSED" | null;
  gameTime?: number | null;
  period?: number | null;
}

export interface ShotMapDTO {
  gameShootingMap?: ShotDTO[] | null;
}

export interface GamePlayersDTO {
  homeTeamPlayers?: PlayerDTO[] | null;
  awayTeamPlayers?: PlayerDTO[] | null;
}

export interface GameSummaryDTO {
  season: number;
  gameId: number;
  homeGoals: number;
  awayGoals: number;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamlogo?: string | null;
  awayTeamlogo?: string | null;
  gameStart: string;
  extraTime: boolean;
  shootouts: boolean;
}

export interface PastAndFutureGamesDTO {
  pastGamesBetweenTeams: GameSummaryDTO[];
  futureGamesHomeTeam: GameSummaryDTO[];
  futureGamesAwayTeam: GameSummaryDTO[];
}
