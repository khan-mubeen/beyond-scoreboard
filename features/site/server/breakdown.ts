// GET /api/site/leaderboard/breakdown: the expanded row of a board. the same ledger rows the board
// sums (earned points only, in the board's window), split by source (the call type of each row)
// and by match, so every split adds up to the board's total
import { pointsFor, sourceOf } from "@/features/live";
import { roomMatchNow, roomScope } from "@/features/live/server";
import { getSeasonContext } from "@/features/stakes/server";
import { getDb, type DbPoints } from "@/shared/db";
import { isEarned } from "@/shared/points";
import type { LeaderboardScope, PointsBreakdown } from "@/shared/types";
import { displayName, type Viewer } from "./identity";
import { weekStart } from "./labels";
import { botIds } from "./points";
import { teamBook } from "./teams";

/** the board's window: since when, and for which match (the watch party board) */
function windowOf(scope: LeaderboardScope, now: Date): { since: string; matchId?: string } | null {
  if (scope === "weekly") return { since: weekStart(now).toISOString() };
  if (scope === "season") return { since: new Date(0).toISOString() };
  const matchId = roomMatchNow();
  return matchId ? { since: roomScope(matchId).since, matchId } : null;
}

/** a ledger row's source: its call's type, else the reason ("trivia: …", "prediction: …", the seeded "seed: calls …") */
const rowSource = (r: DbPoints, types: Map<string, string>) => {
  const type = r.callId ? types.get(r.callId) : undefined;
  if (type) return sourceOf(type);
  return r.reason.startsWith("trivia") ? "trivia" : r.reason.startsWith("prediction") ? "prediction" : "call";
};

export async function breakdownFor(_viewer: Viewer, scope: LeaderboardScope, userId: string, now = new Date()): Promise<PointsBreakdown | null> {
  const w = windowOf(scope, now);
  if (!w || (await botIds()).has(userId)) return null;
  const db = getDb();
  const [rows, [user]] = await Promise.all([db.points.listSince(w.since, w.matchId), db.users.getMany([userId])]);
  if (!user) return null;
  const mine = rows.filter((r) => r.userId === userId && isEarned(r));
  const answers = (await db.answers.recentForUser(userId, 500)).filter((a) => a.answeredAt >= w.since);
  const callIds = [...new Set([...mine.flatMap((r) => (r.callId ? [r.callId] : [])), ...answers.map((a) => a.callId)])];
  const calls = new Map((await db.calls.getMany(callIds)).map((c) => [c.id, c]));
  const types = new Map([...calls.values()].map((c) => [c.id, c.type]));

  const [ctx, book] = await Promise.all([getSeasonContext(), teamBook()]);
  const title = (matchId: string) => {
    const f = ctx.schedule.find((x) => x.id === matchId);
    return f ? `${book.ref(f.homeTeamId, f.homeName).name} – ${book.ref(f.awayTeamId, f.awayName).name}` : matchId;
  };

  const bySource = { call: 0, prediction: 0, trivia: 0 };
  const perMatch = new Map<string | null, { points: number; last: string }>();
  for (const r of mine) {
    bySource[rowSource(r, types)] += r.points;
    const m = perMatch.get(r.matchId) ?? { points: 0, last: r.createdAt };
    perMatch.set(r.matchId, { points: m.points + r.points, last: r.createdAt > m.last ? r.createdAt : m.last });
  }

  // the correct-answer rate over the resolved calls answered in this window (and match)
  const resolved = answers.flatMap((a) => {
    const c = calls.get(a.callId);
    return c && c.status === "resolved" && (!w.matchId || c.matchId === w.matchId) ? [{ a, c }] : [];
  });
  const right = resolved.filter(({ a, c }) => a.optionId === c.correctOptionId);
  const best = [...right].sort((x, y) => pointsFor(y.c.type) - pointsFor(x.c.type) || y.c.openedAt.localeCompare(x.c.openedAt))[0];
  const lang = user.language === "fi" ? "fi" : "en";
  const fi = (c: NonNullable<typeof best>["c"]) => (lang === "fi" ? c.i18n?.fi : null);

  return {
    userId,
    name: displayName(user),
    scope,
    total: mine.reduce((s, r) => s + r.points, 0),
    bySource,
    // rows with no match (the seeded history) count in the total and the sources, never as a fake "Earlier" match
    perMatch: [...perMatch.entries()]
      .flatMap(([matchId, v]) => (matchId ? [{ matchId, title: title(matchId), points: v.points, last: v.last }] : []))
      .sort((a, b) => b.last.localeCompare(a.last))
      .map(({ matchId, title, points }) => ({ matchId, title, points })),
    answered: resolved.length,
    correct: right.length,
    correctPct: resolved.length ? Math.round((100 * right.length) / resolved.length) : 0,
    bestCall: best
      ? {
          question: fi(best.c)?.question ?? best.c.question,
          answer: (fi(best.c)?.options ?? best.c.options).find((o) => o.id === best.c.correctOptionId)?.label ?? "",
          points: pointsFor(best.c.type),
          matchTitle: title(best.c.matchId),
        }
      : null,
    asOf: now.toISOString(),
    source: "db",
  };
}
