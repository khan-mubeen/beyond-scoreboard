// every page in one table. each one is a thin wrapper around a feature screen.
// plain links and full page loads, no router library needed
import type { ReactNode } from "react";
import { DevLive } from "@/features/live/screens/DevLive";
import { HostRoom } from "@/features/live/screens/HostRoom";
import { Landing } from "@/features/live/screens/Landing";
import { PhoneRoom } from "@/features/live/screens/PhoneRoom";
import { BigScreen } from "@/features/stakes/screens/BigScreen";
import { DevStakes } from "@/features/stakes/screens/DevStakes";
import { DevStory } from "@/features/story/screens/DevStory";
import { Card } from "@/shared/ui";

const ROUTES: [RegExp, (params: string[]) => ReactNode][] = [
  [/^\/$/, () => <Landing />],
  [/^\/room\/([^/]+)$/, ([code]) => <PhoneRoom code={code.toUpperCase()} />],
  [/^\/room\/([^/]+)\/host$/, ([code]) => <HostRoom code={code.toUpperCase()} />],
  [/^\/room\/([^/]+)\/screen$/, ([code]) => <BigScreen code={code.toUpperCase()} />],
  [/^\/dev$/, () => <DevIndex />],
  [/^\/dev\/stakes$/, () => <DevStakes />],
  [/^\/dev\/live$/, () => <DevLive />],
  [/^\/dev\/story$/, () => <DevStory />],
];

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  for (const [pattern, render] of ROUTES) {
    const match = path.match(pattern);
    if (match) return render(match.slice(1).map(decodeURIComponent));
  }
  return <main className="grid min-h-screen place-items-center text-muted">Page not found</main>;
}

const DEV_PAGES = [
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
