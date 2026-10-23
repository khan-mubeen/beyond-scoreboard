import type { RequestHandler } from "express";
import type { AnswerRequest } from "@/shared/types";
import { isLate } from "../../calls/lock";
import { roomNow, store } from "../index";

/**
 * POST /api/rooms/:code/answers { playerId, callId, optionId } -> 201 { ok }
 * 409 when late or already answered. never returns the correct option
 */
export const submitAnswer: RequestHandler<{ code: string }> = (req, res) => {
  const body = req.body as Partial<AnswerRequest> | undefined;
  if (!body?.playerId || !body.callId || !body.optionId) {
    res.status(400).json({ error: "playerId, callId and optionId are required" });
    return;
  }
  const room = store.getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: "room not found" });
    return;
  }
  if (!store.listPlayers(room.code).some((p) => p.id === body.playerId)) {
    res.status(404).json({ error: "player not found" });
    return;
  }

  const { t, calls } = roomNow(room);
  const call = calls.find((c) => c.id === body.callId);
  if (!call) {
    res.status(404).json({ error: "call not found" });
    return;
  }
  if (isLate(call, t)) {
    res.status(409).json({ error: "this call is locked" });
    return;
  }
  if (!call.options.some((o) => o.id === body.optionId)) {
    res.status(400).json({ error: "unknown option" });
    return;
  }

  const saved = store.saveAnswer(room.code, {
    playerId: body.playerId,
    callId: call.id,
    optionId: body.optionId,
    answeredAt: Date.now(),
    gameTimeSeconds: t,
  });
  if (!saved) {
    res.status(409).json({ error: "already answered" });
    return;
  }
  res.status(201).json({ ok: true });
};
