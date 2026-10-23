import type { Zone, ZoneChances } from "@/shared/types";
import { RULES } from "./rules.config";

export function zoneForRank(rank: number): Zone {
  const hit = RULES.zones.find((z) => rank >= z.from && rank <= z.to);
  if (!hit) throw new Error(`rank ${rank} is outside the table`);
  return hit.zone;
}

export function zoneLabel(zone: Zone): string {
  return RULES.zones.find((z) => z.zone === zone)?.label ?? zone;
}

/** sums position chances into zone chances */
export function zoneChancesFromPositions(positionOdds: number[]): ZoneChances {
  const out: ZoneChances = { top4: 0, playoffs: 0, safe: 0, relegated: 0 };
  positionOdds.forEach((p, i) => {
    out[zoneForRank(i + 1)] += p;
  });
  return out;
}

/** "playoff chance" in the ui means top4 + playoffs */
export function playoffChance(z: ZoneChances): number {
  return z.top4 + z.playoffs;
}
