// publishes match events to supabase realtime (broadcast) on private channels "match:{id}".
// server only: uses the secret key over rest, no websocket. fans can only receive (see
// supabase/migrations/*_realtime_match_channels.sql). payloads are checked for betting fields
import { findGamblingFields } from "@/features/liiga";

export type MatchEvent =
  | "state"
  | "stakes"
  | "call_open"
  | "call_locked"
  | "call_resolved"
  | "call_cancelled"
  | "leaderboard"
  | "comment"
  | "game_end";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
let warned = false;

/** sent messages, kept briefly for tests and the gambling-field check */
export const recentBroadcasts: { topic: string; event: MatchEvent; payload: unknown }[] = [];

export async function publish(matchId: string, messages: { event: MatchEvent; payload: Record<string, unknown> }[]): Promise<boolean> {
  if (messages.length === 0) return true;
  for (const m of messages) {
    const leaked = findGamblingFields(m.payload);
    if (leaked.length) throw new Error(`refusing to broadcast betting fields: ${leaked.join(", ")}`);
    recentBroadcasts.push({ topic: `match:${matchId}`, event: m.event, payload: m.payload });
  }
  if (recentBroadcasts.length > 500) recentBroadcasts.splice(0, recentBroadcasts.length - 500);
  if (!url || !key) {
    if (!warned) console.log("realtime: SUPABASE_URL / SUPABASE_SECRET_KEY missing, clients fall back to polling /state");
    warned = true;
    return false;
  }
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: messages.map((m) => ({ topic: `match:${matchId}`, event: m.event, payload: m.payload, private: true })) }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok && !warned) {
      console.warn(`realtime: broadcast failed (http ${res.status}), clients fall back to polling`);
      warned = true;
    }
    return res.ok;
  } catch (err) {
    if (!warned) console.warn(`realtime: broadcast failed (${(err as Error).message}), clients fall back to polling`);
    warned = true;
    return false;
  }
}
