// stakes public api, browser-safe. other features import only from here
// (or from @/features/stakes/server inside their own server/ folder)
export { ProjectedTable } from "./components/ProjectedTable";
export { SeasonStrip } from "./components/SeasonStrip";
export { StakesMeter } from "./components/StakesMeter";
export { playoffChance, zoneChancesFromPositions, zoneForRank, zoneLabel } from "./engine/zones";
// the chance a game moves most for a team (playoff, relegation or top 4), for every chance shown
export { METRIC_LABELS, metricNoun, relevantMetric, type ChanceMetric, type Chances } from "./engine/metric";
export type { ProjectedRow, StakesCard, Zone, ZoneChances } from "@/shared/types";
