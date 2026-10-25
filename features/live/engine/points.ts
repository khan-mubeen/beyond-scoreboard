// pure: the fixed points of everything a fan can call. never points that depend on a chance or on
// how the crowd answered
import type { GameOutcome } from "@/shared/types";

export const CALL_POINTS = 20;
export const TRIVIA_POINTS = 10;
/** the match prediction (who wins, made before the game) */
export const PREDICTION_POINTS = 30;

/** the call type of the match prediction */
export const PREDICTION_TYPE = "who_wins";

export type PointsSource = "call" | "prediction" | "trivia";

/** what kind of call a call type is, for the points breakdown */
export const sourceOf = (type: string): PointsSource => (type === "trivia" ? "trivia" : type === PREDICTION_TYPE ? "prediction" : "call");

export const pointsFor = (type: string) => ({ call: CALL_POINTS, prediction: PREDICTION_POINTS, trivia: TRIVIA_POINTS })[sourceOf(type)];

/** the prediction's options as what if? outcomes (home team's view) */
export const PREDICTION_OUTCOMES: Record<string, GameOutcome> = {
  home_win: "regulationWin",
  home_ot: "overtimeWin",
  away_ot: "overtimeLoss",
  away_win: "regulationLoss",
};
