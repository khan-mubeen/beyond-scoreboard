// the one chance a game moves most for a team: playoff, relegation or top-4. a team with no
// playoff hope is about relegation, a team sure of the playoffs about the top 4, everyone else
// about the playoffs, measured by the gap between a regulation win and loss (or, once played,
// by how far the result moved each chance). pure: the server and the what if? panel both use it
import type { GameOutcome } from "@/shared/types";

export type ChanceMetric = "playoffs" | "relegation" | "top4";

/** any record of the three chances (0-1, or 0-100: only differences and order matter) */
export interface Chances {
  playoffs: number;
  relegation: number;
  top4: number;
}

export const METRIC_LABELS: Record<ChanceMetric, string> = { playoffs: "Playoff chance", relegation: "Relegation chance", top4: "Top-4 chance" };
/** for a sentence: "playoff chance", "relegation chance", "top-4 chance" */
export const metricNoun = (m: ChanceMetric) => METRIC_LABELS[m].toLowerCase();

// on a tie the order decides: playoffs, then relegation, then top 4
const ORDER: ChanceMetric[] = ["playoffs", "relegation", "top4"];
/** less than this (on a 0-1 scale) is no movement at all */
const NOTHING = 0.005;

function widest(gap: (m: ChanceMetric) => number, scale: number): ChanceMetric | null {
  const best = ORDER.reduce((a, b) => (gap(b) > gap(a) ? b : a));
  return gap(best) >= NOTHING * scale ? best : null;
}

/**
 * the metric to show for one team and one game. `worth`: the chances for each way the game can
 * end; `before` and `after`: the chances before the game and after its result (a finished game).
 * when nothing moves, the level decides: no playoff hope means relegation, a sure place top 4
 */
export function relevantMetric(a: { worth?: Partial<Record<GameOutcome, Chances>> | null; before?: Chances | null; after?: Chances | null }): { metric: ChanceMetric; label: string } {
  const { worth, before, after } = a;
  const scale = Math.max(before?.playoffs ?? 0, after?.playoffs ?? 0, worth?.regulationWin?.playoffs ?? 0) > 1 ? 100 : 1;
  const pick = (m: ChanceMetric) => ({ metric: m, label: METRIC_LABELS[m] });
  if (before && after) {
    const moved = widest((m) => Math.abs(after[m] - before[m]), scale);
    if (moved) return pick(moved);
  }
  const win = worth?.regulationWin;
  const loss = worth?.regulationLoss;
  if (win && loss) {
    const swing = widest((m) => Math.abs(win[m] - loss[m]), scale);
    if (swing) return pick(swing);
  }
  const level = before ?? after ?? win ?? loss;
  if (level && level.playoffs <= 0.01 * scale) return pick("relegation");
  if (level && level.playoffs >= 0.99 * scale) return pick("top4");
  return pick("playoffs");
}
