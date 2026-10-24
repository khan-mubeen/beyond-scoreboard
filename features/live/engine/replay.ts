// pure: a finished game replayed as live. only what happened at or before game time t exists:
// goals and penalties up to t, the score from those goals, and no final totals before the end.
// a penalty still running at t gets its planned end, because the real end may be a future goal
import type { LiigaGame, LiigaPeriod } from "@/features/liiga";

export const PERIOD = 1200;
export const REGULATION = 3 * PERIOD;
export const OT_END = REGULATION + 300;

/** game seconds at which the replayed game ends */
export function replayEnd(full: LiigaGame): number {
  if (full.decidedIn === "shootout") return OT_END + 1;
  if (full.decidedIn === "overtime") return Math.max(REGULATION + 1, ...full.goals.map((g) => g.gameTime));
  return REGULATION;
}

/** 1-3 regulation, 4 overtime, 5 shootout */
export function periodAt(t: number): number {
  if (t <= 0) return 1;
  if (t <= REGULATION) return Math.ceil(t / PERIOD);
  return t <= OT_END ? 4 : 5;
}

export function gameAt(full: LiigaGame, t: number): LiigaGame {
  const end = replayEnd(full);
  // game time is whole seconds, like the api's; the replay clock runs in fractions
  const at = Math.max(0, Math.min(Math.floor(t), end));
  const goals = full.goals.filter((g) => g.gameTime <= at);
  const penalties = full.penalties
    .filter((p) => p.gameTime <= at)
    .map((p) => (p.end > at ? { ...p, end: p.begin + p.minutes * 60 } : p));
  const home = goals.filter((g) => g.side === "home").length;
  const away = goals.length - home;
  const final = t >= end;
  const periods: LiigaPeriod[] = full.periods.map((p) => ({
    ...p,
    home: goals.filter((g) => g.period === p.index && g.side === "home").length,
    away: goals.filter((g) => g.period === p.index && g.side === "away").length,
  }));
  return {
    ...full,
    status: t <= 0 ? "scheduled" : final ? "final" : "live",
    decidedIn: final ? full.decidedIn : null,
    home: { ...full.home, goals: home },
    away: { ...full.away, goals: away },
    currentPeriod: t <= 0 ? null : periodAt(at),
    gameTime: at,
    periods,
    goals,
    penalties,
    // final totals would give the ending away
    powerPlay: final ? full.powerPlay : null,
    video: final ? full.video : null,
  };
}

export interface ReplayClock {
  /** ms epoch when the clock last started, null before start */
  startedAt: number | null;
  /** ms epoch when paused, null while running */
  pausedAt: number | null;
  /** game seconds already played before startedAt */
  offset: number;
  speed: number;
}

/** replay clock = (server now − start) × speed, plus what was played before a pause or skip */
export function replayTime(c: ReplayClock, now: number): number {
  if (c.startedAt === null) return c.offset;
  const until = c.pausedAt ?? now;
  return c.offset + Math.max(0, (until - c.startedAt) / 1000) * c.speed;
}

/** the next moment a call could open: the next goal, penalty or period start after t */
export function nextMomentAfter(full: LiigaGame, t: number): number | null {
  const moments = [...full.goals.map((g) => g.gameTime), ...full.penalties.map((p) => p.gameTime), PERIOD, 2 * PERIOD, REGULATION - 300]
    .filter((x) => x > t + 1)
    .sort((a, b) => a - b);
  return moments[0] ?? null;
}
