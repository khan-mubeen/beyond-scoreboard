// the parts of the chrome that never change: the sports sub-navigation, search and the sidebar links.
// everything about the viewer (points, teams, notifications) comes from /api/site/me
import type { NavLink, QuickLink } from "@/shared/types";
import { NAMES } from "@/shared/copy/names";

/** the home date dropdown is hidden until it does something (VITE_SHOW_DATE_PICKER=true shows it) */
export const SHOW_DATE_PICKER = import.meta.env.VITE_SHOW_DATE_PICKER === "true";

/** the kaleva sports sub-navigation, in the header and the phone menu */
const SPORTS_LINKS: (NavLink & { id: string })[] = [
  { id: "home", label: "Home", href: "/sports" },
  { id: "live", label: "Live", href: "/sports?show=live" },
  { id: "results", label: "Results", href: "/sports?show=results" },
  { id: "teams", label: "Teams", href: "/teams" },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
  { id: "calls", label: NAMES.call, href: "/calls" },
  { id: "rewards", label: "Rewards", href: "/rewards" },
];

/** which sub-navigation item a page belongs to */
export function sportsSection(path: string, search = ""): string | null {
  if (path === "/sports") {
    const show = new URLSearchParams(search).get("show");
    return show === "live" ? "live" : show === "results" ? "results" : "home";
  }
  if (path.startsWith("/teams")) return "teams";
  if (path === "/leaderboard") return "leaderboard";
  if (path.startsWith("/calls")) return "calls";
  if (path === "/rewards") return "rewards";
  return null;
}

/** the sub-navigation for the page at path, with the current item marked */
export function sportsNav(path: string, search = ""): NavLink[] {
  const active = sportsSection(path, search);
  return SPORTS_LINKS.map(({ id, ...l }) => ({ ...l, ...(id === active && { active: true }) }));
}

/** for tests and the link audit */
export const SPORTS_NAV = SPORTS_LINKS;

export const SEARCH_PLACEHOLDER = "Search for news, topics or players...";

export const QUICK_LINKS: QuickLink[] = [
  { id: "home", label: "Home", href: "/sports", icon: "home" },
  { id: "calls", label: NAMES.call, href: "/calls", icon: "calls" },
  { id: "history", label: "Call history", href: "/calls/history", icon: "history" },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard", icon: "leaderboard" },
  { id: "teams", label: "Teams", href: "/teams", icon: "teams" },
  { id: "rewards", label: "Kaleva Rewards", href: "/rewards", icon: "rewards" },
  { id: "achievements", label: "Achievements", href: "/achievements", icon: "achievements" },
  { id: "profile", label: "Profile", href: "/profile", icon: "profile" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];
