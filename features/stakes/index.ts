// stakes public api, browser-safe. other features import only from here
// (or from @/features/stakes/server inside their own server/ folder)
export { ProjectedTable } from "./components/ProjectedTable";
export { SeasonStrip } from "./components/SeasonStrip";
export { StakesMeter } from "./components/StakesMeter";
export { playoffChance, zoneChancesFromPositions, zoneForRank, zoneLabel } from "./engine/zones";
export type { ProjectedRow, StakesCard, Zone, ZoneChances } from "@/shared/types";
