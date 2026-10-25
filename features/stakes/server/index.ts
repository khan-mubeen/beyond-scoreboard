// stakes server api. server only: never import this from browser code (lint enforces it).
// real forecasts come from forecast.ts; the mock card helpers below keep the
// original watch-party rooms (/room/...) and the dev pages running on shared/mock
import { mockFactInputs, mockRoomStates, mockStakesCard } from "@/shared/mock";
import type { FactInputs, StakesCard } from "@/shared/types";

export { checkRulesAgainstApi, forecastBefore, forecastNow, forecastWhatIf, getSeasonContext } from "./forecast";
export type { ForecastResult, SeasonContext } from "./forecast";
// the pure engine pieces the site and the live loop read forecasts with
export { METRIC_LABELS, metricNoun, relevantMetric, type ChanceMetric } from "../engine/metric";
export { chanceTimeline, goalOfTheGame, ifEndsNow, leverage, rankOf, tableIfEndsNow, worthFor } from "../engine/stakes";
export type { TimelinePoint } from "../engine/stakes";
export { compareRows, tableWithOutcome, type TableRow } from "../engine/standings";
export { OUTCOMES, type TeamChances } from "../engine/simulation";
export { zoneForRank, zoneLabel } from "../engine/zones";

export async function getStakes(teamId: string, gameId: string): Promise<StakesCard> {
  return { ...mockStakesCard, teamId, gameId };
}

/** a stakes card per score state, keyed "home-away" like "2-1" (mock room flow) */
export async function oddsByScoreState(gameId: string): Promise<Record<string, StakesCard>> {
  const out: Record<string, StakesCard> = {};
  for (const s of mockRoomStates) {
    const key = `${s.score.home}-${s.score.away}`;
    if (s.phase !== "final") out[key] ??= { ...s.stakes, gameId };
  }
  return out;
}

export async function getFactInputs(teamId: string, gameId: string): Promise<FactInputs> {
  return { ...mockFactInputs, teamId, gameId };
}
