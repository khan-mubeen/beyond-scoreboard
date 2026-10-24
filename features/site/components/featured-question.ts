// what the home card says about the featured match's your call! question, from the live state
import type { LiveState } from "@/shared/types";

export type FeaturedQuestion = { kind: "open"; secondsLeft: number } | { kind: "soon" } | null;

/**
 * "Question open now · 0:14" only while a question really takes answers (status open and the
 * lock still ahead on the server's clock), "Next question soon" in the live phase (and a lobby),
 * nothing before or after the game
 */
export function featuredQuestion(state: Pick<LiveState, "status" | "call" | "rotation"> | null, serverNow: number): FeaturedQuestion {
  if (!state) return null;
  const call = state.call;
  if (call?.status === "open" && call.locksAt > serverNow) return { kind: "open", secondsLeft: Math.ceil((call.locksAt - serverNow) / 1000) };
  const phase = state.rotation?.phase;
  if (phase === "summary" || phase === "idle") return null;
  return state.status === "live" || phase === "lobby" ? { kind: "soon" } : null;
}
