// two clocks. leagueNow() is the moment the liiga data is read at: with DEMO_MODE=true it is the
// demoNow pinned in demo/rotation.json (frozen, so the demo can't drift when the pitch day moves),
// otherwise real time, or the snapshot's recording time (features/liiga registers that).
// userNow() is always real time: answers, points, weekly windows and the rotation schedule.
// server only (reads the demo config from disk)
import { loadRotation } from "./demo";

export const demoMode = () => process.env.DEMO_MODE === "true";

let pinned: Date | null | undefined;
/** the pinned demo moment, or null outside demo mode */
export function demoNow(): Date | null {
  if (!demoMode()) return null;
  if (pinned === undefined) {
    const config = loadRotation();
    pinned = config ? new Date(config.demoNow) : null;
    if (!pinned) console.warn("clock: DEMO_MODE=true but demo/rotation.json is missing (npm run demo:pick); using real time");
  }
  return pinned;
}

/** tests and scripts that change the demo config */
export function resetDemoClock() {
  pinned = undefined;
}

let fallback: () => Date = () => new Date();
/** what "now" means for liiga data outside demo mode (features/liiga: the snapshot time offline) */
export function setLeagueClock(now: () => Date) {
  fallback = now;
}

export const leagueNow = (): Date => demoNow() ?? fallback();
export const userNow = (): Date => new Date();

/** yyyy-mm-dd in Helsinki, the calendar the league plays on */
export function helsinkiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** the demo date ("2026-10-20"): in demo mode, no game from this date on has been played yet */
export function demoDate(): string | null {
  const d = demoNow();
  return d ? helsinkiDate(d) : null;
}

/** true for a game the demo clock says hasn't been played yet */
export function notPlayedYet(start: string): boolean {
  const d = demoDate();
  return d !== null && helsinkiDate(new Date(start)) >= d;
}

/** "Demo · Tue 20 Oct 2026" for the top nav chip */
export function demoLabel(): string | null {
  const d = demoNow();
  if (!d) return null;
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `Demo · ${f.format(d).replace(",", "")}`;
}
