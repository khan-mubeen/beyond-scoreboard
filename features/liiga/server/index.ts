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
import { describeGoalTypes } from "../goal-types";
import type { LiigaFixture, LiigaGame, LiigaGameStats, LiigaLineups, LiigaPastAndFuture, LiigaStandings, LiigaTeam } from "../model";
import {
  normalizeFixture,
  normalizeGame,
  normalizeLineups,
  normalizePastAndFuture,
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

/** "now" for the liiga data: the recording time when serving snapshots offline */
export function liigaNow(): Date {
  return client.offline && manifest ? new Date(manifest.recordedAt) : new Date();
}

/** yyyy-mm-dd in Helsinki, the calendar the league plays on */
export function helsinkiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

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
  return mapSourced(res, (d) => d.games.map(normalizeGame));
}

export async function getSchedule(season: number): Promise<Sourced<LiigaFixture[]>> {
  const res = await client.get<ScheduleItemDTO[]>(`/api/v1/games/schedule?season=${season}&serie=${SERIE}`, TTL.schedule);
  return mapSourced(res, (d) => d.map(normalizeFixture).sort((a, b) => a.start.localeCompare(b.start)));
}

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

export async function getGame(season: number, gameId: number): Promise<Sourced<GameWithNames>> {
  const res = await client.get<GameDetailsDTO>(`/api/v1/games/${season}/${gameId}`, (d) => byStatus(statusOf(d.game)));
  return mapSourced(res, (d) => {
    const game = normalizeGame(d.game);
    reportGoalTypes(game);
    return { game, names: playerNames(d) };
  });
}

export async function getGameStats(game: LiigaGame): Promise<Sourced<LiigaGameStats>> {
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
  return res && mapSourced(res, normalizePastAndFuture);
}

export { matchIdOf, parseMatchId } from "../model";
