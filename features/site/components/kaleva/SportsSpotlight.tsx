// the kaleva.fi front page's pointer to "Kaleva Sports · NEW": ~600 ms after load, in demo mode
// (the server's demo flag) or with ?tour=1 every time, otherwise once per visitor
import { useEffect, useState } from "react";
import { useMe } from "../../data";
import { Spotlight } from "../Spotlight";
import { markSpotlightSeen, shouldShowSpotlight, spotlightSeen } from "../spotlight-rule";

const DELAY_MS = 600;

export function SportsSpotlight() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const tour = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tour") === "1";
  // decide once the viewer is known (a failed load counts as not demo)
  const known = tour || me.status !== "loading";
  const demo = !!me.data?.demoMode;

  useEffect(() => {
    if (!known || !shouldShowSpotlight({ demo, tour, seen: spotlightSeen() })) return;
    const t = setTimeout(() => {
      setOpen(true);
      if (!demo && !tour) markSpotlightSeen();
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [known, demo, tour]);

  if (!open) return null;
  return (
    <Spotlight
      target='[data-testid="kaleva-sports-nav"]'
      title="New: Kaleva Sports"
      text="Play along live, follow what every game means and earn points with friends."
      action={{ label: "Explore Kaleva Sports", href: "/sports" }}
      onClose={() => setOpen(false)}
    />
  );
}
