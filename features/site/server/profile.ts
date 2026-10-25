// a fan's own calls: GET /api/site/calls (my calls, history), /profile (call stats) and
// /achievements, all computed from their answers and the points ledger
import { getSeasonContext } from "@/features/stakes/server";
import { getDb, type DbAnswer, type DbCall, type DbUser } from "@/shared/db";
import type { AchievementItem, CallStats, MyCallRow, MyCallStatus, MyCallsData, ProfileData } from "@/shared/types";
import { followedIds } from "./favorites";
import type { Viewer } from "./identity";
import { teamBook } from "./teams";
import { NAMES } from "@/shared/copy/names";
import { balanceOf, isEarned } from "@/shared/points";
import { pointsFor, sourceOf } from "@/features/live";

interface Played {
  answer: DbAnswer;
  call: DbCall;
}

/** the fan's answers with their calls, newest first */
async function played(user: DbUser): Promise<Played[]> {
  const db = getDb();
  const answers = await db.answers.recentForUser(user.id, 500);
  const calls = new Map((await db.calls.getMany([...new Set(answers.map((a) => a.callId))])).map((c) => [c.id, c]));
  return answers.flatMap((answer) => {
    const call = calls.get(answer.callId);
    return call ? [{ answer, call }] : [];
  });
}

function statusOf({ answer, call }: Played): MyCallStatus {
  if (call.status === "resolved") return answer.optionId === call.correctOptionId ? "won" : "missed";
  return call.status;
}

/** the calls in the fan's language, with the titles of their matches */
async function rows(user: DbUser, list: Played[]): Promise<MyCallRow[]> {
  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const title = (matchId: string) => {
    const f = ctx.schedule.find((x) => x.id === matchId);
    return f ? `${book.ref(f.homeTeamId, f.homeName).name} – ${book.ref(f.awayTeamId, f.awayName).name}` : matchId;
  };
  return list.map((p) => {
    const fi = user.language === "fi" ? p.call.i18n?.fi : null;
    const options = fi?.options ?? p.call.options;
    const label = (id: string | null) => (id ? (options.find((o) => o.id === id)?.label ?? id) : null);
    const status = statusOf(p);
    return {
      callId: p.call.id,
      matchId: p.call.matchId,
      matchTitle: title(p.call.matchId),
      question: fi?.question ?? p.call.question,
      myAnswer: label(p.answer.optionId),
      answer: p.call.status === "resolved" ? label(p.call.correctOptionId) : null,
      status,
      points: status === "won" ? pointsFor(p.call.type) : 0,
      kind: sourceOf(p.call.type),
      openedAt: p.call.openedAt,
    };
  });
}

export function callStats(list: Played[]): CallStats & { bestInMatch: number } {
  const resolved = list.filter((p) => p.call.status === "resolved").sort((a, b) => a.call.openedAt.localeCompare(b.call.openedAt));
  let streak = 0;
  let bestStreak = 0;
  const perMatch = new Map<string, number>();
  for (const p of resolved) {
    const won = p.answer.optionId === p.call.correctOptionId;
    streak = won ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (won) perMatch.set(p.call.matchId, (perMatch.get(p.call.matchId) ?? 0) + 1);
  }
  const correct = resolved.filter((p) => p.answer.optionId === p.call.correctOptionId).length;
  return {
    answered: list.length,
    correct,
    correctPct: resolved.length ? Math.round((100 * correct) / resolved.length) : 0,
    bestStreak,
    matches: new Set(list.map((p) => p.call.matchId)).size,
    bestInMatch: Math.max(0, ...perMatch.values()),
  };
}

export function achievementsOf(stats: ReturnType<typeof callStats>, extra: { points: number; follows: number; joined: boolean }): AchievementItem[] {
  const a = (id: string, title: string, description: string, icon: AchievementItem["icon"], have: number, need: number): AchievementItem => ({
    id,
    title,
    description,
    icon,
    unlocked: have >= need,
    progress: { have: Math.min(have, need), need },
  });
  return [
    a("first-call", "First call", `Answer a ${NAMES.call} question`, "star", stats.answered, 1),
    a("called-it", "Called it!", "Get a call right", "bolt", stats.correct, 1),
    a("sharp-eye", "Sharp eye", "Three right calls in one match", "bolt", stats.bestInMatch, 3),
    a("hot-streak", "Hot streak", "Five right calls in a row", "bolt", stats.bestStreak, 5),
    a("regular", "Regular", "Play along in 10 matches", "rook", stats.matches, 10),
    a("century", "Century", "Earn 100 points", "star", extra.points, 100),
    a("loyal-fan", "Loyal fan", "Follow a team", "star", extra.follows, 1),
    a("team-player", "Team player", "Join a Watch Together room", "rook", extra.joined ? 1 : 0, 1),
  ];
}

const nobody = (): ReturnType<typeof callStats> => ({ answered: 0, correct: 0, correctPct: 0, bestStreak: 0, matches: 0, bestInMatch: 0 });

export async function profilePage(viewer: Viewer): Promise<ProfileData> {
  const user = viewer.user;
  const asOf = new Date().toISOString();
  if (!user) return { stats: nobody(), achievements: achievementsOf(nobody(), { points: 0, follows: 0, joined: false }), asOf, source: "db" };
  const [list, points, follows] = await Promise.all([played(user), getDb().points.listForUser(user.id), followedIds(user)]);
  const stats = callStats(list);
  return {
    stats,
    achievements: achievementsOf(stats, { points: balanceOf(points.filter(isEarned)), follows: follows.length, joined: !!user.nickname }),
    asOf,
    source: "db",
  };
}

/** my calls: open and recent; history: resolved only, optionally one match */
export async function myCalls(viewer: Viewer, view: "recent" | "history", matchId?: string): Promise<MyCallsData> {
  const asOf = new Date().toISOString();
  const user = viewer.user;
  if (!user) return { calls: [], matches: [], totals: { answered: 0, won: 0, points: 0 }, asOf, source: "db" };
  const all = await rows(user, await played(user));
  const open = (r: MyCallRow) => r.status === "open" || r.status === "locked";
  let calls = view === "history" ? all.filter((r) => r.status === "won" || r.status === "missed") : [...all.filter(open), ...all.filter((r) => !open(r))].slice(0, 50);
  const matches = [...new Map(calls.map((r) => [r.matchId, { matchId: r.matchId, title: r.matchTitle }])).values()];
  if (matchId) calls = calls.filter((r) => r.matchId === matchId);
  return {
    calls,
    matches,
    totals: { answered: calls.length, won: calls.filter((r) => r.status === "won").length, points: calls.reduce((s, r) => s + r.points, 0) },
    asOf,
    source: "db",
  };
}
