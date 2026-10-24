import { useState } from "react";
import type { TeamNextGame } from "@/shared/types";
import { FollowButton } from "../components/Follow";
import { ZONE_TEXT } from "../components/LiigaTable";
import { Pill } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, ListSkeleton } from "../components/Skeleton";
import { TeamLogo } from "../components/TeamLogo";
import { teamHref } from "../format";
import { useTeams } from "../data";

/** ignore case and the dots (Kärpät = karpat) */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function NextGameLine({ next }: { next: TeamNextGame | null }) {
  if (!next) return <span className="text-muted">No games left</span>;
  return (
    <a href={`/match/${next.matchId}`} className="hover:underline">
      <span className="block">
        {next.home ? "vs" : "at"} {next.opponent.name} · {next.when}
      </span>
      {next.worth && <span className="block text-xs text-muted">{next.worth}</span>}
    </a>
  );
}

/** /teams: all 17 liiga teams, their place, playoff chance and next game; star to follow */
export function TeamsPage() {
  const { data, status, refresh } = useTeams();
  const [q, setQ] = useState("");
  const teams = (data?.teams ?? []).filter((t) => fold(t.team.name).includes(fold(q.trim())));

  return (
    <SiteLayout sidebar={{ activeLinkId: "teams", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: "Teams" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[36px] leading-tight font-bold">Liiga teams</h1>
            <p className="text-sm text-muted">{data?.note ?? "Standings now"} · follow your teams to see their games first.</p>
          </div>
          <label className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="sr-only">Search teams</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" className="w-full bg-transparent text-sm focus:outline-none" />
          </label>
        </div>
        <div className="mt-4">
          {!data ? (
            status === "error" ? (
              <DataUnavailable what="the teams" onRetry={refresh} />
            ) : (
              <ListSkeleton rows={10} title={false} />
            )
          ) : (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label="Teams">
              {teams.length === 0 && <li className="p-6 text-center text-muted">No team matches "{q}".</li>}
              {teams.map((t) => (
                <li key={t.team.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[2.25rem_minmax(0,1.2fr)_8rem_6rem_minmax(0,1.4fr)_auto]">
                  <span className={`text-lg font-bold tabular-nums ${ZONE_TEXT[t.zone]}`}>{t.rank}</span>
                  <a href={teamHref(t.team.id)} className="flex min-w-0 items-center gap-3 hover:underline">
                    <TeamLogo team={t.team} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{t.team.name}</span>
                      <span className="block text-xs text-muted tabular-nums">
                        {t.points} pts · {t.gamesPlayed} games
                      </span>
                    </span>
                  </a>
                  <span className="hidden md:block">
                    <Pill>{t.zoneLabel}</Pill>
                  </span>
                  <span className="hidden text-sm tabular-nums md:block">
                    <span className="font-semibold">{t.playoffChance}%</span> <span className="text-muted">playoffs</span>
                  </span>
                  <span className="col-span-3 col-start-2 text-sm md:col-span-1 md:col-start-auto">
                    <NextGameLine next={t.next} />
                  </span>
                  <span className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto">
                    <FollowButton teamId={t.team.id} name={t.team.name} compact />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
