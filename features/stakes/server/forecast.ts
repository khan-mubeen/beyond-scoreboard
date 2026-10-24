// season forecasts on real liiga data, cached per standings version.
// server only. the maths is pure and lives in features/stakes/engine
import { getSchedule, getSeason, getStandings, type DataSource } from "@/features/liiga/server";
import type { LiigaFixture } from "@/features/liiga";
import type { GameOutcome } from "@/shared/types";
import { checkPlayoffLines } from "../engine/rules.config";
import { simulateSeason, type Forecast } from "../engine/simulation";
import { fitStrength, type StrengthModel } from "../engine/strength";
import { worldAt, worldKey, type World } from "../engine/world";

const RUNS = Number(process.env.SIM_RUNS ?? 10_000);

export interface SeasonContext {
  season: number;
  schedule: LiigaFixture[];
  source: DataSource;
  asOf: string;
}

export interface ForecastResult {
  world: World;
  model: StrengthModel;
  forecast: Forecast;
}

export async function getSeasonContext(): Promise<SeasonContext> {
  const season = await getSeason();
  const s = await getSchedule(season);
  return { season, schedule: s.data, source: s.source, asOf: s.asOf };
}

const cache = new Map<string, ForecastResult>();
function remember(key: string, make: () => ForecastResult): ForecastResult {
  const hit = cache.get(key);
  if (hit) return hit;
  const value = make();
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
}

function run(world: World, targets: string[], fixed?: Record<string, GameOutcome>): ForecastResult {
  const model = fitStrength(world.teamIds, world.results);
  const forecast = simulateSeason({ table: world.table, remaining: world.remaining, model, n: RUNS, targets, fixed });
  return { world, model, forecast };
}

/** the season as it stands now, with forced results for the target games */
export function forecastNow(ctx: SeasonContext, targets: string[]): ForecastResult {
  const world = worldAt(ctx.schedule);
  const live = new Set(world.remaining.map((f) => f.id));
  const t = [...new Set(targets)].filter((id) => live.has(id)).sort();
  return remember(`now:${worldKey(world)}:${t.join(",")}`, () => run(world, t));
}

/**
 * "what if?": the season now with some unplayed games' results set (home team's view), the rest
 * simulated as usual. throws for a game that is already decided
 */
export function forecastWhatIf(ctx: SeasonContext, fixed: Record<string, GameOutcome>): ForecastResult {
  const world = worldAt(ctx.schedule);
  const open = new Set(world.remaining.map((f) => f.id));
  const ids = Object.keys(fixed).sort();
  const played = ids.filter((id) => !open.has(id));
  if (played.length) throw new Error(`already played: ${played.join(", ")}`);
  return remember(`whatif:${worldKey(world)}:${ids.map((id) => `${id}=${fixed[id]}`).join(",")}`, () => run(world, [], fixed));
}

/**
 * the season as it stood just before a game started, with that game forced: what a finished
 * game meant at the time, even if more games have been played since
 */
export function forecastBefore(ctx: SeasonContext, game: Pick<LiigaFixture, "id" | "start">): ForecastResult {
  const world = worldAt(ctx.schedule, { before: game.start });
  return remember(`before:${game.id}:${worldKey(world)}`, () => run(world, [game.id]));
}

/** compares our zone lines with the api's playoffsLines and logs any difference */
export async function checkRulesAgainstApi() {
  try {
    const season = await getSeason();
    const s = await getStandings(season, false);
    const problems = checkPlayoffLines(s.data.playoffsLines);
    if (problems.length) for (const p of problems) console.warn(`stakes: ${p}`);
    else console.log(`stakes: zone lines match the api (${s.data.playoffsLines.join(", ")}), ${RUNS} runs per forecast`);
  } catch (err) {
    console.warn(`stakes: could not check zone lines (${(err as Error).message})`);
  }
}
