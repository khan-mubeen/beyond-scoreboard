import { PageLoading } from "../components/PageLoading";
import { SiteLayout } from "../components/SiteLayout";
import { useMatchDetail, useSiteChrome } from "../data";
import { FinishedMatch } from "./FinishedMatch";
import { LiveMatch } from "./LiveMatch";
import { Placeholder } from "./Placeholder";

/** /match/:id picks the live (or upcoming) or the finished layout from the match status */
export function MatchPage({ id }: { id: string }) {
  const { data: match, status, source } = useMatchDetail(id);
  const chrome = useSiteChrome();
  if (status === "loading") {
    return (
      <SiteLayout chrome={chrome} sidebar={{ docked: false }}>
        <PageLoading label="Loading the match…" />
      </SiteLayout>
    );
  }
  if (!match) return <Placeholder title="Match centre" />;
  return match.status === "final" ? <FinishedMatch match={match} source={source} /> : <LiveMatch match={match} source={source} />;
}
