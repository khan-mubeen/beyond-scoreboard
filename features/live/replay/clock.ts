import { PERIOD_SECONDS, REGULATION_SECONDS } from "./state-at";

export interface ReplayClock {
  /** ms epoch when the replay last started or resumed, null before start */
  replayStartedAt: number | null;
  /** ms epoch when paused, null while running */
  pausedAt: number | null;
  /** game seconds already played before replayStartedAt */
  offsetSeconds: number;
}

/** stub: one game second per wall second. todo: replay speed, intermission gaps, clamp at game end */
export function gameTimeAt(clock: ReplayClock, nowMs: number): number {
  if (clock.replayStartedAt === null) return clock.offsetSeconds;
  const until = clock.pausedAt ?? nowMs;
  return clock.offsetSeconds + Math.max(0, Math.floor((until - clock.replayStartedAt) / 1000));
}

/** 1-3, then 4 for overtime. a boundary belongs to the period it ends (1200 is P1 20:00) */
export function periodAt(t: number): number {
  if (t > REGULATION_SECONDS) return 4;
  return Math.max(1, Math.ceil(t / PERIOD_SECONDS));
}

/** "P2 04:15", time elapsed in the period */
export function formatGameClock(t: number): string {
  const p = periodAt(t);
  const inPeriod = Math.max(0, t - (p - 1) * PERIOD_SECONDS);
  const mm = String(Math.floor(inPeriod / 60)).padStart(2, "0");
  const ss = String(inPeriod % 60).padStart(2, "0");
  return `${p > 3 ? "OT" : `P${p}`} ${mm}:${ss}`;
}
