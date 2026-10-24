// live updates for a match page: supabase realtime broadcast on "match:{id}" (receive only),
// with GET /state on subscribe or reconnect, and polling every 3 s while realtime is not
// SUBSCRIBED (none within 5 s, a drop, or ?realtime=off). the server is the only authority
import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment, LiveCall, LiveMatchDetail, LiveState, MatchEvent } from "@/shared/types";
import { answerCallApi, type Me } from "../data";
import type { CallItView } from "./use-call-it";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const POLL_MS = 3000;
const SUBSCRIBE_GRACE_MS = 5000;

export type Connection = "connecting" | "realtime" | "polling";

export interface LiveView {
  match: LiveMatchDetail;
  call: CallItView | null;
  lastCall: { text: string; correct: boolean } | null;
  isReplay: boolean;
  gameTime: number;
  connection: Connection;
}

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
    case "leaderboard":
      return { ...s, leaderboard: (p.leaderboard as LiveState["leaderboard"]) ?? s.leaderboard, watching: (p.watching as number) ?? s.watching };
    default:
      return s;
  }
}

/** a live call as the call it! card shows it, counting down against server time */
function viewOf(call: LiveCall, now: number, picked: string | null, error: string | null, pick: (id: string) => void): CallItView {
  const secondsLeft = Math.max(0, Math.ceil((call.locksAt - now) / 1000));
  const phase =
    call.status === "resolved" ? "revealed" : call.status === "cancelled" ? "cancelled" : call.status === "locked" || secondsLeft === 0 ? "locked" : "open";
  return {
    question: call.question,
    subtitle: phase === "open" ? "Answer before the timer ends" : phase === "locked" ? "Answers are locked" : "",
    options: call.options,
    points: call.points,
    stakesLine: call.stakesLine,
    secondsLeft,
    totalSeconds: Math.max(1, Math.round((call.locksAt - call.openedAt) / 1000)),
    phase,
    picked,
    correctOptionId: call.correctOptionId,
    split: call.split,
    lastCall: null,
    reason: call.reason,
    error,
    pick,
  };
}

export function useLiveMatch(detail: LiveMatchDetail | null, me: Me | null): LiveView | null {
  const id = detail?.id ?? null;
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [comments, setComments] = useState<Comment[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0);

  // server state: subscribe, refetch on (re)subscribe, poll while realtime is down
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
        offset.current = s.serverNow - Date.now();
        setState(s);
        if (s.me?.answers) setAnswers((a) => ({ ...s.me!.answers, ...a }));
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
        if (typeof payload.serverNow === "number") offset.current = payload.serverNow - Date.now();
        if (msg.event === "comment") return setComments((c) => [...c, payload.comment as Comment]);
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

  // the countdown ticks against server time
  useEffect(() => {
    if (!state?.call || state.call.status !== "open") return;
    const t = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, [state?.call]);

  const nickname = me?.nickname ?? null;
  const match = useMemo(() => {
    if (!detail || !state) return detail;
    const seen = new Set(detail.discussion.map((c) => c.id));
    // broadcasts go to everyone, so "you" in the leaderboard is marked here
    const board = state.leaderboard.length ? state.leaderboard.map((r) => ({ ...r, isYou: !!nickname && r.name === nickname })) : detail.room.leaderboard;
    return {
      ...detail,
      status: state.status === "final" ? "live" : state.status,
      isReplay: state.isReplay,
      match: {
        ...detail.match,
        status: state.status,
        score: state.status === "scheduled" ? detail.match.score : state.score,
        periodScores: state.periodScores,
        periodLabel: state.clock.label,
        clock: state.clock.clock,
      },
      events: state.events,
      stakesSummary: state.stakes.chips.length ? state.stakes.chips : detail.stakesSummary,
      seasonStakes: state.stakes.seasonStakes.steps.length ? state.stakes.seasonStakes : detail.seasonStakes,
      whatItMeans: state.stakes.whatItMeans || detail.whatItMeans,
      room: { ...detail.room, leaderboard: board, watching: Math.max(state.watching, detail.room.watching) },
      discussion: [...detail.discussion, ...comments.filter((c) => !seen.has(c.id))],
    } as LiveMatchDetail;
  }, [detail, state, comments, nickname]);

  if (!detail || !match) return null;

  const call = state?.call ?? null;
  const pick = (optionId: string) => {
    if (!call || !me?.joined) return;
    setAnswers((a) => ({ ...a, [call.id]: optionId }));
    void answerCallApi(call.id, optionId).then((r) => {
      if (r.ok) return setAnswerError(null);
      setAnswerError(r.status === 409 ? `Not counted: ${r.error}.` : r.error);
      if (r.status === 409 && r.error === "already answered") return;
      setAnswers((a) => {
        const next = { ...a };
        delete next[call.id];
        return next;
      });
    });
  };
  const view = call ? viewOf(call, now, answers[call.id] ?? null, answerError, pick) : null;
  const last = state?.lastCall;
  const lastCall =
    last && last.status === "resolved" && last.correctOptionId
      ? {
          text: `${last.split?.[last.correctOptionId] ?? 0}% picked ${last.options.find((o) => o.id === last.correctOptionId)?.label ?? ""}`,
          correct: answers[last.id] === last.correctOptionId,
        }
      : last && last.status === "cancelled"
        ? { text: "cancelled, no points either way", correct: false }
        : null;
  return { match, call: view, lastCall, isReplay: !!state?.isReplay, gameTime: state?.clock.gameTime ?? 0, connection };
}
