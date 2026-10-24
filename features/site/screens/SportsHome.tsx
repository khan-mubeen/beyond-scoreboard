import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import type { HomePage } from "@/shared/types";
import { SHOW_DATE_PICKER } from "../chrome";
import { DateSelect, type FilterOption, FilterPills } from "../components/FilterPills";
import { HeroBanner } from "../components/HeroBanner";
import { Leaderboard } from "../components/Leaderboard";
import { LiigaTable } from "../components/LiigaTable";
import { LiveMatchCard } from "../components/LiveMatchCard";
import { PickTeamPrompt } from "../components/PickTeamPrompt";
import { MatchCard } from "../components/MatchCard";
import { SeasonStakesStrip } from "../components/SeasonStakesStrip";
import { SiteLayout } from "../components/SiteLayout";
import { DataUnavailable, HomeSkeleton } from "../components/Skeleton";
import { TeamLogo } from "../components/TeamLogo";
import { useHomePage } from "../data";
import { teamHref } from "../format";

type Filter = "all" | "live" | "results" | "upcoming";

const initialFilter = (): Filter => {
  const show = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("show");
  return show === "live" || show === "results" || show === "upcoming" ? show : "all";
};

function MatchSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2.5 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** the fan's followed teams and what each plays next */
function YourTeams({ teams }: { teams: HomePage["yourTeams"] }) {
  if (!teams.length) return null;
  return (
    <section aria-label="Your teams" className="flex gap-3 overflow-x-auto pb-1">
      {teams.map((t) => (
        <a
          key={t.team.id}
          href={t.next ? `/match/${t.next.matchId}` : teamHref(t.team.id)}
          className="flex min-w-[15rem] items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card hover:border-accent"
        >
          <TeamLogo team={t.team} size={36} />
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">{t.team.name}</span>
            <span className="block truncate text-muted">{t.next ? `${t.next.home ? "vs" : "at"} ${t.next.opponent.name} · ${t.next.when}` : "No games left"}</span>
          </span>
        </a>
      ))}
    </section>
  );
}

/** kaleva sports home (docs/design/01-home.png) */
export function SportsHome() {
  const { data: home, status, source, refresh } = useHomePage();
  // the header's Live and Results open /sports?show=live|results
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const sidebar = { activeLinkId: "home", docked: true };

  if (!home) {
    return <SiteLayout sidebar={sidebar}>{status === "error" ? <DataUnavailable what="the sports home" onRetry={refresh} /> : <HomeSkeleton />}</SiteLayout>;
  }

  const options: FilterOption<Filter>[] = [
    { id: "all", label: "All", icon: "grid" },
    { id: "live", label: `Live (${home.live.length})`, icon: "live" },
    { id: "results", label: "Results", icon: "calendar" },
    { id: "upcoming", label: "Upcoming", icon: "history" },
  ];
  const show = (f: Filter) => filter === "all" || filter === f;
  const featured = home.featured;
  const showFeatured = featured && (filter === "all" || (filter === "live" && featured.match.status === "live"));
  const otherLive = home.live.filter((m) => m.id !== featured?.match.id);

  return (
    <SiteLayout sidebar={sidebar} source={source}>
      <main className="flex min-w-0 flex-col gap-4 px-4 pt-5 pb-10 lg:px-6">
        <HeroBanner hero={home.hero} />
        <YourTeams teams={home.yourTeams ?? []} />
        <PickTeamPrompt />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills label="Show matches" options={options} active={filter} onChange={setFilter} />
          {SHOW_DATE_PICKER && <DateSelect label={home.dateLabel} />}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={filter}
              className="flex min-w-0 flex-col gap-5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {showFeatured && <LiveMatchCard featured={featured} />}
              {filter === "all" && home.seasonStakesToday.length > 0 && <SeasonStakesStrip title="Season stakes today" items={home.seasonStakesToday} />}
              {show("live") && (otherLive.length > 0 || filter === "live") && (
                <MatchSection title={`Live Matches (${home.live.length})`}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    {otherLive.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </MatchSection>
              )}
              {show("upcoming") && home.upcoming.length > 0 && (
                <MatchSection title="Upcoming Matches">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.6fr]">
                    {home.upcoming.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </MatchSection>
              )}
              {show("results") && home.recent.length > 0 && (
                <MatchSection title="Recent Matches">
                  <div className="flex flex-col gap-3">
                    {home.recent.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </MatchSection>
              )}
            </motion.div>
          </AnimatePresence>

          <aside aria-label="Leaderboard and table" className="flex min-w-0 flex-col gap-4">
            <Leaderboard {...home.leaderboard} />
            <LiigaTable table={home.table} />
          </aside>
        </div>
      </main>
    </SiteLayout>
  );
}
