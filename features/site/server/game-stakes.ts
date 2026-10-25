// what one game means for both teams, from the stakes engine.
// a finished game is judged as the season stood just before it started; a live or
// upcoming game against the season now
import type { LiigaFixture, LiigaGame } from "@/features/liiga";
import {
  chanceTimeline,
  forecastBefore,
  relevantMetric,
  type ChanceMetric,
  forecastNow,
  ifEndsNow,
  tableIfEndsNow,
  tableWithOutcome,
  worthFor,
  type ForecastResult,
  type SeasonContext,
  type TeamChances,
} from "@/features/stakes/server";
import type { GameOutcome, Score } from "@/shared/types";

type Side = "home" | "away";

export interface GameStakes {
  /** before the game starts */
  baseline: Record<Side, TeamChances>;
  worth: Record<Side, Record<GameOutcome, TeamChances>>;
  /** overtime win rate for each side */
  otRate: Record<Side, number>;
  /** the table before the game */
  table: ReturnType<typeof forecastNow>["world"]["table"];
}

/**
 * pass `shared` (one forecastNow over all of a page's games) to avoid a simulation per game;
 * a finished game always uses its own "just before" forecast
 */
export function gameStakes(ctx: SeasonContext, fixture: LiigaFixture, shared?: ForecastResult): GameStakes | null {
  const fr =
    fixture.status === "final"
      ? forecastBefore(ctx, fixture)
      : shared?.forecast.forced[fixture.id]
        ? shared
        : forecastNow(ctx, [fixture.id]);
  const forced = fr.forecast.forced[fixture.id];
  if (!forced) return null;
  const home = fr.forecast.teams[fixture.homeTeamId];
  const away = fr.forecast.teams[fixture.awayTeamId];
  if (!home || !away) return null;
  return {
    baseline: { home, away },
    worth: { home: worthFor(forced, "home"), away: worthFor(forced, "away") },
    otRate: { home: fr.model.otHomeWinRate, away: 1 - fr.model.otHomeWinRate },
    table: fr.world.table,
  };
}

const outcomeFor = (side: Side, score: Score, decidedIn: LiigaGame["decidedIn"]): GameOutcome => {
  const own = side === "home" ? score.home : score.away;
  const other = side === "home" ? score.away : score.home;
  const won = own > other;
  if (decidedIn === "regulation") return won ? "regulationWin" : "regulationLoss";
  return won ? "overtimeWin" : "overtimeLoss";
};

/** the chance for one side right now: the result if final, "if it ends now" if live, else before */
export function chanceNow(s: GameStakes, side: Side, game: Pick<LiigaGame, "status" | "decidedIn" | "home" | "away">): TeamChances {
  const score = { home: game.home.goals, away: game.away.goals };
  if (game.status === "final") return s.worth[side][outcomeFor(side, score, game.decidedIn)];
  if (game.status === "live") {
    const own = side === "home" ? score.home : score.away;
    const other = side === "home" ? score.away : score.home;
    return ifEndsNow(s.worth[side], own, other, s.otRate[side]);
  }
  return s.baseline[side];
}

export function timelineFor(s: GameStakes, side: Side, game: Pick<LiigaGame, "goals">, metric: ChanceMetric = "playoffs") {
  return chanceTimeline(game.goals, side, s.baseline[side][metric], s.worth[side], s.otRate[side], metric);
}

/**
 * the chance this game moves most for one team (playoff, relegation or top 4): the widest gap
 * between a win and a loss, or for a finished game the biggest change from before to after
 */
export function metricFor(s: GameStakes, side: Side, game: Pick<LiigaGame, "status" | "decidedIn" | "home" | "away">) {
  return relevantMetric({ worth: s.worth[side], before: s.baseline[side], after: game.status === "final" ? chanceNow(s, side, game) : null });
}

/** the table after the game (final) or if it ended now (live); the table before for an upcoming game */
export function projectedTable(s: GameStakes, game: Pick<LiigaGame, "status" | "decidedIn" | "home" | "away">) {
  const fx = { homeTeamId: game.home.teamId, awayTeamId: game.away.teamId };
  const score = { home: game.home.goals, away: game.away.goals };
  if (game.status === "final") return tableWithOutcome(s.table, fx, outcomeFor("home", score, game.decidedIn), score);
  if (game.status === "live") return tableIfEndsNow(s.table, fx, score);
  return s.table.map((r, i) => ({ ...r, rank: i + 1 }));
}
