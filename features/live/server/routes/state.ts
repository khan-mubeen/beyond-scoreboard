import type { RequestHandler } from "express";
import { getRoomState } from "../index";

/** GET /api/rooms/:code/state?playerId= -> 200 RoomState. polled every second */
export const roomState: RequestHandler<{ code: string }> = async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
  const state = await getRoomState(req.params.code, playerId);
  if (!state) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  res.set("cache-control", "no-store").json(state);
};
