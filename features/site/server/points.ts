// season total, weekly total (mon-sun, europe/helsinki) and level, all from points_ledger
import { getDb, type DbPoints, type DbUser } from "@/shared/db";
import type { SiteLeaderboardEntry, UserSummary } from "@/shared/types";
import { levelFor, SITE } from "./config";
import { displayName } from "./identity";
import { weekStart } from "./labels";

const initialsAvatar = () => "/placeholders/avatars/fan.svg";
const AVATARS: Record<string, string> = {
  "Mikko Korhonen": "/placeholders/avatars/mk.svg",
  "Laura Nieminen": "/placeholders/avatars/ln.svg",
  "Jussi Virtanen": "/placeholders/avatars/jv.svg",
  "Emilia Laine": "/placeholders/avatars/el.svg",
  "Antti Heikkinen": "/placeholders/avatars/ah.svg",
};
export const avatarFor = (name: string) => AVATARS[name] ?? initialsAvatar();

export async function userSummary(user: DbUser, now = new Date()): Promise<UserSummary> {
  const rows = await getDb().points.listForUser(user.id);
  const season = rows.reduce((a, r) => a + r.points, 0);
  const since = weekStart(now).toISOString();
  const week = rows.filter((r) => r.createdAt >= since).reduce((a, r) => a + r.points, 0);
  const name = displayName(user);
  return { id: user.id, name, role: "Sports fan", avatar: avatarFor(name), points: season, pointsThisWeek: week, ...levelFor(season) };
}

/** the sidebar profile: the viewer once they joined, else the seeded demo profile, else a guest */
export async function viewerSummary(user: DbUser | null): Promise<UserSummary> {
  if (user) return userSummary(user);
  if (process.env.DEMO_PROFILE !== "false") {
    const demo = await getDb().users.getByAnonId(SITE.demoAnonId);
    if (demo) return userSummary(demo);
  }
  return { id: "guest", name: "Guest", role: "Join a match to play", avatar: initialsAvatar(), points: 0, pointsThisWeek: 0, ...levelFor(0) };
}

/** points per user, highest first, equal points share a rank */
export async function rankPoints(rows: DbPoints[], limit: number, youId?: string | null): Promise<SiteLeaderboardEntry[]> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.points);
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
