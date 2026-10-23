import type { ControlRequest, RoomPhase } from "@/shared/types";
import { type ReplayClock, gameTimeAt } from "./clock";

export interface RoomClock extends ReplayClock {
  phase: RoomPhase;
}

/** what a host action does to the room clock. pure, the control route saves the result */
export function applyControl(room: RoomClock, req: ControlRequest, now: number): RoomClock {
  const t = gameTimeAt(room, now);
  const paused = { replayStartedAt: now, pausedAt: now, offsetSeconds: t };
  switch (req.action) {
    case "start":
      return { phase: "live", replayStartedAt: now, pausedAt: null, offsetSeconds: room.phase === "lobby" ? 0 : t };
    case "pause":
      return room.pausedAt ? room : { ...room, ...paused };
    case "resume":
      return { phase: "live", replayStartedAt: now, pausedAt: null, offsetSeconds: t };
    case "seek":
      return {
        ...room,
        replayStartedAt: now,
        pausedAt: room.pausedAt ? now : null,
        offsetSeconds: Math.max(0, req.seconds ?? t),
      };
    case "intermission":
      return { phase: "intermission", ...paused };
    case "finish":
      return { phase: "final", ...paused };
    case "reset":
      return { phase: "lobby", replayStartedAt: null, pausedAt: null, offsetSeconds: 0 };
  }
}
