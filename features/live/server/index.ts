// live server api. server only: never import this from browser code (lint enforces it).
import { getStakes, oddsByScoreState } from "@/features/stakes/server";
import { mockRoomStates } from "@/shared/mock";
import type { Call, GameTeams, GoalEvent, ProjectedRow, RoomState } from "@/shared/types";
import { toPublicCall } from "../calls/public";
import { resolveCall } from "../calls/resolve";
import { buildLeaderboard, type ResolvedCall } from "../calls/scoring";
import { scheduleCalls } from "../calls/schedule";
import { gameTimeAt } from "../replay/clock";
import { stateAt } from "../replay/state-at";
import { type Room, store } from "./store";

export { store };
export type { Room };

// kaleva sports matches: answers, realtime publishing (and the live engine, see ./engine)
export { answerCall, type AnswerResult } from "./calls";
export { publish, recentBroadcasts, type MatchEvent as BroadcastEvent } from "./realtime";
export {
  activeReplays,
  CALL_POINTS,
  controlReplay,
  engineMatch,
  ensureLiveLoop,
  matchSince,
  startEngine,
  type MatchRenderer,
  type RenderedMatch,
} from "./engine";
export type { CallDraft, CallKind } from "../engine/rules";
// for npm run pregen:phrases (story): the rules a stored wording must pass
export { BUILT_IN, PHRASE_VARS, phraseProblem, type PhraseLang } from "../engine/phrases";

/** the game being replayed. stub: always the mock demo game. todo: liiga data via stakes */
export function replayGame(room: Room): { game: GameTeams; goals: GoalEvent[] } {
  const final = mockRoomStates[mockRoomStates.length - 1];
  return { game: { ...final.game, id: room.gameId }, goals: final.events };
}

export interface RoomNow {
  t: number;
  calls: Call[];
  resolved: (ResolvedCall & { call: Call })[];
}

/** game time, scheduled calls and their results for a room right now */
export function roomNow(room: Room, now = Date.now()): RoomNow {
  const { game, goals } = replayGame(room);
  const t = room.phase === "lobby" ? 0 : gameTimeAt(room, now);
  const past = stateAt(goals, t, game).events;
  const calls = scheduleCalls(goals, t, game);
  const resolved = calls.flatMap((call) => {
    const correctOptionId = resolveCall(call, past);
    return correctOptionId ? [{ call, callId: call.id, type: call.type, correctOptionId }] : [];
  });
  return { t, calls, resolved };
}

/** stub: projected table from the mock state with the same score */
function projectedFor(score: { home: number; away: number }): ProjectedRow[] {
  const match = mockRoomStates.find((s) => s.score.home === score.home && s.score.away === score.away);
  return (match ?? mockRoomStates[0]).projectedTable;
}

export async function getRoomState(code: string, playerId?: string): Promise<RoomState | null> {
  const room = store.getRoom(code);
  if (!room) return null;

  const { game, goals } = replayGame(room);
  const { t, calls, resolved } = roomNow(room);
  const snap = stateAt(goals, t, game);
  const resolvedIds = new Set(resolved.map((r) => r.callId));
  const active = calls.filter((c) => t < c.resolvesAt && !resolvedIds.has(c.id)).at(-1) ?? null;
  const last = resolved.at(-1) ?? null;

  const answers = store.listAnswers(code);
  const leaderboard = buildLeaderboard(store.listPlayers(code), answers, resolved);
  const mine = playerId ? leaderboard.find((e) => e.playerId === playerId) : undefined;
  const myLastAnswer =
    last && playerId ? answers.find((a) => a.playerId === playerId && a.callId === last.callId) : undefined;

  const cards = await oddsByScoreState(game.id);
  const stakes = cards[`${snap.score.home}-${snap.score.away}`] ?? (await getStakes(game.homeTeamId, game.id));

  return {
    code,
    serverNow: Date.now(),
    phase: snap.phase === "final" ? "final" : room.phase,
    game,
    gameTimeSeconds: t,
    score: snap.score,
    events: snap.events,
    activeCall: active ? toPublicCall(active) : null,
    lastResolved: last
      ? {
          callId: last.callId,
          correctOptionId: last.correctOptionId,
          ...(myLastAnswer && { youWereRight: myLastAnswer.optionId === last.correctOptionId }),
        }
      : null,
    leaderboard,
    me: mine ? { playerId: mine.playerId, score: mine.score, rank: mine.rank } : null,
    stakes,
    projectedTable: projectedFor(snap.score),
  };
}
