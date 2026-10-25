// pure: what one game means, read off a forecast. chances here are 0-1
import type { GameOutcome, Score } from "@/shared/types";
import type { ForcedForecast, TeamChances } from "./simulation";
import { compareRows, tableWithOutcome, type TableRow } from "./standings";

export type TeamSide = "home" | "away";

/** home-view outcome -> the same result from this side's view */
const flip: Record<GameOutcome, GameOutcome> = {
  regulationWin: "regulationLoss",
  overtimeWin: "overtimeLoss",
  overtimeLoss: "overtimeWin",
  regulationLoss: "regulationWin",
};

/** chances for one team under each result, from that team's point of view */
export function worthFor(forced: ForcedForecast, side: TeamSide): Record<GameOutcome, TeamChances> {
  const out = {} as Record<GameOutcome, TeamChances>;
  for (const o of Object.keys(forced.outcomes) as GameOutcome[]) {
    const teamView = side === "home" ? o : flip[o];
    out[teamView] = forced.outcomes[o][side];
  }
  return out;
}

const mix = (a: TeamChances, b: TeamChances, wa: number): TeamChances => ({
  playoffs: wa * a.playoffs + (1 - wa) * b.playoffs,
  top4: wa * a.top4 + (1 - wa) * b.top4,
  relegation: wa * a.relegation + (1 - wa) * b.relegation,
  positions: a.positions.map((p, i) => wa * p + (1 - wa) * b.positions[i]),
});

/**
 * "if it ends now": a lead is a regulation result; a tie goes to overtime, won by this team
 * with otWinRate (the league's home rate for the home side, its complement for the away side)
 */
export function ifEndsNow(worth: Record<GameOutcome, TeamChances>, own: number, other: number, otWinRate = 0.5): TeamChances {
  if (own > other) return worth.regulationWin;
  if (own < other) return worth.regulationLoss;
  return mix(worth.overtimeWin, worth.overtimeLoss, otWinRate);
}

export interface TimelinePoint {
  /** "Start", "1–0" */
  label: string;
  /** playoff chance 0-1 */
  chance: number;
  /** change from the previous point, 0-1; 0 for the start */
  delta: number;
  goalId?: string;
}

/**
 * a chance (the playoff chance by default) after each goal, as if the game ended right then.
 * goals in time order. a goal in period 4 or later (overtime, shootout) ends the game as an
 * overtime result
 */
export function chanceTimeline(
  goals: { id: string; homeScore: number; awayScore: number; period?: number }[],
  side: TeamSide,
  start: number,
  worth: Record<GameOutcome, TeamChances>,
  otWinRate = 0.5,
  metric: "playoffs" | "relegation" | "top4" = "playoffs",
): TimelinePoint[] {
  const points: TimelinePoint[] = [{ label: "Start", chance: start, delta: 0 }];
  for (const g of goals) {
    const own = side === "home" ? g.homeScore : g.awayScore;
    const other = side === "home" ? g.awayScore : g.homeScore;
    const extra = (g.period ?? 0) >= 4;
    const chance = extra ? (own > other ? worth.overtimeWin : worth.overtimeLoss)[metric] : ifEndsNow(worth, own, other, otWinRate)[metric];
    points.push({ label: `${g.homeScore}–${g.awayScore}`, chance, delta: chance - points[points.length - 1].chance, goalId: g.id });
  }
  return points;
}

/** the goal that moved this team's playoff chance most, either way */
export function goalOfTheGame(timeline: TimelinePoint[]): TimelinePoint | null {
  return timeline.slice(1).reduce<TimelinePoint | null>((best, p) => (!best || Math.abs(p.delta) > Math.abs(best.delta) ? p : best), null);
}

/** how much a game can swing both teams: playoff and relegation chance, win vs loss */
export function leverage(forced: ForcedForecast): number {
  const swing = (side: TeamSide) => {
    const w = worthFor(forced, side);
    return Math.abs(w.regulationWin.playoffs - w.regulationLoss.playoffs) + Math.abs(w.regulationWin.relegation - w.regulationLoss.relegation);
  };
  return swing("home") + swing("away");
}

/**
 * the table if the game ended at this score. a lead is a regulation result; a tie gives
 * both teams the overtime point they are already sure of
 */
export function tableIfEndsNow(
  table: TableRow[],
  game: { homeTeamId: string; awayTeamId: string },
  score: Score,
): (TableRow & { rank: number })[] {
  if (score.home !== score.away) {
    return tableWithOutcome(table, game, score.home > score.away ? "regulationWin" : "regulationLoss", score);
  }
  const rows = table.map((r) =>
    r.teamId === game.homeTeamId || r.teamId === game.awayTeamId
      ? { ...r, points: r.points + 1, goalsFor: r.goalsFor + score.home, goalsAgainst: r.goalsAgainst + score.home }
      : { ...r },
  );
  return rows.sort(compareRows).map((r, i) => ({ ...r, rank: i + 1 }));
}

export const rankOf = (table: { teamId: string }[], teamId: string) => table.findIndex((r) => r.teamId === teamId) + 1;
