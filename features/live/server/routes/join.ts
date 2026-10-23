import type { RequestHandler } from "express";
import type { JoinResponse } from "@/shared/types";
import { store } from "../index";

/** POST /api/rooms/:code/join { nickname } -> 201 { code, playerId } */
export const joinRoom: RequestHandler<{ code: string }> = (req, res) => {
  const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : "";
  if (nickname.length < 1 || nickname.length > 20) {
    res.status(400).json({ error: "nickname must be 1-20 characters" });
    return;
  }
  const player = store.addPlayer(req.params.code, nickname);
  if (!player) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  res.status(201).json({ code: req.params.code, playerId: player.id } satisfies JoinResponse);
};
