// every page in one table. each one is a thin wrapper around a feature screen.
// plain links and full page loads, no router library needed
import type { ReactNode } from "react";
import { DevLive } from "@/features/live/screens/DevLive";
import { HostRoom } from "@/features/live/screens/HostRoom";
import { Landing } from "@/features/live/screens/Landing";
import { PhoneRoom } from "@/features/live/screens/PhoneRoom";
import { MatchPage } from "@/features/site/screens/MatchPage";
import { Placeholder } from "@/features/site/screens/Placeholder";
import { Rewards } from "@/features/site/screens/Rewards";
import { SportsHome } from "@/features/site/screens/SportsHome";
import { BigScreen } from "@/features/stakes/screens/BigScreen";
import { DevStakes } from "@/features/stakes/screens/DevStakes";
import { DevStory } from "@/features/story/screens/DevStory";
import { Card } from "@/shared/ui";

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
  return resolveRoute(window.location.pathname).element;
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
