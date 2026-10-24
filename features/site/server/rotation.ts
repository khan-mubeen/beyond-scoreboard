// GET /api/site/rotation: the demo rotation as everyone sees it (no cues, nothing secret):
// what's on, how long it lasts, what's next. the host page, tv mode and the summary banner use it
import { rotationConfig, rotationNow } from "@/features/live/server";
import type { RotationInfo } from "@/shared/types";

export function rotationInfo(now = Date.now()): RotationInfo | null {
  const r = rotationNow(now);
  const config = rotationConfig();
  if (!r || !config) return null;
  const title = (matchId: string) => config.matches.find((m) => m.matchId === matchId)?.title ?? matchId;
  return {
    serverNow: now,
    cycle: r.cycle,
    paused: r.paused,
    current: { matchId: r.current.matchId, title: title(r.current.matchId), phase: r.phase, phaseStartedAt: r.phaseStart, phaseEndsAt: r.phaseEnd },
    next: { matchId: r.next.matchId, title: title(r.next.matchId), startsAt: r.next.lobbyAt },
    matches: r.slots.map((s) => ({ matchId: s.matchId, title: title(s.matchId), lobbyAt: s.lobbyAt, liveAt: s.liveAt, summaryAt: s.summaryAt, endsAt: s.endsAt })),
    asOf: new Date(now).toISOString(),
    source: "config",
  };
}
