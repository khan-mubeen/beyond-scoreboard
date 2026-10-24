// the viewer's teams: the liiga teams they follow. home personalises for the site's team until
// they pick their own; the "my favorite teams" list shows only real follows
import { getDb, type DbUser } from "@/shared/db";
import type { FavoriteTeam } from "@/shared/types";
import { SITE } from "./config";
import { teamBook } from "./teams";

/** the teams this fan chose to follow (none for a guest) */
export const followedIds = async (user: DbUser | null): Promise<string[]> => (user ? getDb().favorites.list(user.id) : []);

/** the teams to show and personalise for: the followed ones, else the site's favourite */
export async function favoriteTeamIds(user: DbUser | null): Promise<string[]> {
  const follows = await followedIds(user);
  if (follows.length) return follows;
  const book = await teamBook();
  const fav = [...book.byId.keys()].find((id) => id.endsWith(`:${SITE.favoriteSlug}`));
  return fav ? [fav] : [];
}

/** "my favorite teams": only the teams the fan follows (empty: "Follow a team") */
export async function favoriteTeams(user: DbUser | null): Promise<FavoriteTeam[]> {
  const [book, ids] = await Promise.all([teamBook(), followedIds(user)]);
  return ids.map((id) => ({ team: book.ref(id), league: "Liiga", starred: true, comingSoon: false }));
}
