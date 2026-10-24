// GET /api/site/me: the viewer as the chrome shows them, on every page
import { openCalls } from "@/features/live/server";
import { demoLabel, demoMode, leagueNow } from "@/shared/clock";
import { DEFAULT_PREFS, getDb } from "@/shared/db";
import type { MeResponse } from "@/shared/types";
import { favoriteTeams, followedIds } from "./favorites";
import type { Viewer } from "./identity";
import { viewerSummary } from "./points";
import { walletOf } from "./wallet";

export async function mePage(viewer: Viewer): Promise<MeResponse> {
  const db = getDb();
  const user = viewer.user;
  const open = openCalls();
  const [summary, unread, favorites, follows, answers, money] = await Promise.all([
    viewerSummary(user),
    user ? db.notifications.unreadCount(user.id) : 0,
    favoriteTeams(user),
    followedIds(user),
    user && open.length ? db.answers.listForUser(user.id, open.map((c) => c.id)) : [],
    walletOf(user),
  ]);
  return {
    user: summary,
    joined: !!user?.nickname,
    nickname: user?.nickname ?? null,
    language: user?.language ?? "en",
    favorites,
    follows,
    notificationPrefs: user?.notificationPrefs ?? DEFAULT_PREFS,
    unreadNotifications: unread,
    openCallAnswers: Object.fromEntries(answers.map((a) => [a.callId, a.optionId])),
    ...money,
    demo: demoMode() ? { label: demoLabel() ?? "Demo", now: leagueNow().toISOString() } : null,
    asOf: new Date().toISOString(),
    source: "db",
  };
}
