// the parts of the chrome that never change: the kaleva sections, search and the sidebar links.
// everything about the viewer (points, teams, notifications) comes from /api/site/me
import type { NavLink, QuickLink } from "@/shared/types";

const KALEVA = "https://www.kaleva.fi/";

/** the rest of kaleva.fi; sports is this app */
export const NAV: NavLink[] = [
  { label: "News", href: KALEVA },
  { label: "Oulu", href: KALEVA },
  { label: "Northern Finland", href: KALEVA },
  { label: "Sports", href: "/", active: true },
  { label: "Culture", href: KALEVA },
  { label: "Opinions", href: KALEVA },
];

export const SEARCH_PLACEHOLDER = "Search for news, topics or players...";

export const QUICK_LINKS: QuickLink[] = [
  { id: "home", label: "Home", href: "/", icon: "home" },
  { id: "calls", label: "My Calls", href: "/calls", icon: "calls" },
  { id: "history", label: "Call History", href: "/calls/history", icon: "history" },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard", icon: "leaderboard" },
  { id: "teams", label: "Teams", href: "/teams", icon: "teams" },
  { id: "rewards", label: "Kaleva Rewards", href: "/rewards", icon: "rewards" },
  { id: "achievements", label: "Achievements", href: "/achievements", icon: "achievements" },
  { id: "profile", label: "Profile", href: "/profile", icon: "profile" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];
