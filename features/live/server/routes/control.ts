import type { RequestHandler } from "express";
import type { ControlAction, ControlRequest } from "@/shared/types";
import { applyControl } from "../../replay/control";
import { store } from "../index";

const ACTIONS: ControlAction[] = ["start", "pause", "resume", "seek", "intermission", "finish", "reset"];

/** POST /api/rooms/:code/control { action, seconds? } -> 200 { phase }. todo: host auth */
export const controlRoom: RequestHandler<{ code: string }> = (req, res) => {
  const body = req.body as Partial<ControlRequest> | undefined;
  if (!body?.action || !ACTIONS.includes(body.action)) {
    res.status(400).json({ error: `action must be one of ${ACTIONS.join(", ")}` });
    return;
  }
  const room = store.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  const next = applyControl(room, { action: body.action, seconds: body.seconds }, Date.now());
  store.updateRoom(room.code, next);
  res.json({ phase: next.phase });
};
