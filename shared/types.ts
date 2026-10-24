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
  /** iso date-time the game starts */
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
  /** seconds since the start on the game clock (0-3600 in regulation) */
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
  | "uncited_sentence"
  | "model_typed_number"
  | "unknown_name"
  | "quote"
  | "off_ice_claim"
  | "betting_language";

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

// ---------- site (kaleva sports pages) ----------
// percentages here are whole numbers 0-100 ("66" means 66%), changes are percentage points

/** where a site response came from: the live liiga api, its saved snapshot, mock data, config or the db */
export type DataSource = "live" | "snapshot" | "mock" | "config" | "db";

/** every /api/site response carries these */
export interface ApiMeta {
  /** iso time the data is valid for */
  asOf: string;
  source: DataSource;
}

/** a team as the site shows it. logo is an image path, today a placeholder */
export interface TeamRef {
  id: string;
  name: string;
  city?: string;
  logo: string;
}

/** a link in the top nav */
export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
  /** shows a dropdown chevron */
  hasMenu?: boolean;
}

export type QuickLinkIcon = "home" | "calls" | "history" | "rewards" | "achievements" | "settings" | "leaderboard" | "teams" | "profile";

export interface QuickLink {
  id: string;
  label: string;
  href: string;
  icon: QuickLinkIcon;
}

/** the signed-in fan */
export interface UserSummary {
  id: string;
  name: string;
  /** "Sports fan" */
  role: string;
  avatar: string;
  points: number;
  pointsThisWeek: number;
  level: number;
  pointsToNextLevel: number;
  /** 0-1 progress towards the next level */
  levelProgress: number;
}

export interface FavoriteTeam {
  team: TeamRef;
  league: string;
  starred: boolean;
  comingSoon: boolean;
}

/** top nav, user and sidebar, the same on every site page */
export interface SiteChrome {
  nav: NavLink[];
  searchPlaceholder: string;
  hasNotifications: boolean;
  user: UserSummary;
  favorites: FavoriteTeam[];
  quickLinks: QuickLink[];
}

/** one team's playoff chance in a chip */
export interface StakesChipData {
  team: TeamRef;
  /** "Playoff chance" */
  label: string;
  chance: number;
  change: number;
}

/** a match card on the home page */
export interface MatchSummary {
  id: string;
  league: string;
  status: GameStatus;
  home: TeamRef;
  away: TeamRef;
  /** null before the game starts */
  score: Score | null;
  /** one entry per period, null for a period not played yet */
  periodScores: (Score | null)[];
  /** "2nd period" while live */
  periodLabel?: string;
  /** "14:26" while live */
  clock?: string;
  /** "Today 18:30", "Yesterday" */
  whenLabel: string;
  /** short "what it's worth" line */
  note?: string;
  href: string;
  /** a demo rotation match not on yet: when it starts (ms, server clock), for a countdown */
  startsAt?: number;
}

/** a sport we don't cover yet, shown greyed out */
export interface ComingSoonCard {
  id: string;
  title: string;
  league: string;
}

export interface FeaturedMatch {
  match: MatchSummary;
  background: string;
  whatItMeans: string;
  stakes: StakesChipData[];
  /** your call! questions open right now (at page load; the card then follows the live channel) */
  openCalls: number;
  /** the live engine runs this match: the card subscribes to match:{id} */
  channel?: boolean;
}

/** a card in the "season stakes today" strip */
export interface StakesStripItem {
  id: string;
  home: TeamRef;
  away: TeamRef;
  line: string;
  href: string;
}

/** a leaderboard row with a face */
export interface SiteLeaderboardEntry extends LeaderboardEntry {
  avatar: string;
  isYou?: boolean;
}

/** a liiga table row, the projected row plus what the table shows */
export interface LiigaTableRow extends ProjectedRow {
  team: TeamRef;
  gamesPlayed: number;
  goalDifference: number;
}

export interface LiigaTableData {
  rows: LiigaTableRow[];
  highlightTeamId: string;
  /** every team the viewer follows */
  highlightTeamIds?: string[];
  /** "11th if it ends now" next to the highlighted row, null when the team isn't playing */
  highlightNote: string | null;
  fullTableHref: string;
}

export interface HeroData {
  kicker: string;
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  body: string;
  tagline: string;
  image: string;
}

export interface HomePage {
  hero: HeroData;
  dateLabel: string;
  /** the live game to show big, else the favourite team's next game; null on an empty day */
  featured: FeaturedMatch | null;
  seasonStakesToday: StakesStripItem[];
  live: MatchSummary[];
  upcoming: MatchSummary[];
  recent: MatchSummary[];
  comingSoon: ComingSoonCard[];
  leaderboard: { title: string; sponsor: string; entries: SiteLeaderboardEntry[]; href: string };
  table: LiigaTableData;
  /** the viewer's teams and their next games */
  yourTeams: { team: TeamRef; slug: string; next: TeamNextGame | null }[];
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface VideoInfo {
  poster: string;
  /** "Match highlights · 3:12" */
  title: string;
  /** a clip we host (the rotation highlights, mp4); never liiga's own streams */
  src?: string | null;
  /** start the clip here (seconds): a goal in a rotation highlight opens 4 s before it */
  startAt?: number;
  /** the match on liiga.fi: "Watch on liiga.fi" when we host no clip, "Video not playing?" under ours */
  href?: string | null;
}

/** a goal or other event in the match feed, newest first */
export interface MatchEvent {
  id: string;
  kind?: "goal" | "penalty";
  /** "11:40" in the period */
  time: string;
  /** "2nd period" */
  period: string;
  title: string;
  detail: string;
  /** playoff chance effect in percentage points, null when none */
  effect: number | null;
  /** null when the feed has no clip */
  video: VideoInfo | null;
}

/** one match statistic. null values render as "Data pending" */
export interface MatchStat {
  id: string;
  label: string;
  home: number | null;
  away: number | null;
  unit?: string;
  /** shown instead of the numbers, e.g. ["1/3", "0/2"] for power play */
  display?: [string, string] | null;
}

export interface LineupPlayer {
  name: string;
  jersey: number | null;
  role: string | null;
  line: number | null;
}

export interface StakesStep {
  /** "Start", "1–0" */
  label: string;
  chance: number;
}

export interface StakesTableRow {
  rank: number;
  /** "—" for other teams, "Kärpät · if it ends now" for the highlighted one */
  label: string;
  zone: Zone;
  highlight?: boolean;
}

/** what the game does to one team's season */
export interface SeasonStakes {
  teamName: string;
  source: string;
  chance: number;
  change: number;
  before: number;
  /** the chance right now, labelled by nowLabel ("if it ends now", "after the game") */
  now: number;
  nowLabel: string;
  steps: StakesStep[];
  tableTitle: string;
  tableBadge: string;
  rows: StakesTableRow[];
  /** playoff chance for each way the game can end */
  worth: Record<GameOutcome, number>;
  /** the games "what if?" can set; null once the match is decided */
  whatIf?: WhatIfOptions | null;
}

/** a game "what if?" can set */
export interface WhatIfGame {
  gameId: string;
  home: TeamRef;
  away: TeamRef;
  /** "Tue 20 Oct · 18:30" */
  when: string;
}

export interface WhatIfOptions {
  /** this match first, then the other unplayed games on its date */
  games: WhatIfGame[];
  /** most results set at once */
  max: number;
}

/** a set result, from the home team's view */
export interface WhatIfOverride {
  gameId: string;
  outcome: GameOutcome;
}

export interface WhatIfChances {
  playoffs: number;
  top4: number;
  relegation: number;
}

export interface WhatIfTeam {
  team: TeamRef;
  /** percent, as the season stands */
  before: WhatIfChances;
  /** percent, with the set results */
  after: WhatIfChances;
}

/** POST /api/site/whatif */
export interface WhatIfResult extends ApiMeta {
  matchId: string;
  overrides: WhatIfOverride[];
  /** the match's two teams first, then the other set games' teams */
  teams: WhatIfTeam[];
}

/** someone's comment in the match discussion */
export interface Comment {
  id: string;
  author: string;
  text: string;
  likes?: number;
  /** iso */
  createdAt?: string;
}

/** the call it! card. mock only: the real api sends result after the call locks */
export interface CallItState {
  call: PublicCall;
  points: number;
  subtitle: string;
  secondsLeft: number;
  result: { correctOptionId: string; split: Record<string, number> };
  lastCall: { text: string; correct: boolean };
}

export interface RoomLeaderboardRow {
  rank: number | null;
  name: string;
  score: number | null;
  isYou?: boolean;
}

/** the watch together room linked to a match */
export interface RoomSummary {
  code: string;
  watching: number;
  subtitle: string;
  avatars: string[];
  extraCount: number;
  leaderboardTitle: string;
  leaderboardNote: string;
  leaderboard: RoomLeaderboardRow[];
  /** small print under the leaderboard */
  footnote?: string;
}

interface MatchDetailBase {
  id: string;
  breadcrumbs: Breadcrumb[];
  match: MatchSummary;
  venue: string;
  dateLabel: string;
  /** null until the feed reports it */
  spectators: number | null;
  stakesSummary: StakesChipData[];
  video: VideoInfo;
  seasonStakes: SeasonStakes;
  events: MatchEvent[];
  eventsNote: string;
  stats: MatchStat[];
  statsSource: string;
  statsNote: string;
  /** null until the feed has lineups */
  lineups?: { home: LineupPlayer[]; away: LineupPlayer[] } | null;
  /** true while the server replays a finished game as live (demo) */
  isReplay?: boolean;
  /** demo rotation matches: the highlight (null: none yet) and the phase when the page loaded */
  highlight?: HighlightVideo | null;
  rotation?: LiveRotation | null;
  /** the match on liiga.fi ("Watch on liiga.fi", "Video not playing?") */
  liigaUrl?: string;
}

export interface LiveMatchDetail extends MatchDetailBase {
  /** a scheduled game uses the live page before it starts */
  status: "live" | "scheduled";
  whatItMeans: string;
  discussion: Comment[];
  guidelinesHref: string;
  /** null when no call is open */
  callIt: CallItState | null;
  room: RoomSummary;
}

export interface FinishedMatchDetail extends MatchDetailBase {
  status: "final";
  whatItMeant: {
    badge: string;
    chanceBefore: number;
    chanceAfter: number;
    positionBefore: number;
    positionAfter: number;
    positionNote: string;
    story: Content;
    chips: { label: string; tone: "neutral" | "good" }[];
  };
  /** null for a game without goals */
  goalOfTheGame: {
    thumbnail: string;
    meta: string;
    title: string;
    effectText: string;
    chip: string;
    video: VideoInfo;
  } | null;
  /** null for a viewer who didn't play along */
  yourNight: { points: number; callsCorrect: number; callsTotal: number; rank: number; of: number; bestCall: string } | null;
  room: RoomSummary;
  /** the match discussion, oldest first (read only once the game is over) */
  discussion: Comment[];
  /** null when the team has no games left */
  nextUp: { title: string; when: string; worth: string; matchId?: string } | null;
  /** the ~60-second spoken summary, in english and finnish */
  summary?: { en: SpokenSummary; fi: SpokenSummary } | null;
}

/**
 * a spoken summary: the transcript, and the stored audio of exactly that transcript (generated
 * once at prep time). no audio: the browser's own voice reads the transcript, if it has one
 */
export interface SpokenSummary {
  lang: Language;
  transcript: string;
  audio: { url: string; durationSec: number; voice: string; source: "azure" | "azure-portal" } | null;
}

/** a game this season between the same two teams, newest first */
export interface HeadToHeadGame {
  matchId: string;
  /** "Sat 17 Oct" */
  date: string;
  home: TeamRef;
  away: TeamRef;
  score: Score;
  /** " OT" / " SO" when it went past regulation */
  extra: string;
}

/**
 * a game that hasn't started (a rotation match counts as started from its lobby): a preview with
 * no video, no your call!, no discussion and no watch together
 */
export interface PreviewMatchDetail {
  id: string;
  status: "preview";
  breadcrumbs: Breadcrumb[];
  /** startsAt drives the countdown */
  match: MatchSummary;
  venue: string;
  dateLabel: string;
  stakesSummary: StakesChipData[];
  /** "what this game is worth", with what if? */
  seasonStakes: SeasonStakes;
  headToHead: { games: HeadToHeadGame[]; summary: string };
  /** the viewer set a reminder for this game */
  reminder: boolean;
  liigaUrl: string;
}

export type MatchDetail = LiveMatchDetail | FinishedMatchDetail | PreviewMatchDetail;

// ---------- live match state (GET /api/site/matches/:id/state and realtime "match:{id}") ----------

export type LiveCallStatus = "open" | "locked" | "resolved" | "cancelled";

/** a call as fans see it. the correct option only appears once it is resolved */
export interface LiveCall {
  id: string;
  type: string;
  question: string;
  options: CallOption[];
  stakesLine: string | null;
  points: number;
  status: LiveCallStatus;
  /** ms epoch, server time */
  openedAt: number;
  locksAt: number;
  /** share of answers per option in %, once locked */
  split: Record<string, number> | null;
  /** only when resolved */
  correctOptionId: string | null;
  /** why a call was cancelled */
  reason: string | null;
  /** the same call in finnish (same option ids) */
  fi?: { question: string; options: CallOption[] } | null;
}

export type RotationPhaseName = "lobby" | "live" | "summary" | "idle";

/** a demo rotation match's place in the loop. times are ms, server clock */
export interface LiveRotation {
  /** idle: another match is on */
  phase: RotationPhaseName;
  phaseEndsAt: number;
  /** when this match's highlight starts (or started) this cycle */
  liveStartedAt: number;
  /** live only: the highlight's second at serverNow (it holds while paused) */
  videoSec: number | null;
  durationSec: number;
  paused: boolean;
  next: { matchId: string; title: string; startsAt: number } | null;
}

/** GET /api/site/rotation: the whole loop, for the home page, the host page and tv mode */
export interface RotationInfo extends ApiMeta {
  serverNow: number;
  cycle: number;
  paused: boolean;
  current: { matchId: string; title: string; phase: "lobby" | "live" | "summary"; phaseStartedAt: number; phaseEndsAt: number };
  next: { matchId: string; title: string; startsAt: number };
  matches: { matchId: string; title: string; lobbyAt: number; liveAt: number; summaryAt: number; endsAt: number }[];
}

/** a rotation match's highlight. never carries the goal cues */
export type HighlightVideo =
  | { type: "mp4"; url: string; poster: string | null; durationSec: number }
  | { type: "youtube"; id: string; poster: string | null; durationSec: number };

export interface LiveStakes {
  chips: StakesChipData[];
  seasonStakes: SeasonStakes;
  whatItMeans: string;
}

export interface LiveState {
  matchId: string;
  /** ms epoch on the server, for countdowns */
  serverNow: number;
  isReplay: boolean;
  status: "scheduled" | "live" | "final";
  clock: { period: number; gameTime: number; label: string; clock: string };
  score: Score;
  periodScores: (Score | null)[];
  events: MatchEvent[];
  stakes: LiveStakes;
  call: LiveCall | null;
  /** the most recent resolved or cancelled call */
  lastCall: LiveCall | null;
  leaderboard: RoomLeaderboardRow[];
  watching: number;
  /** demo rotation matches only: this match's phase and the video clock */
  rotation?: LiveRotation | null;
  /** the viewer (from the cookie): their answer to the current and last call, points, and room rank */
  me: {
    userId: string;
    nickname: string | null;
    matchPoints: number;
    answers: Record<string, string>;
    /** place in the watch together room, null before their first points */
    rank: number | null;
    /** fans in the room */
    of: number;
  } | null;
}

export interface Subscription {
  id: string;
  tag: string;
  title: string;
  description: string;
  priceLabel: string;
  /** the fan already has it */
  included: boolean;
}

export interface RewardOffer {
  id: string;
  tag: string;
  title: string;
  description: string;
  /** null means members only */
  costPoints: number | null;
}

export type AchievementIcon = "star" | "bolt" | "rook";

export interface Achievement {
  id: string;
  title: string;
  subtitle: string;
  icon: AchievementIcon;
}

export interface RewardsPage {
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  howToEarnHref: string;
  earnChips: { icon: "call" | "story" | "watch"; label: string }[];
  subscriptions: Subscription[];
  offers: RewardOffer[];
  achievements: Achievement[];
  footnote: string;
}

// ---------- the viewer, notifications, leaderboards ----------

export interface NotificationPrefs {
  /** a call they answered resolved */
  callResults: boolean;
  /** a followed team plays within 24 h, or is live */
  favoriteReminders: boolean;
  /** a followed team's final result and what it meant */
  favoriteResults: boolean;
}

/** a team's next game, for the teams pages and "your teams" */
export interface TeamNextGame {
  matchId: string;
  opponent: TeamRef;
  home: boolean;
  /** "Tue 20 Oct · 18:30" */
  when: string;
  /** "Win → 72% playoff chance", null when the stakes can't be worked out */
  worth: string | null;
}

export interface TeamListItem {
  team: TeamRef;
  /** "kärpät", for /teams/:slug */
  slug: string;
  rank: number;
  points: number;
  gamesPlayed: number;
  zone: Zone;
  zoneLabel: string;
  playoffChance: number;
  next: TeamNextGame | null;
  followed: boolean;
}

/** GET /api/site/teams */
export interface TeamsPageData extends ApiMeta {
  teams: TeamListItem[];
  /** "Standings before Tue 20 Oct" in demo mode */
  note: string;
}

/** GET /api/site/teams/:slug */
export interface TeamPageData extends ApiMeta {
  item: TeamListItem;
  top4Chance: number;
  relegationChance: number;
  /** newest first */
  last5: { matchId: string; opponent: TeamRef; home: boolean; result: FormResult; score: string; date: string }[];
  next3: TeamNextGame[];
}

export interface CallStats {
  answered: number;
  correct: number;
  /** 0-100 of the resolved calls answered */
  correctPct: number;
  bestStreak: number;
  matches: number;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  unlocked: boolean;
  progress: { have: number; need: number };
}

/** GET /api/site/profile */
export interface ProfileData extends ApiMeta {
  stats: CallStats;
  achievements: AchievementItem[];
}

export type MyCallStatus = "open" | "locked" | "won" | "missed" | "cancelled";

export interface MyCallRow {
  callId: string;
  matchId: string;
  matchTitle: string;
  question: string;
  myAnswer: string | null;
  /** once resolved */
  answer: string | null;
  status: MyCallStatus;
  points: number;
  /** iso */
  openedAt: string;
}

/** GET /api/site/calls?view=recent|history&match= */
export interface MyCallsData extends ApiMeta {
  calls: MyCallRow[];
  /** the matches in the list, for the history filter */
  matches: { matchId: string; title: string }[];
  totals: { answered: number; won: number; points: number };
}

/** GET /api/site/me: everything the chrome shows about the viewer */
export interface MeResponse extends ApiMeta {
  /** a guest (or the seeded demo fan) until they join */
  user: UserSummary;
  joined: boolean;
  nickname: string | null;
  language: Language;
  favorites: FavoriteTeam[];
  unreadNotifications: number;
  /** callId -> optionId for every call that is open or locked right now */
  openCallAnswers: Record<string, string>;
  /** liiga team ids the viewer chose to follow (empty for a guest, who sees the site's team) */
  follows: string[];
  notificationPrefs: NotificationPrefs;
  /** the pinned demo clock when DEMO_MODE is on */
  demo: { label: string; now: string } | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  /** iso */
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse extends ApiMeta {
  items: NotificationItem[];
  unread: number;
}

export type LeaderboardScope = "weekly" | "season" | "room";

/** GET /api/site/leaderboard?scope= */
export interface LeaderboardPageData extends ApiMeta {
  scope: LeaderboardScope;
  title: string;
  note: string;
  /** the top 20 */
  entries: SiteLeaderboardEntry[];
  /** the viewer's row when it isn't in the top 20 */
  you: SiteLeaderboardEntry | null;
  /** fans on this board */
  total: number;
}
