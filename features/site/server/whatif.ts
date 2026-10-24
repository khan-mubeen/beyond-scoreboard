// "what if?": set this match's result and up to three other unplayed games, see how the playoff
// race changes. the other games are simulated as usual (same seeded seasons as the stakes card,
// so a set "win" gives exactly the card's "win" number). only games not played as of the
// league clock can be set
import { forecastNow, forecastWhatIf, getSeasonContext, type SeasonContext, type TeamChances } from "@/features/stakes/server";
import { helsinkiDate } from "@/shared/clock";
import type { GameOutcome, WhatIfChances, WhatIfOptions, WhatIfOverride, WhatIfResult } from "@/shared/types";
import { pct, shortDate, timeLabel } from "./labels";
import { teamBook } from "./teams";

export const WHAT_IF_MAX = 4;

export class WhatIfError extends Error {}

const unplayed = (ctx: SeasonContext) => ctx.schedule.filter((f) => f.status !== "final" && f.status !== "cancelled");

/** this match and the other unplayed games on its date; null when the match is decided */
export async function whatIfOptions(ctx: SeasonContext, matchId: string): Promise<WhatIfOptions | null> {
  const open = unplayed(ctx);
  const match = open.find((f) => f.id === matchId);
  if (!match) return null;
  const book = await teamBook();
  const day = helsinkiDate(new Date(match.start));
  const others = open.filter((f) => f.id !== matchId && helsinkiDate(new Date(f.start)) === day).sort((a, b) => a.start.localeCompare(b.start));
  return {
    games: [match, ...others].map((f) => ({
      gameId: f.id,
      home: book.ref(f.homeTeamId, f.homeName),
      away: book.ref(f.awayTeamId, f.awayName),
      when: `${shortDate(new Date(f.start))} · ${timeLabel(new Date(f.start))}`,
    })),
    max: WHAT_IF_MAX,
  };
}

const chances = (c: TeamChances | undefined): WhatIfChances => ({ playoffs: pct(c?.playoffs ?? 0), top4: pct(c?.top4 ?? 0), relegation: pct(c?.relegation ?? 0) });

const cache = new Map<string, WhatIfResult>();

export async function whatIf(matchId: string, overrides: WhatIfOverride[]): Promise<WhatIfResult> {
  const ctx = await getSeasonContext();
  const open = new Map(unplayed(ctx).map((f) => [f.id, f]));
  const match = open.get(matchId);
  if (!match) throw new WhatIfError(ctx.schedule.some((f) => f.id === matchId) ? "this match is already played" : "unknown match");
  const ids = overrides.map((o) => o.gameId);
  if (new Set(ids).size !== ids.length) throw new WhatIfError("each game once");
  const played = ids.filter((id) => !open.has(id));
  if (played.length) throw new WhatIfError(`already played or unknown: ${played.join(", ")}`);

  const fixed: Record<string, GameOutcome> = Object.fromEntries(overrides.map((o) => [o.gameId, o.outcome]));
  // the same picks in any order are one entry
  const canonical = `${ctx.asOf}|${matchId}|${Object.keys(fixed).sort().map((id) => `${id}=${fixed[id]}`).join(",")}`;
  const hit = cache.get(canonical);
  if (hit) return hit;

  const before = forecastNow(ctx, [matchId]).forecast.teams;
  const after = forecastWhatIf(ctx, fixed).forecast.teams;
  const book = await teamBook();
  const teamIds = [...new Set([match.homeTeamId, match.awayTeamId, ...ids.flatMap((id) => [open.get(id)!.homeTeamId, open.get(id)!.awayTeamId])])];
  const result: WhatIfResult = {
    matchId,
    overrides: [...overrides].sort((a, b) => a.gameId.localeCompare(b.gameId)),
    teams: teamIds.map((id) => ({ team: book.ref(id), before: chances(before[id]), after: chances(after[id]) })),
    asOf: ctx.asOf,
    source: ctx.source,
  };
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  cache.set(canonical, result);
  return result;
}

// a fan clicking around is a few requests a minute; this stops a script hammering the simulator
const RATE = { windowMs: 60_000, max: 30 };
const hits = new Map<string, number[]>();
export function allowWhatIf(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}
