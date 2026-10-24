// answering a call. the server is the only judge: a call that is locked, resolved or cancelled,
// or past its lock time, takes no answers (409), and one answer per fan per call
import { getDb } from "@/shared/db";

export type AnswerResult = { status: 201 } | { status: 400 | 404 | 409; error: string };

export async function answerCall(callId: string, userId: string, optionId: string, now = Date.now()): Promise<AnswerResult> {
  const db = getDb();
  const call = await db.calls.get(callId);
  if (!call) return { status: 404, error: "call not found" };
  if (call.status === "cancelled") return { status: 409, error: "this call was cancelled" };
  if (call.status !== "open" || now >= new Date(call.locksAt).getTime()) return { status: 409, error: "this call is locked" };
  if (!call.options.some((o) => o.id === optionId)) return { status: 400, error: "unknown option" };
  const saved = await db.answers.create({ callId, userId, optionId, answeredAt: new Date(now).toISOString() });
  if (saved === "duplicate") return { status: 409, error: "already answered" };
  return { status: 201 };
}
