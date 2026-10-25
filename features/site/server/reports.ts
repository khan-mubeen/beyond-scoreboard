// "report a mistake" under every generated text: what's wrong, stored for the editors (/editor).
// moderated like the feed (the guardrails, a profanity list, 280 characters) and one report every
// 20 s per fan
import { getDb, type DbReport } from "@/shared/db";
import { ensureUser, type Viewer } from "./identity";
import { moderate } from "./social";

const EVERY_MS = 20_000;
const last = new Map<string, number>();

export class ReportError extends Error {
  constructor(
    readonly status: 400 | 422 | 429,
    message: string,
  ) {
    super(message);
  }
}

export async function reportMistake(viewer: Viewer, r: { refKind: DbReport["refKind"]; refKey: string; matchId: string | null; message: string }, now = Date.now()): Promise<DbReport> {
  const message = r.message.trim();
  if (message.length < 3) throw new ReportError(400, "say what's wrong in a few words");
  const problem = moderate(message);
  if (problem) throw new ReportError(422, problem);
  const user = await ensureUser(viewer);
  if (now - (last.get(user.id) ?? 0) < EVERY_MS) throw new ReportError(429, "one report every 20 seconds");
  last.set(user.id, now);
  return getDb().reports.create({ refKind: r.refKind, refKey: r.refKey, matchId: r.matchId, message, userId: user.id });
}
