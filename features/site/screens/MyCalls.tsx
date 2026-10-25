import { useState } from "react";
import { CallsList } from "../components/Follow";
import { Icon, type IconName } from "../components/Icon";
import { useLiveNow } from "../components/live-now";
import { LiveNowCard } from "../components/LiveNowCard";
import { ActionLink, SectionCard } from "../components/SectionCard";
import { SitePage } from "../components/SitePage";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { useMyCalls, useProfile } from "../data";
import { NAMES } from "@/shared/copy/names";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "users", title: "Join a live match", text: "Open the game that's on: you're in its Watch Party." },
  {
    icon: "target",
    title: "Answer before the lock",
    text: "A question opens in play. Pick before the timer runs out.",
  },
  {
    icon: "check",
    title: "Get it right, get points",
    text: "+20 for a right call. Predictions +30, party trivia +10.",
  },
];

/** three steps and the fixed points */
function HowItWorks() {
  return (
    <SectionCard title={`How ${NAMES.call} works`}>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon name={s.icon} className="size-4.5" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">
                {i + 1}. {s.title}
              </span>
              <span className="block text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

/** answered, right share and best streak, from the profile */
function YourStats() {
  const stats = useProfile().data?.stats;
  return (
    <SectionCard title="Your stats">
      <dl className="grid grid-cols-3 gap-2 text-center" data-testid="calls-stats">
        {[
          ["Answered", stats ? `${stats.answered}` : "–"],
          ["Right", stats ? `${stats.correctPct}%` : "–"],
          ["Best streak", stats ? `${stats.bestStreak}` : "–"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-2 px-2 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function CallsAside() {
  return (
    <>
      <LiveNowCard />
      <HowItWorks />
      <YourStats />
    </>
  );
}

/** an empty list that leads somewhere: the game on now, else the next one */
function EmptyCta({ text }: { text: string }) {
  const now = useLiveNow();
  const t = now?.t;
  // just ended: the next match is the one to go to
  const target = now?.phase === "summary" ? (t?.following ?? null) : t;
  const title = target ? `${target.home.name} – ${target.away.name}` : null;
  const cta =
    !now || !target
      ? null
      : now.phase === "live"
        ? `${title} is live: answer your first question →`
        : now.phase === "lobby"
          ? `${title} starts in a moment: be there for the first question →`
          : `Next up: ${title}${target.when ? ` · ${target.when}` : ""}. Set a reminder →`;
  return (
    <div className="flex flex-col items-center gap-3" data-testid="calls-empty">
      <p>{text}</p>
      {cta && target && (
        <a
          href={`/match/${target.matchId}`}
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          {cta}
        </a>
      )}
    </div>
  );
}

/** /calls: open calls first, then the latest results; the aside: what's on, how it works, your stats */
export function MyCalls() {
  const { data, status, refresh } = useMyCalls("recent");
  const open = data?.calls.filter((c) => c.status === "open" || c.status === "locked") ?? [];
  const done = data?.calls.filter((c) => c.status !== "open" && c.status !== "locked") ?? [];
  return (
    <SitePage
      activeLinkId="calls"
      crumbs={[{ label: "Sports", href: "/sports" }, { label: NAMES.call }]}
      title={NAMES.call}
      intro="Your open questions and your latest results."
      aside={<CallsAside />}
      asideLabel={`${NAMES.call}: what's on and your stats`}
    >
      {!data ? (
        status === "error" ? (
          <DataUnavailable what="your calls" onRetry={refresh} />
        ) : (
          <ListSkeleton rows={5} />
        )
      ) : (
        <>
          {/* the titles sit inside the cards: the aside's top lines up with the first card */}
          <SectionCard title="Waiting for the answer" bodyClassName="">
            <CallsList bare calls={open} empty={<EmptyCta text="No open questions right now." />} />
          </SectionCard>
          <SectionCard
            title="Latest results"
            bodyClassName=""
            action={<ActionLink href="/calls/history">Full history</ActionLink>}
          >
            <CallsList bare calls={done} empty="Your results show up here once your calls are decided." />
          </SectionCard>
        </>
      )}
    </SitePage>
  );
}

/** /calls/history: every call with totals and the match filter beside them; the same aside */
export function CallHistory() {
  const [match, setMatch] = useState("");
  const { data, status, refresh } = useMyCalls("history", match || undefined);
  // the filter keeps every match from the unfiltered list
  const all = useMyCalls("history").data;
  const matches = all?.matches ?? data?.matches ?? [];
  return (
    <SitePage
      activeLinkId="history"
      crumbs={[{ label: "Sports", href: "/sports" }, { label: NAMES.call, href: "/calls" }, { label: "History" }]}
      title={`${NAMES.call} history`}
      aside={<CallsAside />}
      asideLabel={`${NAMES.call}: what's on and your stats`}
    >
      {!data ? (
        status === "error" ? (
          <DataUnavailable what="your calls" onRetry={refresh} />
        ) : (
          <ListSkeleton rows={6} />
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
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
            <label className="flex flex-col justify-center gap-1 rounded-card border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted shadow-card">
              Match
              <select
                value={match}
                onChange={(e) => setMatch(e.target.value)}
                className="min-w-48 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal text-ink"
              >
                <option value="">All matches</option>
                {matches.map((m) => (
                  <option key={m.matchId} value={m.matchId}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CallsList calls={data.calls} empty={<EmptyCta text="No calls yet." />} />
        </>
      )}
    </SitePage>
  );
}
