import { useState } from "react";
import type { LeaderboardPageData, LeaderboardScope, SiteLeaderboardEntry } from "@/shared/types";
import { fmtInt } from "../format";
import { SitePage } from "../components/SitePage";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { type TabItem, Tabs } from "../components/Tabs";
import { BoardRow, Breakdown } from "../components/Leaderboard";
import { Icon } from "../components/Icon";
import { SectionCard } from "../components/SectionCard";
import { useMedia } from "../components/use-media";
import { useLeaderboard } from "../data";
import { NAMES } from "@/shared/copy/names";

const TABS: TabItem<LeaderboardScope>[] = [
  { id: "weekly", label: "Weekly" },
  { id: "season", label: "Season" },
  { id: "room", label: "Watch Party" },
];

const EARN = [
  { icon: "target" as const, label: NAMES.call, points: "+20", note: "a right answer" },
  { icon: "chart" as const, label: "Predictions", points: "+30", note: "the result you predicted" },
  { icon: "sparkle" as const, label: "Trivia", points: "+10", note: "a right answer in the party" },
];

const initialScope = (): LeaderboardScope => {
  const s = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("scope");
  return s === "season" || s === "room" ? s : "weekly";
};

/** your place: rank, points, and how far the next fan up is */
function YourPosition({ data }: { data: LeaderboardPageData }) {
  const all = data.you ? [...data.entries, data.you] : data.entries;
  const me = all.find((e) => e.isYou);
  if (!me) return <p className="text-sm text-muted">Answer a {NAMES.call} question to get on this board.</p>;
  const above = all.filter((e) => e.score > me.score).sort((a, b) => a.score - b.score)[0];
  return (
    <div className="flex items-end justify-between gap-3" data-testid="your-position">
      <div>
        <p className="text-4xl font-black tabular-nums">#{me.rank}</p>
        <p className="text-sm text-muted">of {fmtInt(data.total)}</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold tabular-nums">{fmtInt(me.score)} pts</p>
        <p className="text-sm text-muted">
          {above ? `${fmtInt(above.score - me.score)} pts behind ${above.nickname}` : "You lead"}
        </p>
      </div>
    </div>
  );
}

/**
 * /leaderboard: weekly (mon-sun, finnish time), season, and the watch party on now. from 1280 px:
 * the list on the left, and beside it (sticky) your position, the selected fan's breakdown and how
 * to earn points; narrower, one column and rows open their breakdown inline
 */
export function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>(initialScope);
  const { data, status, refresh } = useLeaderboard(scope);
  const wide = useMedia("(min-width: 1280px)");
  const [picked, setPicked] = useState<SiteLeaderboardEntry | null>(null);
  const everyone = data ? (data.you ? [...data.entries, data.you] : data.entries) : [];
  // the picked fan on this board, else you, else the leader
  const selected =
    everyone.find((e) => e.playerId === picked?.playerId) ?? everyone.find((e) => e.isYou) ?? everyone[0] ?? null;
  const select = wide ? (e: SiteLeaderboardEntry) => setPicked(e) : undefined;

  return (
    <SitePage
      activeLinkId="leaderboard"
      crumbs={[{ label: "Sports", href: "/sports" }, { label: "Leaderboard" }]}
      title="Leaderboard"
      toolbar={<Tabs label="Leaderboards" idPrefix="board" tabs={TABS} active={scope} onChange={setScope} />}
      asideLabel="Your position and points"
      aside={
        <>
          {data && (
            <SectionCard title="Your position">
              <YourPosition data={data} />
            </SectionCard>
          )}
          {wide && selected && (
            <SectionCard
              title={selected.isYou ? "Your points" : `${selected.nickname}'s points`}
              bodyClassName="py-3"
              id="board-breakdown"
            >
              <Breakdown scope={scope} userId={selected.playerId} wide={false} />
            </SectionCard>
          )}
          <SectionCard title="How to earn points">
            <ul className="flex flex-col gap-3">
              {EARN.map((x) => (
                <li key={x.label} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
                    <Icon name={x.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{x.label}</span>
                    <span className="block text-xs text-muted">{x.note}</span>
                  </span>
                  <span className="font-bold tabular-nums">{x.points}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      }
    >
      <div id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${scope}`}>
        {!data ? (
          status === "error" ? (
            <DataUnavailable what="the leaderboard" onRetry={refresh} />
          ) : (
            <ListSkeleton rows={10} title={false} />
          )
        ) : (
          <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <p className="border-b border-line px-4 py-3 text-sm text-muted">
              {data.note} {data.total > 0 && `${fmtInt(data.total)} ${data.total === 1 ? "fan" : "fans"}.`}{" "}
              {wide
                ? "Select a fan to see where their points came from."
                : "Tap a fan to see where their points came from."}
            </p>
            {data.entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-muted">
                {scope === "room"
                  ? "No points in the party yet. Join a match and answer a question."
                  : `No points yet. Answer a ${NAMES.call} question to get on the board.`}
              </p>
            ) : (
              <ol className="relative max-h-[70vh] divide-y divide-line overflow-y-auto" data-testid="board-list">
                {data.entries.map((e) => (
                  <BoardRow
                    key={e.playerId}
                    e={e}
                    max={data.entries[0]?.score ?? 1}
                    scope={scope}
                    onSelect={select}
                    selected={!!select && selected?.playerId === e.playerId}
                  />
                ))}
                {data.you && (
                  <BoardRow
                    e={data.you}
                    max={data.entries[0]?.score ?? 1}
                    scope={scope}
                    pinned
                    onSelect={select}
                    selected={!!select && selected?.playerId === data.you.playerId}
                  />
                )}
              </ol>
            )}
          </section>
        )}
      </div>
    </SitePage>
  );
}
