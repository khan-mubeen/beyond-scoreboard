// who is watching a match right now, for the watch together count: every match page sends a
// heartbeat every 30 s while it is visible, and a leave when it is hidden or closed. a viewer
// counts while seen in the last 90 s; bots never count. in memory (one server process)
import { refreshRoom } from "@/features/live/server";

export const ACTIVE_MS = 90_000;
/** how often timed-out viewers are swept (and the count re-broadcast) */
const SWEEP_MS = 15_000;

/** match -> viewer (the anonymous cookie id) -> last seen */
const seen = new Map<string, Map<string, number>>();

/** a heartbeat; true when the viewer wasn't counted before (the count went up) */
export function heartbeat(matchId: string, viewer: string, now = Date.now()): boolean {
  const m = seen.get(matchId) ?? new Map<string, number>();
  seen.set(matchId, m);
  const was = m.get(viewer);
  m.set(viewer, now);
  return was === undefined || now - was >= ACTIVE_MS;
}

/** the page closed; true when the viewer was counted (the count went down) */
export function leave(matchId: string, viewer: string, now = Date.now()): boolean {
  const m = seen.get(matchId);
  const was = m?.get(viewer);
  m?.delete(viewer);
  return was !== undefined && now - was < ACTIVE_MS;
}

export function watchingCount(matchId: string, now = Date.now()): number {
  let n = 0;
  for (const t of seen.get(matchId)?.values() ?? []) if (now - t < ACTIVE_MS) n++;
  return n;
}

/** drops viewers not seen for 90 s; the matches whose count went down */
export function expire(now = Date.now()): string[] {
  const changed: string[] = [];
  for (const [matchId, m] of seen) {
    let dropped = false;
    for (const [viewer, t] of m) {
      if (now - t >= ACTIVE_MS) {
        m.delete(viewer);
        dropped = true;
      }
    }
    if (dropped) changed.push(matchId);
    if (!m.size) seen.delete(matchId);
  }
  return changed;
}

/** the count or the board changed: everyone on the match page hears it (the room event) */
export const roomChanged = (matchId: string) => refreshRoom(matchId).catch((err) => console.warn(`presence: ${(err as Error).message}`));

let sweeping: ReturnType<typeof setInterval> | null = null;
export function startPresenceSweep() {
  sweeping ??= setInterval(() => {
    for (const matchId of expire()) void roomChanged(matchId);
  }, SWEEP_MS);
  sweeping.unref?.();
}

/** tests */
export function resetPresence() {
  seen.clear();
}
