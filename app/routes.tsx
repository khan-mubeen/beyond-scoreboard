// every page in one table. each one is a thin wrapper around a feature screen, loaded on
// demand (one chunk per page, so a phone only downloads the page it opens).
// plain links and full page loads, no router library needed
import { type ComponentType, lazy, type ReactNode, Suspense } from "react";
import { Card } from "@/shared/ui";

/** a screen module's named export as a lazy component */
const page = <P extends object>(load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => ({ default: (await load())[name] as ComponentType<P> }));

const SportsHome = page(() => import("@/features/site/screens/SportsHome"), "SportsHome");
const MatchPage = page<{ id: string }>(() => import("@/features/site/screens/MatchPage"), "MatchPage");
const Rewards = page(() => import("@/features/site/screens/Rewards"), "Rewards");
const Placeholder = page<{ title: string; activeLinkId?: string }>(() => import("@/features/site/screens/Placeholder"), "Placeholder");
const Landing = page(() => import("@/features/live/screens/Landing"), "Landing");
const PhoneRoom = page<{ code: string }>(() => import("@/features/live/screens/PhoneRoom"), "PhoneRoom");
const HostRoom = page<{ code: string }>(() => import("@/features/live/screens/HostRoom"), "HostRoom");
const BigScreen = page<{ code: string }>(() => import("@/features/stakes/screens/BigScreen"), "BigScreen");
const DevLive = page(() => import("@/features/live/screens/DevLive"), "DevLive");
const DevStakes = page(() => import("@/features/stakes/screens/DevStakes"), "DevStakes");
const DevStory = page(() => import("@/features/story/screens/DevStory"), "DevStory");

/** "site" pages use the light kaleva theme, the rest keep the dark room theme */
export type Theme = "site" | "room";

const ROUTES: [RegExp, (params: string[]) => ReactNode, Theme][] = [
  // kaleva sports pages
  [/^\/$/, () => <SportsHome />, "site"],
  [/^\/match\/([^/]+)$/, ([id]) => <MatchPage id={id} />, "site"],
  [/^\/rewards$/, () => <Rewards />, "site"],
  [/^\/calls$/, () => <Placeholder title="My Calls" activeLinkId="calls" />, "site"],
  [/^\/calls\/history$/, () => <Placeholder title="Call History" activeLinkId="history" />, "site"],
  [/^\/achievements$/, () => <Placeholder title="Achievements" activeLinkId="achievements" />, "site"],
  [/^\/settings$/, () => <Placeholder title="Settings" activeLinkId="settings" />, "site"],
  // watch party rooms
  [/^\/watch$/, () => <Landing />, "room"],
  [/^\/room\/([^/]+)$/, ([code]) => <PhoneRoom code={code.toUpperCase()} />, "room"],
  [/^\/room\/([^/]+)\/host$/, ([code]) => <HostRoom code={code.toUpperCase()} />, "room"],
  [/^\/room\/([^/]+)\/screen$/, ([code]) => <BigScreen code={code.toUpperCase()} />, "room"],
  // dev pages
  [/^\/dev$/, () => <DevIndex />, "room"],
  [/^\/dev\/stakes$/, () => <DevStakes />, "room"],
  [/^\/dev\/live$/, () => <DevLive />, "room"],
  [/^\/dev\/story$/, () => <DevStory />, "room"],
];

export function resolveRoute(pathname: string): { element: ReactNode; theme: Theme } {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [pattern, render, theme] of ROUTES) {
    const match = path.match(pattern);
    if (match) return { element: render(match.slice(1).map(decodeURIComponent)), theme };
  }
  return {
    element: <main className="grid min-h-screen place-items-center text-muted">Page not found</main>,
    theme: "room",
  };
}

export function App() {
  return <Suspense fallback={<div className="min-h-screen bg-bg" />}>{resolveRoute(window.location.pathname).element}</Suspense>;
}

const DEV_PAGES = [
  { href: "/", owner: "site", what: "kaleva sports home" },
  { href: "/match/karpat-assat-live", owner: "site", what: "live match page" },
  { href: "/match/karpat-assat-final", owner: "site", what: "finished match page" },
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
