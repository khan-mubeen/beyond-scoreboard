import { useMatchDetail } from "../data";
import { FinishedMatch } from "./FinishedMatch";
import { LiveMatch } from "./LiveMatch";
import { Placeholder } from "./Placeholder";

/** /match/:id picks the live or finished layout from the match status */
export function MatchPage({ id }: { id: string }) {
  const match = useMatchDetail(id);
  if (!match) return <Placeholder title="Match centre" />;
  return match.status === "live" ? <LiveMatch match={match} /> : <FinishedMatch match={match} />;
}
