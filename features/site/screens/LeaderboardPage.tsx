import { useState } from "react";
import type { LeaderboardScope } from "@/shared/types";
import { fmtInt } from "../format";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { type TabItem, Tabs } from "../components/Tabs";
import { BoardRow } from "../components/Leaderboard";
import { useLeaderboard } from "../data";
import { NAMES } from "@/shared/copy/names";

const TABS: TabItem<LeaderboardScope>[] = [
  { id: "weekly", label: "Weekly" },
  { id: "season", label: "Season" },
  { id: "room", label: "Watch Party" },
];

const initialScope = (): LeaderboardScope => {
  const s = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("scope");
  return s === "season" || s === "room" ? s : "weekly";
};

/** /leaderboard: weekly (mon-sun, finnish time), season, and the watch together room */
export function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>(initialScope);
  const { data, status, refresh } = useLeaderboard(scope);

  return (
    <SiteLayout sidebar={{ activeLinkId: "leaderboard", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Leaderboard" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">{data?.title ?? "Weekly Leaderboard"}</h1>
        <div className="mt-4 max-w-3xl">
          <Tabs label="Leaderboards" idPrefix="board" tabs={TABS} active={scope} onChange={setScope} />
          <div id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${scope}`} className="mt-4">
            {!data ? (
              status === "error" ? (
                <DataUnavailable what="the leaderboard" onRetry={refresh} />
              ) : (
                <ListSkeleton rows={10} title={false} />
              )
            ) : (
              <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <p className="border-b border-line px-4 py-3 text-sm text-muted">
                  {data.note} {data.total > 0 && `${fmtInt(data.total)} ${data.total === 1 ? "fan" : "fans"}.`} Tap a fan to see where their points came from.
                </p>
                {data.entries.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted">
                    {scope === "room" ? "No points in the room yet. Join a match and answer a question." : `No points yet. Answer a ${NAMES.call} question to get on the board.`}
                  </p>
                ) : (
                  <ol className="relative max-h-[70vh] divide-y divide-line overflow-y-auto">
                    {data.entries.map((e) => (
                      <BoardRow key={e.playerId} e={e} max={data.entries[0]?.score ?? 1} scope={scope} />
                    ))}
                    {data.you && <BoardRow e={data.you} max={data.entries[0]?.score ?? 1} scope={scope} pinned />}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </SiteLayout>
  );
}
