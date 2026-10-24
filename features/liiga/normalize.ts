// pure: liiga dto -> our model. reads only spec fields (features/liiga/dto.ts)
import type {
  FinishedType,
  GameDTO,
  GameStatsDTO,
  GameSummaryDTO,
  GameTeamDTO,
  GamePlayersDTO,
  PastAndFutureGamesDTO,
  PlayerDTO,
  ScheduleItemDTO,
  ShotMapDTO,
  SimplePlayerDTO,
  StandingsResponseDTO,
  TeamsDTO,
} from "./dto";
import type {
  LiigaDecidedIn,
  LiigaFixture,
  LiigaGame,
  LiigaGameStats,
  LiigaGameSummary,
  LiigaGoal,
  LiigaLineups,
  LiigaPastAndFuture,
  LiigaRoster,
  RosterPlayer,
  LiigaPenalty,
  LiigaStandings,
  LiigaStatus,
  LiigaTeam,
  LineupPlayer,
  Pair,
  Side,
} from "./model";
import { matchIdOf } from "./model";

export const slugOf = (teamId: string) => teamId.split(":")[1] ?? teamId;
export function internalIdOf(teamId: string): number | null {
  const n = Number(teamId.split(":")[0]);
  return Number.isFinite(n) && teamId.includes(":") ? n : null;
}

export function statusOf(g: { started?: boolean | null; ended?: boolean | null; finishedType?: FinishedType | null }): LiigaStatus {
  if (g.finishedType === "CANCELLED") return "cancelled";
  if (g.ended) return "final";
  if (g.started) return "live";
  return "scheduled";
}

export function decidedInOf(t: FinishedType | null | undefined): LiigaDecidedIn | null {
  if (t === "ENDED_DURING_REGULAR_GAME_TIME") return "regulation";
  if (t === "ENDED_DURING_EXTENDED_GAME_TIME") return "overtime";
  if (t === "ENDED_DURING_WINNING_SHOT_COMPETITION") return "shootout";
  return null;
}

export const playerName = (p: SimplePlayerDTO | PlayerDTO | null | undefined): string | null => {
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
  return name || null;
};

/** a goal taken back after video review: the score doesn't move and there is no clip (goal-types.md) */
export const DISALLOWED_GOAL = "VT0";
/** a penalty shot that missed: listed with the goals, but the score doesn't move (goal-types.md) */
export const MISSED_PENALTY_SHOT = "RL0";
const NOT_A_GOAL = [DISALLOWED_GOAL, MISSED_PENALTY_SHOT];

function goalsOf(team: GameTeamDTO, side: Side): LiigaGoal[] {
  const teamId = team.teamId ?? side;
  return (team.goalEvents ?? []).filter((e) => !(e.goalTypes ?? []).some((t) => NOT_A_GOAL.includes(t))).map((e, i) => ({
    id: `g${e.eventId ?? `${side}-${i}`}`,
    teamId,
    side,
    gameTime: e.gameTime,
    period: e.period,
    scorer: playerName(e.scorerPlayer),
    scorerId: e.scorerPlayerId ?? e.scorerPlayer?.playerId ?? null,
    assists: (e.assistantPlayers ?? []).map(playerName).filter((n): n is string => !!n),
    assistIds: e.assistantPlayerIds ?? (e.assistantPlayers ?? []).map((p) => p.playerId).filter((n): n is number => typeof n === "number"),
    types: e.goalTypes ?? [],
    homeScore: e.homeTeamScore,
    awayScore: e.awayTeamScore,
    winningGoal: !!e.winningGoal,
    videoUrl: e.videoClipUrl || null,
    thumbUrl: e.videoThumbnailUrl || null,
  }));
}

function penaltiesOf(team: GameTeamDTO, side: Side): LiigaPenalty[] {
  const teamId = team.teamId ?? side;
  return (team.penaltyEvents ?? []).map((e, i) => ({
    id: `p${e.eventId ?? `${side}-${i}`}`,
    teamId,
    side,
    gameTime: e.gameTime,
    period: e.period,
    minutes: e.penaltyMinutes ?? 0,
    begin: e.penaltyBegintime ?? e.gameTime,
    end: e.penaltyEndtime ?? e.gameTime,
    fault: e.penaltyFaultName || null,
    playerId: e.playerId ?? null,
  }));
}

export function normalizeGame(g: GameDTO): LiigaGame {
  const side = (t: GameTeamDTO) => ({
    teamId: t.teamId ?? t.teamPlaceholder ?? "unknown",
    name: t.teamName ?? t.teamPlaceholder ?? "TBD",
    logo: t.logos?.lightBg || t.logos?.darkBg || null,
    goals: t.goals ?? 0,
  });
  const goals = [...goalsOf(g.homeTeam, "home"), ...goalsOf(g.awayTeam, "away")].sort(
    (a, b) => a.gameTime - b.gameTime || a.homeScore + a.awayScore - (b.homeScore + b.awayScore),
  );
  const penalties = [...penaltiesOf(g.homeTeam, "home"), ...penaltiesOf(g.awayTeam, "away")].sort((a, b) => a.gameTime - b.gameTime);
  const pp = (t: GameTeamDTO) =>
    t.powerplayInstances == null ? null : { instances: t.powerplayInstances, goals: t.powerplayGoals ?? 0 };
  const hp = pp(g.homeTeam);
  const ap = pp(g.awayTeam);
  return {
    id: matchIdOf(g.season, g.id),
    gameId: g.id,
    season: g.season,
    start: g.start,
    status: statusOf(g),
    decidedIn: decidedInOf(g.finishedType),
    home: side(g.homeTeam),
    away: side(g.awayTeam),
    currentPeriod: g.currentPeriod ?? null,
    gameTime: g.gameTime ?? 0,
    periods: (g.periods ?? []).map((p) => ({ index: p.index, category: p.category, home: p.homeTeamGoals, away: p.awayTeamGoals })),
    spectators: g.spectators ?? null,
    rink: g.iceRink?.name ?? null,
    goals,
    penalties,
    powerPlay: hp && ap ? { home: hp, away: ap } : null,
    video: g.videoURL ? { url: g.videoURL, thumb: g.thumbURL ?? null } : null,
  };
}

export function normalizeFixture(s: ScheduleItemDTO): LiigaFixture {
  const xg =
    s.expectedHomeTeamGoals != null && s.expectedAwayTeamGoals != null ? ([s.expectedHomeTeamGoals, s.expectedAwayTeamGoals] as Pair) : null;
  const status = statusOf(s);
  return {
    id: matchIdOf(s.season, s.id),
    gameId: s.id,
    season: s.season,
    start: s.start,
    status,
    decidedIn: decidedInOf(s.finishedType),
    homeTeamId: s.homeTeamId ?? "tbd-home",
    awayTeamId: s.awayTeamId ?? "tbd-away",
    homeName: s.homeTeamName ?? "TBD",
    awayName: s.awayTeamName ?? "TBD",
    homeGoals: status === "scheduled" ? null : (s.homeTeamGoals ?? null),
    awayGoals: status === "scheduled" ? null : (s.awayTeamGoals ?? null),
    xg: status === "final" ? xg : null,
    rink: s.iceRink?.name ?? null,
  };
}

export function normalizeStandings(r: StandingsResponseDTO): LiigaStandings {
  return {
    rows: r.items
      .map((i) => ({
        teamId: i.teamId ?? String(i.internalId),
        internalId: i.internalId,
        name: i.teamName ?? "",
        logoLight: i.teamLogos?.lightBg || null,
        logoDark: i.teamLogos?.darkBg || null,
        ranking: i.ranking,
        liveRanking: i.liveRanking,
        games: i.games,
        liveGames: i.liveGames,
        wins: i.wins,
        overtimeWins: i.overtimeWins,
        losses: i.losses,
        overtimeLosses: i.overtimeLosses,
        points: i.points ?? 0,
        livePoints: i.livePoints ?? i.points ?? 0,
        goals: i.goals,
        goalsAgainst: i.goalsAgainst,
        liveGoals: i.liveGoals,
        liveGoalsAgainst: i.liveGoalsAgainst,
      }))
      .sort((a, b) => a.ranking - b.ranking),
    playoffsLines: r.playoffsLines ?? [],
  };
}

export function normalizeTeams(t: TeamsDTO): LiigaTeam[] {
  return Object.values(t)
    .flat()
    .map((team) => ({
      id: team.id,
      internalId: internalIdOf(team.id),
      slug: slugOf(team.id),
      name: team.shortName ?? team.nameAbbreviation ?? slugOf(team.id),
      abbreviation: team.nameAbbreviation ?? team.shortName ?? slugOf(team.id).slice(0, 3).toUpperCase(),
      logoLight: team.logos?.lightBg || null,
      logoDark: team.logos?.darkBg || null,
    }));
}

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const share = (a: number, b: number): Pair | null => (a + b > 0 ? [Math.round((100 * a) / (a + b)), Math.round((100 * b) / (a + b))] : null);

/**
 * team stats from /stats (shots, pim, faceoffs, puck control), /shotmap (blocked shots)
 * and the game (power play). each one is null when its source is missing
 */
export function normalizeStats(
  stats: GameStatsDTO | null,
  shotmap: ShotMapDTO | null,
  game: Pick<LiigaGame, "home" | "away" | "powerPlay">,
): LiigaGameStats {
  const home = stats?.homeTeam ?? [];
  const away = stats?.awayTeam ?? [];
  const has = home.length > 0 && away.length > 0;
  const pair = (pick: (s: (typeof home)[number]) => number | null | undefined): Pair | null =>
    has ? [sum(home.map(pick)), sum(away.map(pick))] : null;

  const faceoffWins = pair((s) => s.faceOffWins);
  // a blocked shot belongs to the team that blocked it: the other side of a PLAYER_BLOCKED shot
  const homeId = Number(game.home.teamId.split(":")[0]);
  const awayId = Number(game.away.teamId.split(":")[0]);
  const blockedEvents = (shotmap?.gameShootingMap ?? []).filter((s) => s.eventType === "PLAYER_BLOCKED");
  const blockedShots: Pair | null =
    shotmap?.gameShootingMap && Number.isFinite(homeId) && Number.isFinite(awayId)
      ? [blockedEvents.filter((s) => s.shootingTeamId === awayId).length, blockedEvents.filter((s) => s.shootingTeamId === homeId).length]
      : null;

  const puck = stats?.puckStats ?? [];
  const control = puck.map((p) => ({
    period: p.periodNumber ?? 0,
    home: p.homeTeamControlDuration ?? 0,
    away: p.awayTeamControlDuration ?? 0,
  }));
  const momentumByPeriod = control
    .filter((p) => p.home + p.away > 0)
    .map((p) => ({ period: p.period, home: Math.round((100 * p.home) / (p.home + p.away)), away: Math.round((100 * p.away) / (p.home + p.away)) }));

  const ppFromStats =
    has && home.some((s) => Array.isArray(s.powerPlayInstances))
      ? {
          home: { goals: sum(home.map((s) => s.powerPlayGoals)), instances: sum(home.map((s) => s.powerPlayInstances?.length ?? 0)) },
          away: { goals: sum(away.map((s) => s.powerPlayGoals)), instances: sum(away.map((s) => s.powerPlayInstances?.length ?? 0)) },
        }
      : null;

  return {
    shots: pair((s) => s.shots),
    blockedShots,
    faceoffs: faceoffWins ? share(faceoffWins[0], faceoffWins[1]) : null,
    penaltyMinutes: pair((s) => s.penaltyMinutes),
    // the game's own power play counters are plain integers; the per-period stats are a fallback
    powerPlay: game.powerPlay ?? ppFromStats,
    momentum: control.length ? share(sum(control.map((c) => c.home)), sum(control.map((c) => c.away))) : null,
    momentumByPeriod,
  };
}

const lineup = (players: PlayerDTO[] | null | undefined): LineupPlayer[] =>
  (players ?? [])
    .map((p) => ({ name: playerName(p) ?? "—", jersey: p.jersey ?? null, role: p.role ?? null, line: p.line ?? null }))
    .sort((a, b) => (a.line ?? 99) - (b.line ?? 99) || (a.jersey ?? 99) - (b.jersey ?? 99));

export function normalizeLineups(p: GamePlayersDTO): LiigaLineups {
  return { home: lineup(p.homeTeamPlayers), away: lineup(p.awayTeamPlayers) };
}

const rosterOf = (players: PlayerDTO[] | null | undefined, side: Side): RosterPlayer[] =>
  (players ?? [])
    .filter((p) => p.id != null && !p.removed && (p.firstName || p.lastName))
    .map((p) => ({
      id: p.id!,
      teamId: p.teamId ?? side,
      side,
      name: playerName(p)!,
      firstName: p.firstName?.trim() ?? "",
      lastName: p.lastName?.trim() ?? "",
      jersey: p.jersey ?? null,
      role: p.role ?? null,
      line: p.line ?? null,
      birthDate: p.dateOfBirth ?? null,
      birthPlace: p.placeOfBirth?.trim() || null,
      birthCountry: p.countryOfBirth ?? null,
      nationality: p.nationality ?? null,
      height: p.height ?? null,
      weight: p.weight ?? null,
      captain: !!p.captain,
      pictureUrl: p.pictureUrl ?? null,
    }));

/** a game's two rosters with each player's details (the game details and /players both carry them) */
export function normalizeRoster(p: GamePlayersDTO): LiigaRoster {
  return { home: rosterOf(p.homeTeamPlayers, "home"), away: rosterOf(p.awayTeamPlayers, "away") };
}

const summary = (g: GameSummaryDTO): LiigaGameSummary => ({
  id: matchIdOf(g.season, g.gameId),
  start: g.gameStart,
  homeName: g.homeTeamName,
  awayName: g.awayTeamName,
  homeInternalId: g.homeTeamId ?? null,
  awayInternalId: g.awayTeamId ?? null,
  homeGoals: g.homeGoals,
  awayGoals: g.awayGoals,
  extraTime: g.extraTime,
  shootouts: g.shootouts,
});

export function normalizePastAndFuture(p: PastAndFutureGamesDTO): LiigaPastAndFuture {
  const byStart = (a: LiigaGameSummary, b: LiigaGameSummary) => a.start.localeCompare(b.start);
  return {
    pastBetween: (p.pastGamesBetweenTeams ?? []).map(summary).sort(byStart),
    futureHome: (p.futureGamesHomeTeam ?? []).map(summary).sort(byStart),
    futureAway: (p.futureGamesAwayTeam ?? []).map(summary).sort(byStart),
  };
}

/** player id -> name, from a game's players lists (used for penalties) */
export function playerNames(players: { homeTeamPlayers?: PlayerDTO[] | null; awayTeamPlayers?: PlayerDTO[] | null }): Map<number, string> {
  const out = new Map<number, string>();
  for (const p of [...(players.homeTeamPlayers ?? []), ...(players.awayTeamPlayers ?? [])]) {
    const n = playerName(p);
    if (p.id != null && n) out.set(p.id, n);
  }
  return out;
}
