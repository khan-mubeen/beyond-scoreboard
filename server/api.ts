// every api route in one place. each handler lives in its feature's server/routes/
import { Router } from "express";
import { submitAnswer } from "@/features/live/server/routes/answers";
import { controlRoom } from "@/features/live/server/routes/control";
import { createRoom } from "@/features/live/server/routes/create";
import { joinRoom } from "@/features/live/server/routes/join";
import { roomState } from "@/features/live/server/routes/state";
import { getBrief, getStory } from "@/features/story/server/routes/content";
import { getVerificationReport } from "@/features/story/server/routes/verification";

export const api = Router();

// room codes are case-insensitive: /api/rooms/test works like /api/rooms/TEST
api.param("code", (req, _res, next, code: string) => {
  req.params.code = code.toUpperCase();
  next();
});

api.post("/rooms", createRoom);
api.post("/rooms/:code/join", joinRoom);
api.post("/rooms/:code/control", controlRoom);
api.get("/rooms/:code/state", roomState);
api.post("/rooms/:code/answers", submitAnswer);

api.get("/content/brief", getBrief);
api.get("/content/story", getStory);
api.get("/content/:id/verification", getVerificationReport);

api.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});
