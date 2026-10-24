// a match's live state: supabase realtime broadcast on "match:{id}" (receive only), with GET /state
// on subscribe or reconnect, and polling every 3 s while realtime is not SUBSCRIBED (none within
// 5 s, a drop, or ?realtime=off). the server is the only authority. used by the match page, tv mode
// and the home page's featured card. with `presence`, the page also tells the server it is being
// watched (every 30 s while visible, and when it closes) for the watch together count
import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import { useEffect, useRef, useState } from "react";
import type { LiveCall, LiveState, MatchEvent } from "@/shared/types";
import { noteServerNow } from "../data";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const POLL_MS = 3000;
const SUBSCRIBE_GRACE_MS = 5000;
export const HEARTBEAT_MS = 30_000;

export type Connection = "connecting" | "realtime" | "polling";

const realtimeOff = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("realtime") === "off";

function mergeEvents(old: MatchEvent[], fresh: MatchEvent[]): MatchEvent[] {
  const byId = new Map(old.map((e) => [e.id, e]));
  for (const e of fresh) byId.set(e.id, e);
  // newest first, like the server sends them: by period, then clock
  return [...byId.values()].sort((a, b) => b.period.localeCompare(a.period) || b.time.localeCompare(a.time));
}

/** applies one broadcast to the state */
export function applyBroadcast(s: LiveState, event: string, p: Record<string, unknown>): LiveState {
  switch (event) {
    case "state":
      return {
        ...s,
        ...(p as Partial<LiveState>),
        events: mergeEvents(s.events, (p.events as MatchEvent[]) ?? []),
      };
    case "stakes":
      return { ...s, stakes: { ...s.stakes, ...(p as Partial<LiveState["stakes"]>) } };
    case "call_open":
      return { ...s, call: p.call as LiveCall };
    case "call_locked":
      return s.call && s.call.id === p.callId ? { ...s, call: { ...s.call, status: "locked", split: (p.split as Record<string, number>) ?? null } } : s;
    case "call_resolved": {
      const base = s.call?.id === p.callId ? s.call : s.lastCall?.id === p.callId ? s.lastCall : null;
      if (!base) return s;
      const done: LiveCall = { ...base, status: "resolved", correctOptionId: p.correctOptionId as string, split: (p.split as Record<string, number>) ?? base.split };
      return { ...s, call: s.call?.id === p.callId ? done : s.call, lastCall: done };
    }
    case "call_cancelled": {
      const base = s.call?.id === p.callId ? s.call : null;
      if (!base) return s;
      const done: LiveCall = { ...base, status: "cancelled", reason: (p.reason as string) ?? null };
      return { ...s, call: done, lastCall: done };
    }
    // the room changed (a fan joined, left or timed out): the active count and the board
    case "leaderboard":
    case "room":
      return { ...s, leaderboard: (p.leaderboard as LiveState["leaderboard"]) ?? s.leaderboard, watching: (p.watching as number) ?? s.watching };
    default:
      return s;
  }
}

/** tells the server this page is open (or closed): the watch together count */
function sendPresence(id: string, leave = false) {
  const url = `/api/site/matches/${encodeURIComponent(id)}/presence`;
  const body = JSON.stringify({ leave });
  // a closing page can't wait for fetch
  if (leave && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export interface MatchChannelOptions {
  /** a broadcast arrived; return true when it was handled here and the state should not merge it */
  onMessage?: (event: string, payload: Record<string, unknown>) => boolean | void;
  /** a fresh snapshot from GET /state */
  onSnapshot?: (s: LiveState) => void;
  /** count this page as watching (match pages, not the home card) */
  presence?: boolean;
}

export function useMatchChannel(id: string | null, opts: MatchChannelOptions = {}) {
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const handlers = useRef(opts);
  useEffect(() => {
    handlers.current = opts;
  });
  const presence = !!opts.presence;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let subscribed = false;

    const fetchState = async () => {
      try {
        const r = await fetch(`/api/site/matches/${id}/state`, { credentials: "same-origin", cache: "no-store" });
        if (!r.ok || cancelled) return;
        const s = (await r.json()) as LiveState;
        noteServerNow(s.serverNow);
        setState(s);
        handlers.current.onSnapshot?.(s);
      } catch {
        // next poll or broadcast catches up
      }
    };
    const startPolling = () => {
      if (poll || cancelled) return;
      setConnection("polling");
      poll = setInterval(fetchState, POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    void fetchState();
    let client: RealtimeClient | null = null;
    let channel: RealtimeChannel | null = null;
    const grace = setTimeout(() => !subscribed && startPolling(), SUBSCRIBE_GRACE_MS);

    if (URL_ && KEY && !realtimeOff()) {
      client = new RealtimeClient(`${URL_.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: KEY } });
      client.setAuth(KEY);
      channel = client.channel(`match:${id}`, { config: { private: true } });
      channel.on("broadcast", { event: "*" }, (msg) => {
        if (cancelled) return;
        const payload = (msg.payload ?? {}) as Record<string, unknown>;
        if (typeof payload.serverNow === "number") noteServerNow(payload.serverNow);
        if (handlers.current.onMessage?.(msg.event, payload)) return;
        if (msg.event === "game_end") return void fetchState();
        setState((s) => (s ? applyBroadcast(s, msg.event, payload) : s));
      });
      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          stopPolling();
          setConnection("realtime");
          void fetchState(); // catch up on anything missed while connecting
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribed = false;
          startPolling();
        }
      });
    } else {
      startPolling();
    }

    return () => {
      cancelled = true;
      clearTimeout(grace);
      stopPolling();
      if (channel) void client?.removeChannel(channel);
      client?.disconnect();
    };
  }, [id]);

  // watching: a heartbeat while the page is visible, a leave when it's hidden or closed
  useEffect(() => {
    if (!id || !presence || typeof document === "undefined") return;
    let beat: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (beat) return;
      sendPresence(id);
      beat = setInterval(() => sendPresence(id), HEARTBEAT_MS);
    };
    const stop = (leave: boolean) => {
      if (beat) clearInterval(beat);
      beat = null;
      if (leave) sendPresence(id, true);
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop(true));
    const onHide = () => stop(true);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      stop(true);
    };
  }, [id, presence]);

  return { state, setState, connection };
}
