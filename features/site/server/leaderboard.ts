// GET /api/site/leaderboard?scope=weekly|season|room: the top 20, plus the viewer's own row
// when it is further down. bots never appear (rankPoints leaves them out)
import { roomMatchNow } from "@/features/live/server";
import { getDb } from "@/shared/db";
import type { LeaderboardPageData, LeaderboardScope, SiteLeaderboardEntry } from "@/shared/types";
import type { Viewer } from "./identity";
import { weekStart } from "./labels";
import { avatarFor, rankPoints } from "./points";
import { partyStandings } from "./presence";
import { NAMES } from "@/shared/copy/names";

const TOP = 20;

const TITLES: Record<LeaderboardScope, { title: string; note: string }> = {
  weekly: { title: "Weekly Leaderboard", note: `Points earned with ${NAMES.call}, predictions and trivia this week, Monday to Sunday (Finnish time).` },
  season: { title: "Season Leaderboard", note: "Every point earned this season. Welcome points and spending don't count." },
  room: { title: "Watch Party", note: "Everyone in the match's party now, by points this match (0 points too)." },
};

export async function leaderboardPage(viewer: Viewer, scope: LeaderboardScope, now = new Date()): Promise<LeaderboardPageData> {
  const youId = viewer.user?.id ?? null;
  let ranked: SiteLeaderboardEntry[] = [];
  if (scope === "room") {
    const matchId = roomMatchNow();
    if (matchId)
      ranked = (await partyStandings(matchId)).ranked.map((e) => ({
        playerId: e.userId,
        nickname: e.name,
        score: e.score,
        rank: e.rank,
        avatar: avatarFor(e.name),
        ...(e.userId === youId && { isYou: true }),
      }));
  } else {
    const since = scope === "weekly" ? weekStart(now).toISOString() : new Date(0).toISOString();
    ranked = await rankPoints(await getDb().points.listSince(since), Number.MAX_SAFE_INTEGER, youId);
  }
  const entries = ranked.slice(0, TOP);
  const you = entries.some((e) => e.isYou) ? null : (ranked.find((e) => e.isYou) ?? null);
  return { scope, ...TITLES[scope], entries, you, total: ranked.length, asOf: now.toISOString(), source: "db" };
}
