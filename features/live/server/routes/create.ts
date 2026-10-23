import type { RequestHandler } from "express";
import { DEMO_GAME_ID } from "@/shared/mock";
import type { CreateRoomResponse } from "@/shared/types";
import { store } from "../index";

/** POST /api/rooms { gameId? } -> 201 { code } */
export const createRoom: RequestHandler = (req, res) => {
  const gameId = typeof req.body?.gameId === "string" ? req.body.gameId : DEMO_GAME_ID;
  const room = store.createRoom(gameId);
  res.status(201).json({ code: room.code } satisfies CreateRoomResponse);
};
