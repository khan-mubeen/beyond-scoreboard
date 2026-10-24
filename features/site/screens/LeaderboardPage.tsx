import { useState } from "react";
import type { LeaderboardScope, SiteLeaderboardEntry } from "@/shared/types";
import { fmtInt } from "../format";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { type TabItem, Tabs } from "../components/Tabs";
import { Avatar } from "../components/TeamLogo";
import { useLeaderboard } from "../data";

const TABS: TabItem<LeaderboardScope>[] = [
  { id: "weekly", label: "Weekly" },
  { id: "season", label: "Season" },
  { id: "room", label: "Watch Together" },
];

const MEDAL = ["bg-highlight text-gold", "bg-surface-2 text-ink", "bg-accent-soft text-accent"];

function Row({ e, pinned = false }: { e: SiteLeaderboardEntry; pinned?: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-2.5 ${e.isYou ? "bg-accent-soft font-semibold text-accent" : ""} ${
        pinned ? "sticky bottom-0 border-t-2 border-accent shadow-card" : ""
      }`}
      aria-current={e.isYou ? "true" : undefined}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm tabular-nums ${MEDAL[e.rank - 1] ?? "text-muted"}`}>{e.rank}</span>
      <Avatar src={e.avatar} name="" size={34} />
      <span className="min-w-0 flex-1 truncate">
        {e.nickname}
        {e.isYou && <span className="ml-2 text-xs font-bold">YOU</span>}
      </span>
      <span className="font-semibold tabular-nums">{fmtInt(e.score)} pts</span>
    </li>
  );
}

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
        <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: "Leaderboard" }]} />
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
                  {data.note} {data.total > 0 && `${fmtInt(data.total)} fans.`}
                </p>
                {data.entries.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted">
                    {scope === "room" ? "No points in the room yet. Join a match and answer a call." : "No points yet. Answer a Call It! question to get on the board."}
                  </p>
                ) : (
                  <ol className="relative max-h-[70vh] divide-y divide-line overflow-y-auto">
                    {data.entries.map((e) => (
                      <Row key={e.playerId} e={e} />
                    ))}
                    {data.you && <Row e={data.you} pinned />}
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
