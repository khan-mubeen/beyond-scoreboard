import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { DateSelect, type FilterOption, FilterPills } from "../components/FilterPills";
import { HeroBanner } from "../components/HeroBanner";
import { Icon } from "../components/Icon";
import { Leaderboard } from "../components/Leaderboard";
import { LiigaTable } from "../components/LiigaTable";
import { LiveMatchCard } from "../components/LiveMatchCard";
import { ComingSoonMatchCard, MatchCard } from "../components/MatchCard";
import { SeasonStakesStrip } from "../components/SeasonStakesStrip";
import { ActionLink } from "../components/SectionCard";
import { SiteLayout } from "../components/SiteLayout";
import { useHomePage, useSiteChrome } from "../data";

type Filter = "all" | "live" | "results" | "upcoming";

function MatchSection({ title, children, viewAll }: { title: string; children: ReactNode; viewAll?: boolean }) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {viewAll && (
          <ActionLink href="#">
            View all <Icon name="arrowRight" className="size-4" />
          </ActionLink>
        )}
      </div>
      {children}
    </section>
  );
}

/** kaleva sports home (docs/design/01-home.png) */
export function SportsHome() {
  const chrome = useSiteChrome();
  const home = useHomePage();
  const [filter, setFilter] = useState<Filter>("all");

  const options: FilterOption<Filter>[] = [
    { id: "all", label: "All", icon: "grid" },
    { id: "live", label: `Live (${home.live.length})`, icon: "live" },
    { id: "results", label: "Results", icon: "calendar" },
    { id: "upcoming", label: "Upcoming", icon: "history" },
  ];
  const show = (f: Filter) => filter === "all" || filter === f;
  const otherLive = home.live.filter((m) => m.id !== home.featured.match.id);

  return (
    <SiteLayout chrome={chrome} sidebar={{ activeLinkId: "home", docked: true }}>
      <main className="flex min-w-0 flex-col gap-4 px-4 pt-5 pb-10 lg:px-6">
        <HeroBanner hero={home.hero} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills label="Show matches" options={options} active={filter} onChange={setFilter} />
          <DateSelect label={home.dateLabel} />
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
              {show("live") && <LiveMatchCard featured={home.featured} />}
              {filter === "all" && <SeasonStakesStrip title="Season stakes today" items={home.seasonStakesToday} />}
              {show("live") && (
                <MatchSection title={`Live Matches (${home.live.length})`} viewAll>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    {otherLive.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                    {home.comingSoon.map((c) => (
                      <ComingSoonMatchCard key={c.id} card={c} />
                    ))}
                  </div>
                </MatchSection>
              )}
              {show("upcoming") && (
                <MatchSection title="Upcoming Matches" viewAll>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.6fr]">
                    {home.upcoming.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </MatchSection>
              )}
              {show("results") && (
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
