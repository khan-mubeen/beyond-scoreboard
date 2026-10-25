// every page in one table. each one is a thin wrapper around a feature screen, loaded on
// demand (one chunk per page, so a phone only downloads the page it opens).
// plain <a> links; between site pages the click is handled here (history.pushState), so the
// data cache survives and a visited page shows its last data at once. no router library needed
import { type ComponentType, Fragment, lazy, type ReactNode, startTransition, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Card } from "@/shared/ui";

/** a screen module's named export as a lazy component */
const page = <P extends object>(load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => ({ default: (await load())[name] as ComponentType<P> }));

const SportsHome = page(() => import("@/features/site/screens/SportsHome"), "SportsHome");
const KalevaHome = page(() => import("@/features/site/screens/KalevaHome"), "KalevaHome");
const BrandPage = page(() => import("@/features/site/screens/BrandPage"), "BrandPage");
const MatchPage = page<{ id: string }>(() => import("@/features/site/screens/MatchPage"), "MatchPage");
const Rewards = page(() => import("@/features/site/screens/Rewards"), "Rewards");
const LeaderboardPage = page(() => import("@/features/site/screens/LeaderboardPage"), "LeaderboardPage");
const Guidelines = page(() => import("@/features/site/screens/Guidelines"), "Guidelines");
const DemoControl = page(() => import("@/features/site/screens/DemoControl"), "DemoControl");
const TvNow = page(() => import("@/features/site/screens/TvMatch"), "TvNow");
const JoinNow = page(() => import("@/features/site/screens/TvMatch"), "JoinNow");
const FriendsPage = page(() => import("@/features/site/screens/FriendsPage"), "FriendsPage");
const InvitePage = page<{ code: string }>(() => import("@/features/site/screens/FriendsPage"), "InvitePage");
const TeamsPage = page(() => import("@/features/site/screens/TeamsPage"), "TeamsPage");
const TeamPage = page<{ slug: string }>(() => import("@/features/site/screens/TeamPage"), "TeamPage");
const ProfilePage = page(() => import("@/features/site/screens/ProfilePage"), "ProfilePage");
const AchievementsPage = page(() => import("@/features/site/screens/ProfilePage"), "AchievementsPage");
const MyCalls = page(() => import("@/features/site/screens/MyCalls"), "MyCalls");
const CallHistory = page(() => import("@/features/site/screens/MyCalls"), "CallHistory");
const SettingsPage = page(() => import("@/features/site/screens/SettingsPage"), "SettingsPage");
const AiPage = page(() => import("@/features/site/screens/AiPage"), "AiPage");
const EditorPage = page(() => import("@/features/site/screens/EditorPage"), "EditorPage");
const NotFound = page(() => import("@/features/site/screens/NotFound"), "NotFound");
const Landing = page(() => import("@/features/live/screens/Landing"), "Landing");
const PhoneRoom = page<{ code: string }>(() => import("@/features/live/screens/PhoneRoom"), "PhoneRoom");
const HostRoom = page<{ code: string }>(() => import("@/features/live/screens/HostRoom"), "HostRoom");
const BigScreen = page<{ code: string }>(() => import("@/features/stakes/screens/BigScreen"), "BigScreen");
const DevLive = page(() => import("@/features/live/screens/DevLive"), "DevLive");
const DevStakes = page(() => import("@/features/stakes/screens/DevStakes"), "DevStakes");
const DevStory = page(() => import("@/features/story/screens/DevStory"), "DevStory");

/** "site" pages use the light kaleva theme, the rest keep the dark room theme */
export type Theme = "site" | "room";

/** pattern, page, theme, the default <title> (a page with data sets a better one: usePageTitle) */
const ROUTES: [RegExp, (params: string[]) => ReactNode, Theme, string][] = [
  // the kaleva.fi front page, rebuilt; its links open kaleva.fi, Kaleva Sports is the one way in
  [/^\/$/, () => <KalevaHome />, "site", "Kaleva"],
  // kaleva sports pages
  [/^\/sports$/, () => <SportsHome />, "site", "Kaleva Sports"],
  [/^\/dev\/brand$/, () => <BrandPage />, "site", "Brand · Kaleva Sports"],
  [/^\/match\/([^/]+)$/, ([id]) => <MatchPage id={id} />, "site", "Match · Kaleva Sports"],
  [/^\/rewards$/, () => <Rewards />, "site", "Rewards · Kaleva Sports"],
  [/^\/leaderboard$/, () => <LeaderboardPage />, "site", "Leaderboard · Kaleva Sports"],
  [/^\/guidelines$/, () => <Guidelines />, "site", "Community guidelines · Kaleva Sports"],
  [/^\/demo\/control$/, () => <DemoControl />, "site", "Demo control · Kaleva Sports"],
  [/^\/tv$/, () => <TvNow />, "site", "TV · Kaleva Sports"],
  // the watch party: the short address on the tv, friends, invite links
  [/^\/join$/, () => <JoinNow />, "site", "Watch the live match · Kaleva Sports"],
  [/^\/friends$/, () => <FriendsPage />, "site", "Friends · Kaleva Sports"],
  [/^\/i\/([A-Za-z0-9]{6,12})$/, ([code]) => <InvitePage code={code} />, "site", "You're invited · Kaleva Sports"],
  [/^\/calls$/, () => <MyCalls />, "site", "My calls · Kaleva Sports"],
  [/^\/calls\/history$/, () => <CallHistory />, "site", "Call history · Kaleva Sports"],
  [/^\/teams$/, () => <TeamsPage />, "site", "Teams · Kaleva Sports"],
  [/^\/teams\/([^/]+)$/, ([slug]) => <TeamPage slug={slug} />, "site", "Team · Kaleva Sports"],
  [/^\/profile$/, () => <ProfilePage />, "site", "Profile · Kaleva Sports"],
  [/^\/achievements$/, () => <AchievementsPage />, "site", "Achievements · Kaleva Sports"],
  [/^\/settings$/, () => <SettingsPage />, "site", "Settings · Kaleva Sports"],
  // responsible ai: how we use it, and the editors' review (host token)
  [/^\/sports\/ai$/, () => <AiPage />, "site", "How we use AI · Kaleva Sports"],
  [/^\/editor$/, () => <EditorPage />, "site", "Editor · Kaleva Sports"],
  // watch party rooms
  [/^\/watch$/, () => <Landing />, "room", "Watch party · Kaleva Sports"],
  [/^\/room\/([^/]+)$/, ([code]) => <PhoneRoom code={code.toUpperCase()} />, "room", "Watch party room · Kaleva Sports"],
  [/^\/room\/([^/]+)\/host$/, ([code]) => <HostRoom code={code.toUpperCase()} />, "room", "Host · Kaleva Sports"],
  [/^\/room\/([^/]+)\/screen$/, ([code]) => <BigScreen code={code.toUpperCase()} />, "room", "Big screen · Kaleva Sports"],
  // dev pages
  [/^\/dev$/, () => <DevIndex />, "room", "Dev pages"],
  [/^\/dev\/stakes$/, () => <DevStakes />, "room", "Dev: stakes"],
  [/^\/dev\/live$/, () => <DevLive />, "room", "Dev: live"],
  [/^\/dev\/story$/, () => <DevStory />, "room", "Dev: story"],
];

const NOT_FOUND = { element: <NotFound />, theme: "site" as Theme, title: "Page not found · Kaleva Sports" };

function find(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [pattern, render, theme, title] of ROUTES) {
    const match = path.match(pattern);
    if (match) return { render: () => render(match.slice(1).map(decodeURIComponent)), theme, title };
  }
  return null;
}

/**
 * old deep links: the sports home used to be "/", so "/?show=live", "/#liiga-table" and the like
 * go to /sports with the same query and anchor. a few likely aliases too
 */
const SPORTS_HOME_ANCHORS = new Set(["#liiga-table", "#season-stakes", "#live", "#results", "#upcoming"]);
const SPORTS_HOME_PARAMS = ["show", "team", "date", "filter"];
const ALIASES = new Set(["/sport", "/urheilu", "/kaleva-sports", "/home"]);

export function redirectFor(pathname: string, search = "", hash = ""): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (ALIASES.has(path)) return `/sports${search}${hash}`;
  if (path !== "/") return null;
  const params = new URLSearchParams(search);
  if (SPORTS_HOME_PARAMS.some((p) => params.has(p)) || SPORTS_HOME_ANCHORS.has(hash)) return `/sports${search}${hash}`;
  return null;
}

/** applies a redirect to the address bar (no new history entry); the path + query to show */
function redirected(): string {
  const { pathname, search, hash } = window.location;
  const to = redirectFor(pathname, search, hash);
  if (to) window.history.replaceState(null, "", to);
  return window.location.pathname + window.location.search;
}

export function resolveRoute(pathname: string): { element: ReactNode; theme: Theme; title: string } {
  const hit = find(pathname);
  return hit ? { element: hit.render(), theme: hit.theme, title: hit.title } : NOT_FOUND;
}

/** true when a path (no query or hash) is a page of the app; the link audit test uses it */
export const isRoute = (pathname: string) => find(pathname) !== null;

const here = () => redirected();

/** a click on a link to another site page, handled without a full page load */
function inAppTarget(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || a.target || a.hasAttribute("download") || a.origin !== window.location.origin) return null;
  const href = a.getAttribute("href") ?? "";
  if (!href || href.startsWith("#")) return null;
  // a hash on the same page scrolls natively
  if (a.pathname === window.location.pathname && a.search === window.location.search && a.hash) return null;
  // the room and dev pages are a different app (dark theme): those load in full
  const to = find(a.pathname);
  return to?.theme === "site" && find(window.location.pathname)?.theme === "site" ? a : null;
}

export function App() {
  const [location, setLocation] = useState(here);

  useEffect(() => {
    const sync = () => startTransition(() => setLocation(here()));
    const onClick = (e: MouseEvent) => {
      const a = inAppTarget(e);
      if (!a) return;
      e.preventDefault();
      window.history.pushState(null, "", a.href);
      sync();
      requestAnimationFrame(() => (a.hash ? document.getElementById(a.hash.slice(1))?.scrollIntoView() : window.scrollTo(0, 0)));
    };
    window.addEventListener("popstate", sync);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", sync);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const path = location.split("?")[0];
  // the route's default title; a layout effect, so a page's own (usePageTitle, a passive effect) wins
  useLayoutEffect(() => {
    document.title = find(path)?.title ?? NOT_FOUND.title;
  }, [path]);
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Fragment key={location}>{resolveRoute(path).element}</Fragment>
    </Suspense>
  );
}

const DEV_PAGES = [
  { href: "/", owner: "site", what: "kaleva.fi front page (rebuilt)" },
  { href: "/sports", owner: "site", what: "kaleva sports home" },
  { href: "/leaderboard", owner: "site", what: "weekly, season and watch together leaderboards" },
  { href: "/rewards", owner: "site", what: "kaleva rewards" },
  { href: "/watch", owner: "live", what: "create or join a watch party room" },
  { href: "/dev/stakes", owner: "stakes", what: "meter, season strip and projected table on mock data" },
  { href: "/dev/live", owner: "live", what: "step through a full game, phone and host side by side" },
  { href: "/dev/story", owner: "story", what: "fact ledger, brief and story, verification panel" },
  { href: "/room/TEST", owner: "live", what: "phone in the always-on TEST room" },
  { href: "/room/TEST/host", owner: "live", what: "host controls for TEST" },
  { href: "/room/TEST/screen", owner: "stakes", what: "big screen for TEST" },
];

function DevIndex() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Dev pages</h1>
      {DEV_PAGES.map((p) => (
        <a key={p.href} href={p.href}>
          <Card className="transition hover:border-accent">
            <div className="font-mono text-accent">{p.href}</div>
            <div className="text-sm text-muted">
              {p.owner} · {p.what}
            </div>
          </Card>
        </a>
      ))}
    </main>
  );
}
