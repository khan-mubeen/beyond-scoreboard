import type { MatchSummary } from "@/shared/types";
import { fmtCountdown, useServerNow } from "../data";

function Countdown({ at }: { at: number }) {
  const now = useServerNow(1000);
  return <span className="tabular-nums">Starts in {fmtCountdown(at - now)}</span>;
}

/** "Today 18:30", or for a demo rotation match not on yet a live "Starts in 9:12" */
export function WhenLabel({ match }: { match: MatchSummary }) {
  return match.startsAt ? <Countdown at={match.startsAt} /> : <>{match.whenLabel}</>;
}
