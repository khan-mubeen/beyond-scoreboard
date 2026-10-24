// the viewer's teams: the liiga teams they follow (the site's team until they pick their own),
// then the sports we don't cover yet
import { getDb, type DbUser } from "@/shared/db";
import type { FavoriteTeam } from "@/shared/types";
import { SITE } from "./config";
import { teamBook } from "./teams";

const COMING_SOON_FAVORITES: FavoriteTeam[] = [
  { team: { id: "lippo", name: "Oulun Lippo", logo: "/placeholders/teams/lippo.svg" }, league: "Superpesis", starred: false, comingSoon: true },
  { team: { id: "oulu-basketball", name: "Oulu Basketball", logo: "/placeholders/teams/oulu-basketball.svg" }, league: "Korisliiga", starred: false, comingSoon: true },
  { team: { id: "finland", name: "Finland National Team", logo: "/placeholders/teams/finland.svg" }, league: "Ice hockey", starred: false, comingSoon: true },
];

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

export async function favoriteTeams(user: DbUser | null): Promise<FavoriteTeam[]> {
  const [book, ids] = await Promise.all([teamBook(), favoriteTeamIds(user)]);
  return [...ids.map((id) => ({ team: book.ref(id), league: "Liiga", starred: true, comingSoon: false })), ...COMING_SOON_FAVORITES];
}
