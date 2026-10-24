// pure: the season split into what is decided and what is still to play, at any moment
import type { Fixture } from "./simulation";
import { buildTable, type DecidedIn, type TableRow } from "./standings";
import type { StrengthResult } from "./strength";

/** the fields of a schedule entry the engine reads (matches features/liiga LiigaFixture) */
export interface ScheduleGame {
  id: string;
  start: string;
  status: "scheduled" | "live" | "final" | "cancelled";
  decidedIn: DecidedIn | null;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  xg: [number, number] | null;
}

export interface World {
  teamIds: string[];
  results: StrengthResult[];
  remaining: Fixture[];
  table: TableRow[];
}

const decided = (g: ScheduleGame) => g.status === "final" && g.decidedIn !== null && g.homeGoals !== null && g.awayGoals !== null;

/**
 * the season as it stood. "now" counts every finished game; `before` (an iso start time)
 * counts only games that started earlier, so a past game can be judged as it was then
 */
export function worldAt(schedule: ScheduleGame[], opts: { before?: string } = {}): World {
  const teamIds = [...new Set(schedule.flatMap((g) => [g.homeTeamId, g.awayTeamId]))].filter((id) => !id.startsWith("tbd"));
  const counts = (g: ScheduleGame) => decided(g) && (!opts.before || g.start < opts.before);
  const results: StrengthResult[] = [];
  const remaining: Fixture[] = [];
  for (const g of schedule) {
    if (g.status === "cancelled") continue;
    if (counts(g)) {
      results.push({
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        homeGoals: g.homeGoals!,
        awayGoals: g.awayGoals!,
        decidedIn: g.decidedIn!,
        xg: g.xg,
      });
    } else {
      remaining.push({ id: g.id, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId });
    }
  }
  return { teamIds, results, remaining, table: buildTable(teamIds, results) };
}

/** a short key for a world, so forecasts can be cached per standings version */
export function worldKey(w: World): string {
  let h = 2166136261;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  };
  for (const r of w.results) feed(`${r.homeTeamId}${r.homeGoals}${r.awayGoals}${r.decidedIn}${r.awayTeamId}`);
  feed(String(w.remaining.length));
  return (h >>> 0).toString(36);
}
