// live updates for a match page: supabase realtime broadcast on "match:{id}" (receive only),
// with GET /state on subscribe or reconnect, and polling every 3 s while realtime is not
// SUBSCRIBED (none within 5 s, a drop, or ?realtime=off). the server is the only authority.
// a call you answered that resolves or is cancelled raises a toast and refreshes your points
import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment, LiveCall, LiveMatchDetail, LiveState, MatchEvent, MeResponse } from "@/shared/types";
import { answerCallApi, noteServerNow, refreshMeSoon, serverNowMs } from "../data";
import { toast } from "./Toast";
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
  /** the server's latest snapshot (status, rotation phase...) */
  state: LiveState | null;
  /** your place in the watch together room, once you have joined */
  you: { rank: number | null; of: number } | null;
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
function viewOf(call: LiveCall, now: number, picked: string | null, error: string | null, pick: (id: string) => void, fi = false): CallItView {
  const secondsLeft = Math.max(0, Math.ceil((call.locksAt - now) / 1000));
  const phase =
    call.status === "resolved" ? "revealed" : call.status === "cancelled" ? "cancelled" : call.status === "locked" || secondsLeft === 0 ? "locked" : "open";
  return {
    question: fi && call.fi ? call.fi.question : call.question,
    subtitle: phase === "open" ? "Answer before the timer ends" : phase === "locked" ? "Answers are locked" : "",
    options: fi && call.fi ? call.fi.options : call.options,
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

export function useLiveMatch(detail: LiveMatchDetail | null, me: MeResponse | null): LiveView | null {
  const id = detail?.id ?? null;
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [comments, setComments] = useState<Comment[]>([]);
  const [own, setAnswers] = useState<Record<string, string>>({});
  const [answerError, setAnswerError] = useState<string | null>(null);
  // a refresh keeps your locked answers: /me knows them for every open call
  const openAnswers = me?.openCallAnswers;
  const answers = useMemo(() => ({ ...openAnswers, ...own }), [openAnswers, own]);
  const [now, setNow] = useState(serverNowMs);
  const latest = useRef<{ state: LiveState | null; answers: Record<string, string> }>({ state: null, answers: {} });
  // results already settled when the page opened are never announced
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => {
    latest.current = { state, answers };
  }, [state, answers]);

  /** the toast for a call you answered, once */
  function announce(call: LiveCall | null | undefined, status: "resolved" | "cancelled", correctOptionId: string | null) {
    if (!call || !announced.current || announced.current.has(call.id)) return;
    announced.current.add(call.id);
    const mine = latest.current.answers[call.id];
    if (!mine) return;
    if (status === "cancelled") toast("Call cancelled — no points (the play happened while answers were open)", { ms: 4000 });
    else if (mine === correctOptionId) toast(`You got it! +${call.points} pts`, { tone: "good", ms: 4000 });
    else toast(`Not this time — the answer was ${call.options.find((o) => o.id === correctOptionId)?.label ?? "…"}`, { ms: 4000 });
    refreshMeSoon();
  }

  // polling (and the first load): announce what changed since the last snapshot
  useEffect(() => {
    if (!state) return;
    const settled = [state.call, state.lastCall].filter((c): c is LiveCall => !!c && (c.status === "resolved" || c.status === "cancelled"));
    if (!announced.current) {
      announced.current = new Set(settled.map((c) => c.id));
      return;
    }
    for (const c of settled) announce(c, c.status as "resolved" | "cancelled", c.correctOptionId);
  }, [state, answers]);

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
        noteServerNow(s.serverNow);
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
        if (typeof payload.serverNow === "number") noteServerNow(payload.serverNow);
        if (msg.event === "comment") return setComments((c) => [...c, payload.comment as Comment]);
        if (msg.event === "game_end") return void fetchState();
        // two calls can resolve in one tick: announce from the event, before the state merges
        if (msg.event === "call_resolved" || msg.event === "call_cancelled") {
          const s = latest.current.state;
          const call = [s?.call, s?.lastCall].find((c) => c?.id === payload.callId);
          announce(call, msg.event === "call_resolved" ? "resolved" : "cancelled", (payload.correctOptionId as string) ?? null);
        }
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
    const t = setInterval(() => setNow(serverNowMs()), 250);
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
  const view = call ? viewOf(call, now, answers[call.id] ?? null, answerError, pick, me?.language === "fi") : null;
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
  const you = me?.joined && state?.me ? { rank: state.me.rank, of: state.me.of } : null;
  return { match, call: view, lastCall, isReplay: !!state?.isReplay, gameTime: state?.clock.gameTime ?? 0, connection, state, you };
}
