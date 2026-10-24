// a match's live state: supabase realtime broadcast on "match:{id}" (receive only), with GET /state
// on subscribe or reconnect, and polling every second while realtime is not SUBSCRIBED (none
// within 5 s, a drop, or ?realtime=off): a chat line or a reaction still reaches everyone within
// about a second (the server's per-match caches are cleared on every write, so a poll right after
// one sees it). the server is the only authority. polling carries everything the
// channel does: the party (board, who's here, watching), its feed (chat, system lines, fact cards),
// reaction bursts, the answer count and trivia, so a browser without realtime misses nothing.
// used by the match page, tv mode and the home page's featured card. with `presence`, the page
// also tells the server it is being watched (every 30 s while visible, and when it closes)
import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import { useEffect, useRef, useState } from "react";
import type { Burst, Comment, LiveCall, LiveState, MatchEvent, PartyMember } from "@/shared/types";
import { noteServerNow, serverNowMs } from "../data";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const POLL_MS = 1000;
const SUBSCRIBE_GRACE_MS = 5000;
export const HEARTBEAT_MS = 30_000;
/** the feed keeps this many items in the browser */
const FEED_MAX = 80;

export type Connection = "connecting" | "realtime" | "polling";

const realtimeOff = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("realtime") === "off";

function mergeEvents(old: MatchEvent[], fresh: MatchEvent[]): MatchEvent[] {
  const byId = new Map(old.map((e) => [e.id, e]));
  for (const e of fresh) byId.set(e.id, e);
  // newest first, like the server sends them: by period, then clock
  return [...byId.values()].sort((a, b) => b.period.localeCompare(a.period) || b.time.localeCompare(a.time));
}

/** the feed, oldest first, each item once (a broadcast and the next poll can bring the same one) */
export function mergeFeed(old: Comment[] | undefined, fresh: Comment[] | undefined): Comment[] {
  const byId = new Map((old ?? []).map((c) => [c.id, c]));
  for (const c of fresh ?? []) byId.set(c.id, { ...byId.get(c.id), ...c });
  return [...byId.values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")).slice(-FEED_MAX);
}

const mergeBursts = (old: Burst[] | undefined, fresh: Burst[] | undefined): Burst[] => {
  const byId = new Map((old ?? []).map((b) => [b.id, b]));
  for (const b of fresh ?? []) byId.set(b.id, b);
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-30);
};

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
      return { ...s, call: p.call as LiveCall, answered: { callId: (p.call as LiveCall).id, count: 0 } };
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
    // "8 of 12 have answered": counts only go up for a call (a late message never lowers it)
    case "call_count": {
      const prev = s.answered && s.answered.callId === p.callId ? s.answered.count : 0;
      return { ...s, answered: { callId: p.callId as string, count: Math.max(prev, Number(p.answered) || 0) } };
    }
    case "trivia":
      return { ...s, trivia: p.trivia as LiveCall };
    // the party changed (a fan joined, left or timed out): the count, who's here and the board.
    // any server may send it (the one that took the join, the leader's sweep): the newest read wins
    case "leaderboard":
    case "room": {
      const at = typeof p.at === "number" ? p.at : null;
      if (at !== null && s.roomAt !== undefined && at < s.roomAt) return s;
      return {
        ...s,
        leaderboard: (p.leaderboard as LiveState["leaderboard"]) ?? s.leaderboard,
        watching: (p.watching as number) ?? s.watching,
        members: (p.members as PartyMember[] | undefined) ?? s.members,
        ...(at !== null && { roomAt: at }),
      };
    }
    case "comment":
      return { ...s, feed: mergeFeed(s.feed, [p.comment as Comment]) };
    case "reaction":
      return { ...s, feed: (s.feed ?? []).map((c) => (c.id === p.commentId ? { ...c, reactions: p.reactions as Record<string, number> } : c)) };
    case "burst":
      return { ...s, bursts: mergeBursts(s.bursts, [p.burst as Burst]) };
    default:
      return s;
  }
}

/** the server's party read can be up to half a second old (its cache) */
const SNAPSHOT_PARTY_AGE_MS = 500;

/** a fresh snapshot replaces the state, but keeps the feed and bursts already seen, and a newer party */
function withSnapshot(prev: LiveState | null, next: LiveState): LiveState {
  const stamped = { ...next, roomAt: next.serverNow - SNAPSHOT_PARTY_AGE_MS };
  if (!prev || prev.party?.cycle !== next.party?.cycle) return stamped;
  const answered = prev.answered && next.answered && prev.answered.callId === next.answered.callId ? { ...next.answered, count: Math.max(prev.answered.count, next.answered.count) } : next.answered;
  const party = prev.roomAt !== undefined && prev.roomAt > stamped.roomAt ? { leaderboard: prev.leaderboard, watching: prev.watching, members: prev.members, roomAt: prev.roomAt } : {};
  return { ...stamped, ...party, answered, feed: mergeFeed(prev.feed, next.feed), bursts: mergeBursts(prev.bursts, next.bursts) };
}

/** tells the server this page is open (or closed): the watch party */
function sendPresence(id: string, leave = false) {
  const url = `/api/site/matches/${encodeURIComponent(id)}/presence`;
  const body = JSON.stringify({ leave });
  // a closing page can't wait for fetch
  if (leave && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return Promise.resolve(null);
  }
  return fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body, keepalive: true })
    .then((r) => (r.ok ? (r.json() as Promise<{ userId: string | null; party: { key: string; cycle: string } }>) : null))
    .catch(() => null);
}

/**
 * leaving a match page in the app sends its leave a moment later: a remount of the same match
 * (react's strict mode in development mounts twice, or a quick back-and-forth) cancels it, so a
 * stale leave never races the new heartbeat. closing or hiding the page leaves at once
 */
const LEAVE_DELAY_MS = 400;
const pendingLeave = new Map<string, ReturnType<typeof setTimeout>>();

export interface MatchChannelOptions {
  /** a broadcast arrived; return true when it was handled here and the state should not merge it */
  onMessage?: (event: string, payload: Record<string, unknown>) => boolean | void;
  /** a fresh snapshot from GET /state */
  onSnapshot?: (s: LiveState) => void;
  /** count this page as watching (match pages, not the home card or the tv) */
  presence?: boolean;
}

/** what ?debug=1 shows: which way updates come, when the last one came, who answered */
export interface ChannelDebug {
  status: string;
  lastEventAt: number | null;
  lastEvent: string | null;
  /** where the watching count last came from */
  watchingFrom: "broadcast" | "poll" | null;
  userId: string | null;
  party: { key: string; cycle: string } | null;
}

export function useMatchChannel(id: string | null, opts: MatchChannelOptions = {}) {
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [debug, setDebug] = useState<ChannelDebug>({ status: "connecting", lastEventAt: null, lastEvent: null, watchingFrom: null, userId: null, party: null });
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
    const note = (patch: Partial<ChannelDebug>) => setDebug((d) => ({ ...d, ...patch }));

    const fetchState = async (why: "poll" | "load") => {
      try {
        const r = await fetch(`/api/site/matches/${id}/state`, { credentials: "same-origin", cache: "no-store" });
        if (!r.ok || cancelled) return;
        const s = (await r.json()) as LiveState;
        noteServerNow(s.serverNow);
        setState((prev) => withSnapshot(prev, s));
        handlers.current.onSnapshot?.(s);
        note({ lastEventAt: serverNowMs(), lastEvent: why === "poll" ? "poll" : "snapshot", watchingFrom: "poll", party: s.party ?? null });
      } catch {
        // next poll or broadcast catches up
      }
    };
    const startPolling = () => {
      if (poll || cancelled) return;
      setConnection("polling");
      note({ status: "polling" });
      poll = setInterval(() => void fetchState("poll"), POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    void fetchState("load");
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
        note({ lastEventAt: serverNowMs(), lastEvent: msg.event, ...((msg.event === "room" || msg.event === "leaderboard") && { watchingFrom: "broadcast" as const }) });
        if (handlers.current.onMessage?.(msg.event, payload)) return;
        if (msg.event === "game_end") return void fetchState("load");
        setState((s) => (s ? applyBroadcast(s, msg.event, payload) : s));
      });
      channel.subscribe((status) => {
        if (cancelled) return;
        note({ status: status === "SUBSCRIBED" ? "subscribed" : status.toLowerCase() });
        if (status === "SUBSCRIBED") {
          subscribed = true;
          stopPolling();
          setConnection("realtime");
          void fetchState("load"); // catch up on anything missed while connecting
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribed = false;
          startPolling();
        }
      });
    } else {
      note({ status: realtimeOff() ? "polling (realtime off)" : "polling (no realtime config)" });
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
    clearTimeout(pendingLeave.get(id));
    pendingLeave.delete(id);
    const send = () =>
      void sendPresence(id).then((r) => {
        if (r) setDebug((d) => ({ ...d, userId: r.userId, party: r.party }));
      });
    const start = () => {
      if (beat) return;
      send();
      beat = setInterval(send, HEARTBEAT_MS);
    };
    const stop = (leave: boolean) => {
      if (beat) clearInterval(beat);
      beat = null;
      if (leave) void sendPresence(id, true);
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop(true));
    const onHide = () => stop(true);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      stop(false);
      pendingLeave.set(
        id,
        setTimeout(() => {
          pendingLeave.delete(id);
          void sendPresence(id, true);
        }, LEAVE_DELAY_MS),
      );
    };
  }, [id, presence]);

  return { state, setState, connection, debug };
}
