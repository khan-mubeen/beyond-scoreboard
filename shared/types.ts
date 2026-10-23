/**
 * shared contract between stakes, live and story.
 * do not change without telling the team first.
 * every type here is listed in docs/contract.md.
 */

// ---------- liiga ----------

/** a liiga team */
export interface Team {
  id: string;
  name: string;
  shortName: string;
  city: string;
  colours: { primary: string; secondary: string };
}

export type GameStatus = "scheduled" | "live" | "final";
export type DecidedIn = "regulation" | "overtime" | "shootout";

/** goals for each side */
export interface Score {
  home: number;
  away: number;
}

/** one liiga game */
export interface Game {
  id: string;
  /** iso date-time of puck drop */
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  status: GameStatus;
  score: Score;
  /** null until the game is final */
  decidedIn: DecidedIn | null;
}

/** the part of a game the replay and screens need */
export type GameTeams = Pick<Game, "id" | "homeTeamId" | "awayTeamId">;

export type GoalStrength = "even" | "powerplay" | "shorthanded" | "empty_net";

/** a goal in a game. scorer, assists and strength are optional until the api is verified */
export interface GoalEvent {
  id: string;
  gameId: string;
  /** team that scored */
  teamId: string;
  /** seconds since puck drop on the game clock (0-3600 in regulation) */
  gameTimeSeconds: number;
  period: number;
  scorer?: string;
  assists?: string[];
  strength?: GoalStrength;
}

// ---------- stakes ----------

/** where a final position lands. see features/stakes/engine/rules.config.ts */
export type Zone = "top4" | "playoffs" | "safe" | "relegated";

/** chance (0-1) of ending in each zone */
export type ZoneChances = Record<Zone, number>;

export type GameOutcome = "regulationWin" | "overtimeWin" | "overtimeLoss" | "regulationLoss";

/** what one game means for one team */
export interface StakesCard {
  teamId: string;
  gameId: string;
  /** position in the table before this game */
  currentPosition: number;
  currentZone: Zone;
  /** final-zone chances for each way this game can end */
  zoneOddsByOutcome: Record<GameOutcome, ZoneChances>;
  /** chance of each final position; index 0 is 1st place */
  positionOdds: number[];
  /** one short user-facing line, says "chance", never "odds" */
  headline: string;
}

/** one row of the projected table if the game ended at the current score */
export interface ProjectedRow {
  teamId: string;
  points: number;
  rank: number;
  zone: Zone;
}

export type FormResult = "W" | "OTW" | "OTL" | "L";

/** raw numbers stakes hands to story. every block carries the games it came from */
export interface FactInputs {
  teamId: string;
  opponentId: string;
  gameId: string;
  /** latest results, oldest first */
  form: { results: FormResult[]; sourceGameIds: string[] };
  /** this season against the opponent */
  headToHead: { wins: number; losses: number; sourceGameIds: string[] };
  standings: {
    position: number;
    points: number;
    gamesPlayed: number;
    /** negative when above the line */
    pointsToPlayoffLine: number;
    sourceGameIds: string[];
  };
  /** all 0-1 */
  chances: {
    playoffs: number;
    top4: number;
    relegation: number;
    ifRegulationWin: number;
    ifRegulationLoss: number;
    sourceGameIds: string[];
  };
}

// ---------- story ----------

/** one verified number or name the writer may use */
export interface Fact {
  /** like "F17" */
  id: string;
  label: string;
  value: number | string;
  /** "%", "points", ... or null when the value has no unit */
  unit: string | null;
  sourceGameIds: string[];
}

export interface ContentSentence {
  text: string;
  /** facts this sentence relies on. an empty list fails validation */
  factIds: string[];
}

export type ContentKind = "brief" | "story";
export type Language = "en" | "fi";

/** a pre-game brief or post-game story */
export interface Content {
  /** "<kind>.<teamId>.<gameId>.<language>" */
  id: string;
  kind: ContentKind;
  gameId: string;
  teamId: string;
  language: Language;
  sentences: ContentSentence[];
  /** verified = written and passed the validator, fallback = built from the template */
  status: "verified" | "fallback";
  /** iso date-time */
  generatedAt: string;
}

export type ValidationErrorType =
  "uncited_sentence" | "model_typed_number" | "unknown_name" | "quote" | "off_ice_claim";

export interface VerifiedClaim {
  text: string;
  factIds: string[];
  passed: boolean;
  errorType: ValidationErrorType | null;
  reason: string | null;
}

/** what the validator decided about each claim. blocked claims never reach users */
export interface VerificationReport {
  contentId: string;
  claims: VerifiedClaim[];
  blockedCount: number;
}

// ---------- live ----------

export type CallType = "next_goal" | "goal_in_5" | "regulation_result" | "overtime";

export interface CallOption {
  id: string;
  label: string;
}

/** a live call. all times are game seconds */
export interface Call {
  id: string;
  type: CallType;
  question: string;
  options: CallOption[];
  opensAt: number;
  locksAt: number;
  resolvesAt: number;
  /** optional user-facing line tying the call to the stakes */
  stakesLine?: string;
  /** server only. null until resolved. never send this to a client, use PublicCall */
  correctOptionId: string | null;
}

/** the only call shape ever sent to clients */
export type PublicCall = Omit<Call, "correctOptionId">;

export type ReplayPhase = "pregame" | "live" | "final";

/** the game as known at one moment. never contains anything after gameTimeSeconds */
export interface ReplaySnapshot {
  gameTimeSeconds: number;
  phase: ReplayPhase;
  score: Score;
  /** only events with gameTimeSeconds <= this snapshot's gameTimeSeconds */
  events: GoalEvent[];
}

export type RoomPhase = "lobby" | "live" | "intermission" | "final";

export interface Player {
  id: string;
  roomCode: string;
  nickname: string;
  /** ms epoch */
  joinedAt: number;
}

/** one player's answer to one call. unique per (playerId, callId) */
export interface Answer {
  playerId: string;
  callId: string;
  optionId: string;
  /** ms epoch */
  answeredAt: number;
  gameTimeSeconds: number;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  /** players with the same score share a rank */
  rank: number;
}

/** everything a phone or the big screen needs, polled every second */
export interface RoomState {
  code: string;
  /** ms epoch on the server, for clock sync */
  serverNow: number;
  phase: RoomPhase;
  game: GameTeams;
  gameTimeSeconds: number;
  score: Score;
  events: GoalEvent[];
  activeCall: PublicCall | null;
  lastResolved: { callId: string; correctOptionId: string; youWereRight?: boolean } | null;
  leaderboard: LeaderboardEntry[];
  /** null for the big screen and the host */
  me: { playerId: string; score: number; rank: number } | null;
  stakes: StakesCard;
  projectedTable: ProjectedRow[];
}

// ---------- api bodies ----------

export interface CreateRoomResponse {
  code: string;
}

export interface JoinRequest {
  nickname: string;
}

export interface JoinResponse {
  code: string;
  playerId: string;
}

export type ControlAction = "start" | "pause" | "resume" | "seek" | "intermission" | "finish" | "reset";

export interface ControlRequest {
  action: ControlAction;
  /** game seconds, only for "seek" */
  seconds?: number;
}

export interface AnswerRequest {
  playerId: string;
  callId: string;
  optionId: string;
}

export interface ApiError {
  error: string;
}
