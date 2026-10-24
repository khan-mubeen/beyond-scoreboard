// live updates for a match page, on top of useMatchChannel (realtime, polling, presence).
// a call you answered that resolves or is cancelled raises a toast and refreshes your points
import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment, LiveCall, LiveMatchDetail, LiveState, MeResponse } from "@/shared/types";
import { answerCallApi, refreshMeSoon, serverNowMs } from "../data";
import { toast } from "./Toast";
import type { CallItView } from "./use-call-it";
import { type Connection, useMatchChannel } from "./use-match-channel";

export { applyBroadcast, type Connection } from "./use-match-channel";

const ROOM_PULSE_MS = 4000;

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
  /** someone joined the room in the last few seconds */
  roomPulse: boolean;
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

export function useLiveMatch(detail: LiveMatchDetail | null, me: MeResponse | null): LiveView | null {
  const id = detail?.id ?? null;
  const [roomPulse, setRoomPulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // server state: realtime with polling, and this page counts as watching
  const { state, connection } = useMatchChannel(id, {
    presence: true,
    onSnapshot: (snap) => {
      if (snap.me?.answers) setAnswers((a) => ({ ...snap.me!.answers, ...a }));
    },
    onMessage: (event, payload) => {
      // more people watching: the watch together card lights up for a moment
      if (event === "room" && typeof payload.watching === "number" && payload.watching > (latest.current.state?.watching ?? 0)) {
        setRoomPulse(true);
        clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setRoomPulse(false), ROOM_PULSE_MS);
      }
      if (event === "comment") {
        setComments((c) => [...c, payload.comment as Comment]);
        return true;
      }
      // two calls can resolve in one tick: announce from the event, before the state merges
      if (event === "call_resolved" || event === "call_cancelled") {
        const s = latest.current.state;
        const call = [s?.call, s?.lastCall].find((c) => c?.id === payload.callId);
        announce(call, event === "call_resolved" ? "resolved" : "cancelled", (payload.correctOptionId as string) ?? null);
      }
    },
  });

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
      room: { ...detail.room, leaderboard: board, watching: state.watching },
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
  return { match, call: view, lastCall, isReplay: !!state?.isReplay, gameTime: state?.clock.gameTime ?? 0, connection, state, you, roomPulse };
}
