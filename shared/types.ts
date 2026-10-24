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

// ---------- site (kaleva sports pages) ----------
// percentages here are whole numbers 0-100 ("66" means 66%), changes are percentage points

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

export type QuickLinkIcon = "home" | "calls" | "history" | "rewards" | "achievements" | "settings";

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
  /** null before puck drop */
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
  openCalls: number;
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
  /** "11th if it ends now" next to the highlighted row */
  highlightNote: string;
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
  featured: FeaturedMatch;
  seasonStakesToday: StakesStripItem[];
  live: MatchSummary[];
  upcoming: MatchSummary[];
  recent: MatchSummary[];
  comingSoon: ComingSoonCard[];
  leaderboard: { title: string; sponsor: string; entries: SiteLeaderboardEntry[]; href: string };
  table: LiigaTableData;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface VideoInfo {
  poster: string;
  /** "Match highlights · 3:12" */
  title: string;
}

/** a goal or other event in the match feed, newest first */
export interface MatchEvent {
  id: string;
  /** "11:40" in the period */
  time: string;
  /** "2nd period" */
  period: string;
  title: string;
  detail: string;
  /** playoff chance effect in percentage points, null when none */
  effect: number | null;
  video: VideoInfo;
}

/** one match statistic. null values render as "Data pending" */
export interface MatchStat {
  id: string;
  label: string;
  home: number | null;
  away: number | null;
  unit?: string;
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
}

/** someone's comment in the match discussion */
export interface Comment {
  id: string;
  author: string;
  text: string;
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
  spectators: number;
  stakesSummary: StakesChipData[];
  video: VideoInfo;
  seasonStakes: SeasonStakes;
  events: MatchEvent[];
  eventsNote: string;
  stats: MatchStat[];
  statsSource: string;
  statsNote: string;
}

export interface LiveMatchDetail extends MatchDetailBase {
  status: "live";
  whatItMeans: string;
  discussion: Comment[];
  guidelinesHref: string;
  callIt: CallItState;
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
  goalOfTheGame: {
    thumbnail: string;
    meta: string;
    title: string;
    effectText: string;
    chip: string;
    video: VideoInfo;
  };
  yourNight: { points: number; callsCorrect: number; callsTotal: number; rank: number; of: number; bestCall: string };
  room: RoomSummary;
  discussionHighlights: Comment[];
  nextUp: { title: string; when: string; worth: string };
}

export type MatchDetail = LiveMatchDetail | FinishedMatchDetail;

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
