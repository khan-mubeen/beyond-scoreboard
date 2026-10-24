// the demo rotation on the server (DEMO_MODE=true): the three matches from demo/rotation.json,
// and the clock (epoch, paused, run) from the settings table, re-read every 5 s so npm run
// demo:reset and the host controls take effect everywhere. the maths is ../engine/rotation.ts
import { demoMode } from "@/shared/clock";
import { getDb } from "@/shared/db";
import { loadRotation, type RotationConfig, type RotationMatchConfig } from "@/shared/demo";
import { controlClock, rotationAt, type RotationAction, type RotationClock, type RotationNow, type RotationPhase, type Slot } from "../engine/rotation";

export const ROTATION_KEY = "rotation";
type Saved = { epoch: string; pausedAt: string | null; run?: number; cycle?: { key: string; startedAt: string } };

let config: RotationConfig | null = null;
let clock: RotationClock | null = null;
// the cycle on now, and when it really began: skips and pauses move the epoch, not this
let cycle: { key: string; startedAt: number } | null = null;

const toSaved = (): Saved => ({
  epoch: new Date(clock!.epoch).toISOString(),
  pausedAt: clock!.pausedAt === null ? null : new Date(clock!.pausedAt).toISOString(),
  run: clock!.run,
  ...(cycle && { cycle: { key: cycle.key, startedAt: new Date(cycle.startedAt).toISOString() } }),
});
// a host action here wins over a refresh that read the clock just before it
let changedAt = 0;
const save = () => {
  changedAt = Date.now();
  return getDb()
    .settings.set(ROTATION_KEY, toSaved())
    .catch((err) => console.warn(`demo: could not save the rotation clock (${(err as Error).message})`));
};

async function refreshClock() {
  const asked = Date.now();
  const saved = await getDb()
    .settings.get<Saved>(ROTATION_KEY)
    .catch(() => null);
  if (changedAt >= asked - 1000) return;
  if (saved) {
    clock = { epoch: Date.parse(saved.epoch), pausedAt: saved.pausedAt ? Date.parse(saved.pausedAt) : null, run: saved.run ?? Date.parse(saved.epoch) };
    if (saved.cycle) cycle = { key: saved.cycle.key, startedAt: Date.parse(saved.cycle.startedAt) };
  } else if (!clock) {
    clock = { epoch: Date.now(), pausedAt: null, run: Date.now() };
    await save();
  }
}

/** loads the config and the clock (startup); null when the rotation is off */
export async function initRotation(): Promise<RotationConfig | null> {
  if (!demoMode()) return null;
  try {
    config = loadRotation();
  } catch (err) {
    console.error(`demo: ${(err as Error).message}`);
    config = null;
  }
  if (!config) {
    console.warn("demo: DEMO_MODE=true but there is no valid demo/rotation.json (npm run demo:pick); the rotation is off");
    return null;
  }
  await refreshClock();
  setInterval(() => void refreshClock(), 5000).unref();
  const titles = config.matches.map((m) => `${m.title} (${Math.round(m.durationSec)} s, ${m.cuesSource})`).join(", ");
  console.log(`demo: rotation of ${titles}; lobby ${config.lobbySeconds} s, summary ${config.summarySeconds} s`);
  return config;
}

export const rotationConfig = () => config;

const timing = () =>
  config && { lobbySeconds: config.lobbySeconds, summarySeconds: config.summarySeconds, matches: config.matches.map((m) => ({ matchId: m.matchId, durationSec: m.durationSec })) };

/** the rotation now, plus its cycle's name and real start; null outside demo mode */
export type ServerRotation = RotationNow & { cycleKey: string; cycleStartedAt: number };

export function rotationNow(now = Date.now()): ServerRotation | null {
  const t = timing();
  if (!t || !clock) return null;
  const r = rotationAt(t, clock, now);
  const key = `${clock.run ?? clock.epoch}:${r.cycle}`;
  if (cycle?.key !== key) {
    cycle = { key, startedAt: Math.min(now, r.cycleStart) };
    void save();
  }
  return { ...r, cycleKey: key, cycleStartedAt: cycle.startedAt };
}

export const rotationMatch = (matchId: string): RotationMatchConfig | null => config?.matches.find((m) => m.matchId === matchId) ?? null;
export const isRotationMatch = (matchId: string) => rotationMatch(matchId) !== null;

/** one match's phase: its own lobby, live or summary while it is on, else idle */
export function phaseOf(matchId: string, now = Date.now()): { phase: RotationPhase | "idle"; slot: Slot; r: ServerRotation } | null {
  const r = rotationNow(now);
  const slot = r?.slots.find((s) => s.matchId === matchId);
  if (!r || !slot) return null;
  return { phase: r.current.matchId === matchId ? r.phase : "idle", slot, r };
}

/** host controls: restart from match 1, skip to the next phase, pause, resume */
export async function controlRotation(action: RotationAction): Promise<ServerRotation | null> {
  const t = timing();
  if (!t || !clock) return null;
  clock = controlClock(t, clock, action, Date.now());
  const r = rotationNow();
  await save();
  return r;
}
