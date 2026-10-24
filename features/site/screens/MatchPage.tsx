import { SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, MatchSkeleton } from "../components/Skeleton";
import { isMockMatch, USE_MOCKS, useMatchDetail } from "../data";
import { FinishedMatch } from "./FinishedMatch";
import { LiveMatch } from "./LiveMatch";
import { MatchPreview } from "./MatchPreview";
import { Placeholder } from "./Placeholder";
import { TvMatch } from "./TvMatch";

const tvMode = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tv") === "1";

/** /match/:id picks the preview (not started), live or finished layout from the match status; ?tv=1 is the projector view */
export function MatchPage({ id }: { id: string }) {
  if (tvMode()) return <TvMatch id={id} />;
  return <MatchView id={id} />;
}

function MatchView({ id }: { id: string }) {
  const { data: match, status, source, refresh } = useMatchDetail(id);
  if (isMockMatch(id) && !USE_MOCKS) return <Placeholder title="Match centre" />;
  if (!match) {
    if (status === "notfound") return <Placeholder title="Match centre" />;
    return (
      <SiteLayout sidebar={{ docked: false }}>
        {status === "error" ? <DataUnavailable what="this match" onRetry={refresh} /> : <MatchSkeleton />}
      </SiteLayout>
    );
  }
  // a live game that ends (or a rotation match that moves on) refetches the page in place
  if (match.status === "preview") return <MatchPreview match={match} onChange={refresh} />;
  return match.status === "final" ? (
    <FinishedMatch match={match} source={source} onChange={refresh} />
  ) : (
    <LiveMatch match={match} source={source} onChange={refresh} />
  );
}
