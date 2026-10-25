// liiga server api. server only: never import this from browser code (lint enforces it).
// every getter returns normalised data plus where it came from (live api or snapshot) and when
import type {
  GameDetailsDTO,
  GamePlayersDTO,
  GamesDTO,
  GameStatsDTO,
  PastAndFutureGamesDTO,
  ScheduleItemDTO,
  ShotMapDTO,
  StandingsResponseDTO,
  TeamsDTO,
  TournamentDTO,
} from "../dto";
import { helsinkiDate, leagueNow, notPlayedYet, setLeagueClock } from "@/shared/clock";
import { describeGoalTypes } from "../goal-types";
import { maskPastAndFuture, unplayedFixture, unplayedGame } from "../mask";
import type { LiigaFixture, LiigaGame, LiigaGameStats, LiigaLineups, LiigaPastAndFuture, LiigaRoster, LiigaStandings, LiigaTeam, PlayerSeasonStats } from "../model";
import {
  normalizeFixture,
  normalizeGame,
  normalizeLineups,
  normalizePastAndFuture,
  normalizeRoster,
  normalizeStandings,
  normalizeStats,
  normalizeTeams,
  playerNames,
  statusOf,
} from "../normalize";
import { LiigaClient, setSnapshotAsOf, type Sourced } from "./client";
import { readManifest } from "./snapshots";

export type { DataSource, Sourced } from "./client";

const SERIE = "RUNKOSARJA";
const S = 1000;
export const TTL = {
  live: 10 * S,
  today: 30 * S,
  schedule: 10 * 60 * S,
  teams: 24 * 60 * 60 * S,
  final: 24 * 60 * 60 * S,
} as const;

const manifest = readManifest();
setSnapshotAsOf(manifest?.recordedAt ?? null);

const client = new LiigaClient(process.env.LIIGA_API_URL, process.env.LIIGA_API_KEY, process.env.USE_SNAPSHOT === "true");

/** pings the api on startup and logs the answer */
export const initLiiga = () => client.ensureReady();
export const liigaOffline = () => client.offline;
/** for the snapshot recorder only */
export const liigaClient = client;

// outside demo mode, "now" for the liiga data is the recording time when serving snapshots offline
setLeagueClock(() => (client.offline && manifest ? new Date(manifest.recordedAt) : new Date()));

/** "now" for the liiga data: the pinned demo moment in demo mode (shared/clock) */
export const liigaNow = leagueNow;
export { helsinkiDate };

// demo mode: every game from the demo date on is served as not played yet (see ../mask.ts)
const maskGame = (g: LiigaGame) => (notPlayedYet(g.start) ? unplayedGame(g) : g);
const maskFixture = (f: LiigaFixture) => (notPlayedYet(f.start) ? unplayedFixture(f) : f);

const mapSourced = <A, B>(s: Sourced<A>, f: (a: A) => B): Sourced<B> => ({ ...s, data: f(s.data) });

const reported = new Set<string>();
function reportGoalTypes(game: LiigaGame) {
  for (const g of game.goals) {
    for (const code of describeGoalTypes(g.types).unknown) {
      if (reported.has(code)) continue;
      reported.add(code);
      console.log(`liiga: unconfirmed goalTypes code "${code}" (game ${game.id}), shown as-is. see docs/api/goal-types.md`);
    }
  }
  // the replay and the pages count goal events; a new "doesn't count" code would break the score
  const home = game.goals.filter((g) => g.side === "home").length;
  const away = game.goals.length - home;
  if ((home !== game.home.goals || away !== game.away.goals) && !reported.has(game.id)) {
    reported.add(game.id);
    console.warn(`liiga: ${game.id} goal events add up to ${home}-${away}, the score is ${game.home.goals}-${game.away.goals}. see docs/api/goal-types.md`);
  }
}

export async function getSeason(): Promise<number> {
  const t = await client.get<TournamentDTO>("/api/v1/games/web/tournament", TTL.schedule);
  return t.data.season;
}

export async function getGamesOn(date: string): Promise<Sourced<LiigaGame[]>> {
  const today = helsinkiDate(liigaNow());
  const res = await client.get<GamesDTO>(`/api/v1/games?date=${date}&serie=${SERIE}`, (d) =>
    d.games.some((g) => statusOf(g) === "live") ? TTL.live : date === today ? TTL.today : date < today ? TTL.final : TTL.schedule,
  );
  return mapSourced(res, (d) => d.games.map(normalizeGame).map(maskGame));
}

export async function getSchedule(season: number): Promise<Sourced<LiigaFixture[]>> {
  const res = await client.get<ScheduleItemDTO[]>(`/api/v1/games/schedule?season=${season}&serie=${SERIE}`, TTL.schedule);
  return mapSourced(res, (d) => d.map(normalizeFixture).map(maskFixture).sort((a, b) => a.start.localeCompare(b.start)));
}

/**
 * the api's table. in demo mode it already counts games after the demo date: for points and
 * positions use the stakes engine's table on the (masked) schedule; names and lines are fine
 */
export async function getStandings(season: number, live = true): Promise<Sourced<LiigaStandings>> {
  const res = await client.get<StandingsResponseDTO>(`/api/v1/standings/${SERIE}?season=${season}&isLive=${live}`, TTL.live);
  return mapSourced(res, normalizeStandings);
}

export async function getTeams(season: number): Promise<Sourced<LiigaTeam[]>> {
  const res = await client.get<TeamsDTO>(`/api/v1/teams?serie=${SERIE}&season=${season}`, TTL.teams);
  return mapSourced(res, normalizeTeams);
}

const byStatus = (status: string) => (status === "live" ? TTL.live : status === "final" ? TTL.final : TTL.today);

export interface GameWithNames {
  game: LiigaGame;
  /** player id -> name, for penalties */
  names: Map<number, string>;
}

/** a game; in demo mode one not played yet is masked, unless `unmasked` (the rotation engine replaying it) */
export async function getGame(season: number, gameId: number, opts: { unmasked?: boolean } = {}): Promise<Sourced<GameWithNames>> {
  const res = await client.get<GameDetailsDTO>(`/api/v1/games/${season}/${gameId}`, (d) => byStatus(statusOf(d.game)));
  return mapSourced(res, (d) => {
    const game = normalizeGame(d.game);
    reportGoalTypes(game);
    return { game: opts.unmasked ? game : maskGame(game), names: playerNames(d) };
  });
}

/** team stats; none for a game the demo clock hasn't played yet (a replay passes its own state) */
export async function getGameStats(game: LiigaGame): Promise<Sourced<LiigaGameStats>> {
  if (game.status !== "final" && notPlayedYet(game.start)) {
    return { data: normalizeStats(null, null, game), source: "live", asOf: new Date().toISOString() };
  }
  const ttl = byStatus(game.status);
  const [stats, shots] = await Promise.all([
    client.get<GameStatsDTO>(`/api/v1/games/${game.season}/${game.gameId}/stats`, ttl).catch(() => null),
    client.get<ShotMapDTO>(`/api/v1/shotmap/${game.season}/${game.gameId}`, ttl).catch(() => null),
  ]);
  const source = stats?.source === "snapshot" || shots?.source === "snapshot" ? "snapshot" : "live";
  return {
    data: normalizeStats(stats?.data ?? null, shots?.data ?? null, game),
    source,
    asOf: stats?.asOf ?? shots?.asOf ?? new Date().toISOString(),
  };
}

export async function getLineups(game: LiigaGame): Promise<Sourced<LiigaLineups> | null> {
  const res = await client.get<GamePlayersDTO>(`/api/v1/games/${game.season}/${game.gameId}/players`, byStatus(game.status)).catch(() => null);
  return res && mapSourced(res, normalizeLineups);
}

export async function getPastAndFuture(game: LiigaGame): Promise<Sourced<LiigaPastAndFuture> | null> {
  const res = await client
    .get<PastAndFutureGamesDTO>(`/api/v1/games/${game.season}/${game.gameId}/pastAndFutureGames`, TTL.schedule)
    .catch(() => null);
  return res && mapSourced(res, (d) => maskPastAndFuture(normalizePastAndFuture(d), notPlayedYet));
}

/** a game's two rosters with each player's details (from the game details, which carry them) */
export async function getRoster(season: number, gameId: number): Promise<Sourced<LiigaRoster>> {
  const res = await client.get<GameDetailsDTO>(`/api/v1/games/${season}/${gameId}`, (d) => byStatus(statusOf(d.game)));
  return mapSourced(res, normalizeRoster);
}

const SEASON_TTL_MS = 10 * 60 * 1000;
let seasonStats: { key: string; at: number; value: Promise<SeasonStats> } | null = null;

export interface SeasonStats {
  /** player id -> games, goals and assists */
  players: Map<number, PlayerSeasonStats>;
  /** player id -> each game they played this season so far, oldest first (hot streaks) */
  log: Map<number, PlayerGameLine[]>;
  /** finished games counted, and the ones whose details couldn't be read (a missing snapshot) */
  games: number;
  missing: number;
}

/**
 * every player's regular season so far, counted from the goal events of every finished game
 * before the league clock: in demo mode nothing after the demo date is counted. games are read
 * a few at a time and cached (24 h for a final), the totals for 10 minutes
 */
export interface PlayerGameLine {
  matchId: string;
  start: string;
  /** the team they played for, their name and photo then */
  teamId: string;
  name: string;
  picture: string | null;
  goals: number;
  assists: number;
}

export function getSeasonStats(season: number): Promise<SeasonStats> {
  const key = `${season}:${helsinkiDate(leagueNow())}`;
  if (seasonStats && seasonStats.key === key && Date.now() - seasonStats.at < SEASON_TTL_MS) return seasonStats.value;
  const value = (async () => {
    const schedule = await getSchedule(season);
    const nowIso = leagueNow().toISOString();
    const played = schedule.data.filter((f) => f.status === "final" && f.start < nowIso);
    const players = new Map<number, PlayerSeasonStats>();
    const row = (id: number) => players.get(id) ?? players.set(id, { games: 0, goals: 0, assists: 0 }).get(id)!;
    const log = new Map<number, PlayerGameLine[]>();
    let missing = 0;
    for (let i = 0; i < played.length; i += 4) {
      await Promise.all(
        played.slice(i, i + 4).map(async (f) => {
          const res = await client.get<GameDetailsDTO>(`/api/v1/games/${f.season}/${f.gameId}`, TTL.final).catch(() => null);
          if (!res) return void missing++;
          const game = normalizeGame(res.data.game);
          const tonight = new Map<number, { goals: number; assists: number }>();
          const line = (id: number) => tonight.get(id) ?? tonight.set(id, { goals: 0, assists: 0 }).get(id)!;
          for (const g of game.goals) {
            // shootout goals don't count as goals in the season totals
            if (g.period > 4) continue;
            if (g.scorerId !== null) {
              row(g.scorerId).goals++;
              line(g.scorerId).goals++;
            }
            for (const a of g.assistIds) {
              row(a).assists++;
              line(a).assists++;
            }
          }
          for (const p of [...(res.data.homeTeamPlayers ?? []), ...(res.data.awayTeamPlayers ?? [])]) {
            if (p.id == null || p.removed) continue;
            row(p.id).games++;
            const t = tonight.get(p.id) ?? { goals: 0, assists: 0 };
            const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
            (log.get(p.id) ?? log.set(p.id, []).get(p.id)!).push({ matchId: f.id, start: f.start, teamId: p.teamId ?? "", name, picture: p.pictureUrl ?? null, ...t });
          }
        }),
      );
    }
    if (missing) console.warn(`liiga: season stats count ${played.length - missing} of ${played.length} games (${missing} without details; npm run snapshot -- --season)`);
    for (const lines of log.values()) lines.sort((a, b) => a.start.localeCompare(b.start));
    return { players, log, games: played.length - missing, missing };
  })();
  value.catch(() => (seasonStats = null));
  seasonStats = { key, at: Date.now(), value };
  return value;
}

export { matchIdOf, parseMatchId } from "../model";
