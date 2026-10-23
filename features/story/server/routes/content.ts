import type { RequestHandler } from "express";
import type { ContentKind, Language } from "@/shared/types";
import { generateContent } from "../index";

/** GET /api/content/{brief|story}?teamId=&gameId=&language=en -> 200 Content */
function contentHandler(kind: ContentKind): RequestHandler {
  return async (req, res) => {
    const { teamId, gameId, language = "en" } = req.query;
    if (typeof teamId !== "string" || typeof gameId !== "string") {
      res.status(400).json({ error: "teamId and gameId are required" });
      return;
    }
    if (language !== "en" && language !== "fi") {
      res.status(400).json({ error: "language must be en or fi" });
      return;
    }
    res.json(await generateContent(kind, teamId, gameId, language as Language));
  };
}

export const getBrief = contentHandler("brief");
export const getStory = contentHandler("story");
