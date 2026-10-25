// team accent colours for the charts and outcome cards: the same pair the placeholder logos use
// (public/placeholders/teams). browser-safe. bg is the team's main colour, fg readable text on it
import type { TeamRef } from "@/shared/types";

export interface TeamColors {
  bg: string;
  fg: string;
}

const BY_LOGO: Record<string, TeamColors> = {
  assat: { bg: "#D80016", fg: "#FFFFFF" },
  hifk: { bg: "#C8102E", fg: "#FFFFFF" },
  hpk: { bg: "#F26522", fg: "#1D1D1F" },
  ilves: { bg: "#00703C", fg: "#FFD200" },
  jukurit: { bg: "#002B5C", fg: "#FFC72C" },
  jyp: { bg: "#8B0A1A", fg: "#FFFFFF" },
  kalpa: { bg: "#1D1D1F", fg: "#F3C300" },
  karpat: { bg: "#F5C400", fg: "#111111" },
  "kiekko-espoo": { bg: "#003DA5", fg: "#FFFFFF" },
  "k-espoo": { bg: "#003DA5", fg: "#FFFFFF" },
  jokerit: { bg: "#E30613", fg: "#FFFFFF" },
  kookoo: { bg: "#E8611A", fg: "#FFFFFF" },
  lukko: { bg: "#0057A8", fg: "#FFFFFF" },
  pelicans: { bg: "#0078C1", fg: "#FFFFFF" },
  saipa: { bg: "#FFD100", fg: "#1D1D1F" },
  sport: { bg: "#DA291C", fg: "#FFFFFF" },
  tappara: { bg: "#F47A20", fg: "#003A70" },
  tps: { bg: "#1D1D1F", fg: "#FFFFFF" },
};

const FALLBACK: TeamColors = { bg: "#4B5563", fg: "#FFFFFF" };

/** a colour mixed with white (share 0-1 of the colour): the fallback where color-mix() isn't supported */
export function tintOf(hex: string, share: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * share + 255 * (1 - share));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * css variables for the team-tint utilities (globals.css): a light tint of the team colour for a
 * background, its full colour for accents
 */
export const tintVars = (c: TeamColors) =>
  ({ "--team": c.bg, "--team-fg": c.fg, "--team-tint": tintOf(c.bg, 0.12), "--team-tint-strong": tintOf(c.bg, 0.22) }) as Record<string, string>;

/** "kärpät" -> "karpat" */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** a team's colours: from its liiga id's slug ("495643563:kärpät"), else its placeholder logo's name */
export function teamColors(team: Pick<TeamRef, "logo"> & { id?: string }): TeamColors {
  const fromId = team.id?.includes(":") ? fold(team.id.split(":")[1]) : null;
  const fromLogo = /\/teams\/([a-z-]+)\.svg$/.exec(team.logo ?? "")?.[1];
  return (fromId && BY_LOGO[fromId]) || (fromLogo && BY_LOGO[fromLogo]) || FALLBACK;
}
