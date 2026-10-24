// team refs for the ui: names from the standings ("HIFK", "K-Espoo"; the teams endpoint's
// shortName is an abbreviation), real logos from the api, the placeholder svgs as a fallback
import type { LiigaTeam } from "@/features/liiga";
import { getSeason, getStandings, getTeams } from "@/features/liiga/server";
import type { TeamRef } from "@/shared/types";

const PLACEHOLDERS: Record<string, string> = {
  kärpät: "karpat",
  ässät: "assat",
  "k-espoo": "kiekko-espoo",
};

export const placeholderLogo = (slug: string) => `/placeholders/teams/${PLACEHOLDERS[slug] ?? slug}.svg`;

export interface TeamBook {
  ref(teamId: string, name?: string): TeamRef;
  byId: Map<string, LiigaTeam>;
}

export async function teamBook(): Promise<TeamBook> {
  const season = await getSeason();
  const [teams, standings] = await Promise.all([getTeams(season).catch(() => null), getStandings(season, true).catch(() => null)]);
  const byId = new Map((teams?.data ?? []).map((t) => [t.id, t]));
  const names = new Map((standings?.data.rows ?? []).map((r) => [r.teamId, r.name]));
  return {
    byId,
    ref(teamId, name) {
      const t = byId.get(teamId);
      const slug = teamId.split(":")[1] ?? teamId;
      return { id: teamId, name: name ?? names.get(teamId) ?? t?.name ?? slug, logo: t?.logoLight ?? t?.logoDark ?? placeholderLogo(slug) };
    },
  };
}
