// the parts of the chrome that never change: search and the sidebar links (the quick links are the
// sports navigation; live and results are the home page's filter pills).
// everything about the viewer (points, teams, notifications) comes from /api/site/me
import type { QuickLink } from "@/shared/types";
import { NAMES } from "@/shared/copy/names";

/** the home date dropdown is hidden until it does something (VITE_SHOW_DATE_PICKER=true shows it) */
export const SHOW_DATE_PICKER = import.meta.env.VITE_SHOW_DATE_PICKER === "true";

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
  { id: "friends", label: "Friends", href: "/friends", icon: "friends" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];
