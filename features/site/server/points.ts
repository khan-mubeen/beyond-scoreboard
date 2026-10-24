// the balance (the sum of the whole ledger: earned, the welcome balance, minus spending), and
// the earned totals that boards, levels and the weekly figure use (mon-sun, europe/helsinki)
import { getDb, type DbPoints, type DbUser } from "@/shared/db";
import { balanceOf, isEarned } from "@/shared/points";
import type { SiteLeaderboardEntry, UserSummary } from "@/shared/types";
import { levelFor } from "./config";
import { displayName, welcomePoints } from "./identity";
import { weekStart } from "./labels";

/** "initial:G": the ui draws an initial circle for it (Avatar); the seeded fans keep their pictures */
export const initialAvatar = (name: string) => `initial:${(name.trim()[0] ?? "G").toUpperCase()}`;
const AVATARS: Record<string, string> = {
  "Mikko Korhonen": "/placeholders/avatars/mk.svg",
  "Laura Nieminen": "/placeholders/avatars/ln.svg",
  "Jussi Virtanen": "/placeholders/avatars/jv.svg",
  "Emilia Laine": "/placeholders/avatars/el.svg",
  "Antti Heikkinen": "/placeholders/avatars/ah.svg",
};
export const avatarFor = (name: string) => AVATARS[name] ?? initialAvatar(name);

export async function userSummary(user: DbUser, now = new Date()): Promise<UserSummary> {
  const rows = await getDb().points.listForUser(user.id);
  const earned = rows.filter(isEarned);
  const since = weekStart(now).toISOString();
  const week = balanceOf(earned.filter((r) => r.createdAt >= since));
  const name = displayName(user);
  // points: what the fan can spend; the level grows with earned points only
  return { id: user.id, name, role: "Sports fan", avatar: avatarFor(name), points: balanceOf(rows), pointsThisWeek: week, ...levelFor(balanceOf(earned)) };
}

/**
 * the sidebar profile: the viewer (a "Guest" until they pick a nickname), or a visitor who has no
 * row yet: "Guest" with the welcome balance they start with. the seeded demo profile is only ever
 * shown to the seeded fan themselves
 */
export async function viewerSummary(user: DbUser | null): Promise<UserSummary> {
  if (user) return { ...(await userSummary(user)), ...(!user.nickname && { role: "Pick a nickname in any match" }) };
  return { id: "guest", name: "Guest", role: "Join a match to play", avatar: initialAvatar("Guest"), points: welcomePoints(), pointsThisWeek: 0, ...levelFor(0) };
}

// the fake players, briefly cached: every leaderboard and count leaves them out
let bots: { at: number; ids: Promise<Set<string>> } | null = null;
export function botIds(): Promise<Set<string>> {
  if (!bots || Date.now() - bots.at > 5000) {
    const ids = getDb()
      .users.botIds()
      .then((x) => new Set(x));
    ids.catch(() => (bots = null));
    bots = { at: Date.now(), ids };
  }
  return bots.ids;
}

/** earned points per user (bots, the welcome balance and spending left out), highest first, equal points share a rank */
export async function rankPoints(rows: DbPoints[], limit: number, youId?: string | null): Promise<SiteLeaderboardEntry[]> {
  const skip = await botIds();
  const totals = new Map<string, number>();
  for (const r of rows) if (!skip.has(r.userId) && isEarned(r)) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.points);
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const users = new Map((await getDb().users.getMany(sorted.slice(0, limit).map(([id]) => id).concat(youId ? [youId] : []))).map((u) => [u.id, u]));
  const rankOf = (score: number) => 1 + sorted.filter(([, s]) => s > score).length;
  const entry = ([id, score]: [string, number]): SiteLeaderboardEntry => {
    const name = displayName(users.get(id));
    return { playerId: id, nickname: name, score, rank: rankOf(score), avatar: avatarFor(name), ...(id === youId && { isYou: true }) };
  };
  const top = sorted.slice(0, limit).map(entry);
  if (youId && !top.some((e) => e.playerId === youId) && totals.has(youId)) top.push(entry([youId, totals.get(youId)!]));
  return top;
}

export async function weeklyLeaderboard(youId: string | null, now = new Date()) {
  return rankPoints(await getDb().points.listSince(weekStart(now).toISOString()), 5, youId);
}
