import type { FormResult } from "@/shared/types";
import { FollowButton } from "../components/Follow";
import { ZONE_TEXT } from "../components/LiigaTable";
import { Pill, SectionCard } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { TeamLogo } from "../components/TeamLogo";
import { ordinal } from "../format";
import { useTeam } from "../data";
import { NextGameLine } from "./TeamsPage";
import { Placeholder } from "./Placeholder";

const RESULT: Record<FormResult, { label: string; cls: string }> = {
  W: { label: "Win", cls: "bg-good-soft text-good" },
  OTW: { label: "Overtime win", cls: "bg-good-soft text-good" },
  OTL: { label: "Overtime loss", cls: "bg-surface-2 text-ink" },
  L: { label: "Loss", cls: "bg-live-soft text-bad" },
};

/** /teams/:slug: place, chances, the last five results and the next three games */
export function TeamPage({ slug }: { slug: string }) {
  const { data, status, refresh } = useTeam(slug);
  if (status === "notfound") return <Placeholder title="Team not found" activeLinkId="teams" />;
  const t = data?.item;
  return (
    <SiteLayout sidebar={{ activeLinkId: "teams", docked: true }}>
      <main className="px-4 pb-12 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Teams", href: "/teams" }, { label: t?.team.name ?? "Team" }]} />
        {!data || !t ? (
          status === "error" ? (
            <DataUnavailable what="this team" onRetry={refresh} />
          ) : (
            <PageSkeleton cards={3} />
          )
        ) : (
          <div className="flex max-w-5xl flex-col gap-4">
            <section className="flex flex-wrap items-center gap-5 rounded-card border border-line bg-surface p-5 shadow-card">
              <TeamLogo team={t.team} size={88} />
              <div className="min-w-0 flex-1">
                <h1 className="font-serif text-[36px] leading-tight font-bold">{t.team.name}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className={`font-semibold ${ZONE_TEXT[t.zone]}`}>{ordinal(t.rank)} in the Liiga</span>
                  <Pill>{t.zoneLabel}</Pill>
                  <span className="text-muted tabular-nums">
                    {t.points} pts · {t.gamesPlayed} games
                  </span>
                </p>
              </div>
              <FollowButton teamId={t.team.id} name={t.team.name} />
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Playoff chance", data.item.playoffChance],
                ["Top 4 chance", data.top4Chance],
                ["Relegation chance", data.relegationChance],
              ].map(([label, value]) => (
                <section key={label} className="rounded-card border border-line bg-surface p-5 shadow-card">
                  <p className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</p>
                  <p className="mt-2 text-[40px] leading-none font-bold tabular-nums">{value}%</p>
                </section>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Last five">
                {data.last5.length === 0 ? (
                  <p className="text-muted">No games played yet.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-line">
                    {data.last5.map((g) => (
                      <li key={g.matchId}>
                        <a href={`/match/${g.matchId}`} className="flex items-center gap-3 py-2.5 hover:underline">
                          <span className={`w-28 shrink-0 rounded-md px-2 py-0.5 text-center text-xs font-bold ${RESULT[g.result].cls}`}>{RESULT[g.result].label}</span>
                          <span className="flex-1">
                            {g.home ? "vs" : "at"} {g.opponent.name}
                          </span>
                          <span className="font-semibold tabular-nums">{g.score}</span>
                          <span className="w-24 text-right text-xs text-muted">{g.date}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </SectionCard>
              <SectionCard title="Next three">
                {data.next3.length === 0 ? (
                  <p className="text-muted">No games left this season.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-line">
                    {data.next3.map((n) => (
                      <li key={n.matchId} className="py-2.5 text-sm">
                        <NextGameLine next={n} />
                      </li>
                    ))}
                  </ol>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
