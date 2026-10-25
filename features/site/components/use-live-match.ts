// live updates for a match page, on top of useMatchChannel (realtime, polling, presence): the
// game, your call! with its answer count, party trivia, and the watch party (who's here, the
// board, the feed and reaction bursts). a call you answered that resolves or is cancelled raises
// a toast and refreshes your points
import { useEffect, useMemo, useRef, useState } from "react";
import type { Burst, Comment, LiveCall, LiveMatchDetail, LiveState, MeResponse, PartyMember } from "@/shared/types";
import { answerCallApi, invalidate, PREDICTION_EVENT, predictionUrl, refreshMeSoon, serverNowMs } from "../data";
import { toast } from "./Toast";
import type { CallItView } from "./use-call-it";
import { applyBroadcast, type ChannelDebug, type Connection, mergeFeed, useMatchChannel } from "./use-match-channel";

export { applyBroadcast, type Connection } from "./use-match-channel";

const ROOM_PULSE_MS = 4000;

/** party trivia as the chat card shows it */
export interface TriviaView {
  call: LiveCall;
  question: string;
  options: { id: string; label: string }[];
  secondsLeft: number;
  totalSeconds: number;
  phase: "open" | "locked" | "revealed";
  picked: string | null;
  pick: (optionId: string) => void;
}

export interface LiveView {
  match: LiveMatchDetail;
  call: CallItView | null;
  lastCall: { text: string; correct: boolean } | null;
  isReplay: boolean;
  gameTime: number;
  connection: Connection;
  /** the server's latest snapshot (status, rotation phase...) */
  state: LiveState | null;
  /** your place in the party, once you are in it */
  you: { rank: number | null; of: number } | null;
  /** someone joined the party in the last few seconds */
  roomPulse: boolean;
  /** the party feed, oldest first: chat, system lines, fact cards, trivia cards */
  feed: Comment[];
  /** reaction bursts (the layer floats the new ones) */
  bursts: Burst[];
  /** who is here now */
  members: PartyMember[];
  /** "8 of 12 have answered" while a question is open (no split before the lock) */
  answered: { count: number; of: number } | null;
  trivia: TriviaView | null;
  /** your user id (the board's "you", the friends filter) */
  myId: string | null;
  debug: ChannelDebug;
  /** your own message, reaction or burst shows at once, as its broadcast would */
  local: (event: string, payload: Record<string, unknown>) => void;
}

/** a live question as the your call! card shows it, counting down against server time */
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

export function useLiveMatch(detail: LiveMatchDetail | null, me: MeResponse | null, opts: { presence?: boolean } = {}): LiveView | null {
  const id = detail?.id ?? null;
  const [roomPulse, setRoomPulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // server state: realtime with polling, and this page counts as watching (not the tv)
  const { state, setState, connection, debug } = useMatchChannel(id, {
    presence: opts.presence ?? true,
    onSnapshot: (snap) => {
      if (snap.me?.answers) setAnswers((a) => ({ ...snap.me!.answers, ...a }));
    },
    onMessage: (event, payload) => {
      // more people watching: the party header lights up for a moment
      if (event === "room" && typeof payload.watching === "number" && payload.watching > (latest.current.state?.watching ?? 0)) {
        setRoomPulse(true);
        clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setRoomPulse(false), ROOM_PULSE_MS);
      }
      // two calls can resolve in one tick: announce from the event, before the state merges
      if (event === "call_resolved" || event === "call_cancelled") {
        const s = latest.current.state;
        const call = [s?.call, s?.lastCall].find((c) => c?.id === payload.callId);
        announce(call, event === "call_resolved" ? "resolved" : "cancelled", (payload.correctOptionId as string) ?? null);
      }
      if (event === "trivia") announceTrivia(payload.trivia as LiveCall);
    },
  });

  const [own, setAnswers] = useState<Record<string, string>>({});
  // a prediction made in what if? is this page's lobby answer too
  useEffect(() => {
    const on = (e: Event) => {
      const { callId, optionId } = (e as CustomEvent<{ callId: string; optionId: string }>).detail;
      setAnswers((a) => ({ ...a, [callId]: optionId }));
    };
    window.addEventListener(PREDICTION_EVENT, on);
    return () => window.removeEventListener(PREDICTION_EVENT, on);
  }, []);
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

  /** trivia you answered: right or not, once */
  function announceTrivia(t: LiveCall | null | undefined) {
    if (!t || t.status !== "resolved" || !announced.current || announced.current.has(t.id)) return;
    announced.current.add(t.id);
    const mine = latest.current.answers[t.id];
    if (!mine) return;
    if (mine === t.correctOptionId) toast(`Trivia: right! +${t.points} pts`, { tone: "good", ms: 3500 });
    else toast(`Trivia: the answer was ${t.options.find((o) => o.id === t.correctOptionId)?.label ?? "…"}`, { ms: 3500 });
    refreshMeSoon();
  }

  // polling (and the first load): announce what changed since the last snapshot
  useEffect(() => {
    if (!state) return;
    const settled = [state.call, state.lastCall, state.trivia].filter((c): c is LiveCall => !!c && (c.status === "resolved" || c.status === "cancelled"));
    if (!announced.current) {
      announced.current = new Set(settled.map((c) => c.id));
      return;
    }
    for (const c of settled) {
      if (c.type === "trivia") announceTrivia(c);
      else announce(c, c.status as "resolved" | "cancelled", c.correctOptionId);
    }
  }, [state, answers]);

  // someone new in the party may be a friend made a moment ago (an invite): /me knows, once
  const memberIds = (state?.members ?? []).map((m) => m.userId).sort().join(",");
  const seenMembers = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = memberIds ? memberIds.split(",") : [];
    if (seenMembers.current && ids.some((id) => !seenMembers.current!.has(id))) refreshMeSoon(1200);
    seenMembers.current = new Set([...(seenMembers.current ?? []), ...ids]);
  }, [memberIds]);

  // the countdowns tick against server time
  const ticking = (state?.call?.status === "open") || (state?.trivia?.status === "open");
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(serverNowMs()), 250);
    return () => clearInterval(t);
  }, [ticking]);

  const myId = state?.me?.userId ?? (me?.user.id && me.user.id !== "guest" ? me.user.id : null);
  const match = useMemo(() => {
    if (!detail || !state) return detail;
    // broadcasts go to everyone, so "you" on the board is marked here
    const board = state.leaderboard.length || state.members ? state.leaderboard.map((r) => ({ ...r, isYou: !!myId && r.userId === myId })) : detail.room.leaderboard;
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
      room: { ...detail.room, leaderboard: board, watching: state.watching, members: state.members ?? detail.room.members },
      discussion: mergeFeed(detail.discussion, state.feed),
    } as LiveMatchDetail;
  }, [detail, state, myId]);

  if (!detail || !match) return null;

  const call = state?.call ?? null;
  const answer = (target: LiveCall, optionId: string) => {
    setAnswers((a) => ({ ...a, [target.id]: optionId }));
    void answerCallApi(target.id, optionId).then((r) => {
      // the lobby's "who wins?" is the match prediction: what if? shows it too
      if (target.type === "who_wins" && id) invalidate(predictionUrl(id));
      if (r.ok) return setAnswerError(null);
      setAnswerError(r.status === 409 ? `Not counted: ${r.error}.` : r.error);
      if (r.status === 409 && r.error === "already answered") return;
      setAnswers((a) => {
        const next = { ...a };
        delete next[target.id];
        return next;
      });
    });
  };
  // the page asks a guest for a nickname first; an answer waiting for it runs right after
  const pick = (optionId: string) => {
    if (call) answer(call, optionId);
  };
  const fi = me?.language === "fi";
  const view = call ? viewOf(call, now, answers[call.id] ?? null, answerError, pick, fi) : null;
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
  const t = state?.trivia ?? null;
  const tLeft = t ? Math.max(0, Math.ceil((t.locksAt - now) / 1000)) : 0;
  const trivia: TriviaView | null = t
    ? {
        call: t,
        question: fi && t.fi ? t.fi.question : t.question,
        options: fi && t.fi ? t.fi.options : t.options,
        secondsLeft: tLeft,
        totalSeconds: Math.max(1, Math.round((t.locksAt - t.openedAt) / 1000)),
        phase: t.status === "resolved" ? "revealed" : t.status === "open" && tLeft > 0 ? "open" : "locked",
        picked: answers[t.id] ?? null,
        pick: (optionId: string) => {
          if (t.status === "open") answer(t, optionId);
        },
      }
    : null;
  const watching = state?.watching ?? detail.room.watching;
  // your own answer counts at once; the server's count catches up within a second
  const own1 = call && answers[call.id] ? 1 : 0;
  const counted = call && state?.answered?.callId === call.id ? state.answered.count : 0;
  const answered = call?.status === "open" ? { count: Math.max(counted, own1), of: Math.max(watching, counted, own1) } : null;
  const you = me?.joined && state?.me ? { rank: state.me.rank, of: state.me.of } : null;
  return {
    match,
    call: view,
    lastCall,
    isReplay: !!state?.isReplay,
    gameTime: state?.clock.gameTime ?? 0,
    connection,
    state,
    you,
    roomPulse,
    feed: match.discussion,
    bursts: state?.bursts ?? [],
    members: state?.members ?? detail.room.members ?? [],
    answered,
    trivia,
    myId,
    debug,
    local: (event, payload) => setState((s) => (s ? applyBroadcast(s, event, payload) : s)),
  };
}
