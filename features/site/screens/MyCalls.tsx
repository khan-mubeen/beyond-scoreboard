import { useState } from "react";
import { CallsList } from "../components/Follow";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { useMyCalls } from "../data";

/** /calls: open calls first, then the latest results */
export function MyCalls() {
  const { data, status, refresh } = useMyCalls("recent");
  const open = data?.calls.filter((c) => c.status === "open" || c.status === "locked") ?? [];
  const done = data?.calls.filter((c) => c.status !== "open" && c.status !== "locked") ?? [];
  return (
    <SiteLayout sidebar={{ activeLinkId: "calls", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: "My Calls" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">My Calls</h1>
        {!data ? (
          status === "error" ? (
            <DataUnavailable what="your calls" onRetry={refresh} />
          ) : (
            <ListSkeleton rows={5} />
          )
        ) : (
          <div className="mt-4 flex max-w-3xl flex-col gap-6">
            <section aria-labelledby="open-calls">
              <h2 id="open-calls" className="mb-2 text-lg font-semibold">
                Waiting for the answer
              </h2>
              <CallsList calls={open} empty="No open calls. Join a live match to make one." />
            </section>
            <section aria-labelledby="recent-calls">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-calls" className="text-lg font-semibold">
                  Latest results
                </h2>
                <a href="/calls/history" className="text-sm font-semibold text-accent hover:underline">
                  Full history
                </a>
              </div>
              <CallsList calls={done} empty="Your results show up here once your calls are decided." />
            </section>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}

/** /calls/history: every call, filter by match, with totals */
export function CallHistory() {
  const [match, setMatch] = useState("");
  const { data, status, refresh } = useMyCalls("history", match || undefined);
  // the filter keeps every match from the unfiltered list
  const all = useMyCalls("history").data;
  const matches = all?.matches ?? data?.matches ?? [];
  return (
    <SiteLayout sidebar={{ activeLinkId: "history", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: "My Calls", href: "/calls" }, { label: "History" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-serif text-[36px] leading-tight font-bold">Call history</h1>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Match
            <select value={match} onChange={(e) => setMatch(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 font-normal">
              <option value="">All matches</option>
              {matches.map((m) => (
                <option key={m.matchId} value={m.matchId}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!data ? (
          status === "error" ? (
            <DataUnavailable what="your calls" onRetry={refresh} />
          ) : (
            <ListSkeleton rows={6} />
          )
        ) : (
          <div className="mt-4 flex max-w-3xl flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Answered", data.totals.answered],
                ["Won", data.totals.won],
                ["Points", data.totals.points],
              ].map(([label, value]) => (
                <div key={label} className="rounded-card border border-line bg-surface p-3 shadow-card">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <CallsList calls={data.calls} empty="No calls yet. Join a live match and make your first call." />
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
