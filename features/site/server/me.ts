// GET /api/site/me: the viewer as the chrome shows them, on every page
import { openCalls } from "@/features/live/server";
import { demoMode } from "@/shared/clock";
import { DEFAULT_PREFS, getDb } from "@/shared/db";
import type { MeResponse } from "@/shared/types";
import { favoriteTeams, followedIds } from "./favorites";
import { friendCodeOf, friendIds, passInfo, pendingFor } from "./friends";
import type { Viewer } from "./identity";
import { viewerSummary } from "./points";
import { walletOf } from "./wallet";

/** publicUrl: where links start (PUBLIC_BASE_URL, the tunnel, else this request's origin) */
export async function mePage(viewer: Viewer, publicUrl = ""): Promise<MeResponse> {
  const db = getDb();
  const user = viewer.user;
  const open = openCalls();
  const named = user?.nickname ? user : null;
  const [summary, unread, favorites, follows, answers, money, friendCode, friends, friendRequests, guestPass] = await Promise.all([
    viewerSummary(user),
    user ? db.notifications.unreadCount(user.id) : 0,
    favoriteTeams(user),
    followedIds(user),
    user && open.length ? db.answers.listForUser(user.id, open.map((c) => c.id)) : [],
    walletOf(user),
    named ? friendCodeOf(named) : null,
    user ? friendIds(user.id) : [],
    user ? pendingFor(user.id) : 0,
    passInfo(user),
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
    publicUrl,
    friendCode,
    friends,
    friendRequests,
    guestPass,
    demoMode: demoMode(),
    // the demo date chip is off for now; to bring it back: demo: demoMode() ? { label: demoLabel() ?? "Demo", now: leagueNow().toISOString() } : null
    // (demoLabel and leagueNow from @/shared/clock)
    asOf: new Date().toISOString(),
    source: "db",
  };
}
