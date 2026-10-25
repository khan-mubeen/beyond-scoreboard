import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import type { HomePage } from "@/shared/types";
import { SHOW_DATE_PICKER } from "../chrome";
import { DateSelect, type FilterOption, FilterPills } from "../components/FilterPills";
import { HeroBanner } from "../components/HeroBanner";
import { Leaderboard } from "../components/Leaderboard";
import { LiigaTable } from "../components/LiigaTable";
import { Icon } from "../components/Icon";
import { useLiveNow } from "../components/live-now";
import { LiveMatchCard } from "../components/LiveMatchCard";
import { LiveNowCard } from "../components/LiveNowCard";
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

/** an empty filter that leads somewhere: a short message beside the Live now / Next up card */
function EmptyFilter({ title, text, links }: { title: string; text: string; links: { label: string; onClick: () => void }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="empty-filter">
      <section className="flex flex-col justify-center gap-2 rounded-card border border-line bg-surface p-5 shadow-card">
        <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted">
          <Icon name="calendar" className="size-5" />
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
        <p className="mt-1 flex flex-wrap gap-3">
          {links.map((l) => (
            <button key={l.label} type="button" onClick={l.onClick} className="text-sm font-semibold text-accent hover:underline">
              {l.label} →
            </button>
          ))}
        </p>
      </section>
      <LiveNowCard />
    </div>
  );
}

/** kaleva sports home (docs/design/01-home.png) */
export function SportsHome() {
  const { data: home, status, source, refresh } = useHomePage();
  // the same source as the header ticker and the Live now card: lobby, live and final agree
  const now = useLiveNow();
  // the header's Live and Results open /sports?show=live|results
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const sidebar = { activeLinkId: "home", docked: true };

  if (!home) {
    return <SiteLayout sidebar={sidebar}>{status === "error" ? <DataUnavailable what="the sports home" onRetry={refresh} /> : <HomeSkeleton />}</SiteLayout>;
  }

  // the rotation's match counts as live only in its live phase, as the ticker says; other live games from the page
  const rotationId = now && now.phase !== "next" ? now.t.matchId : null;
  const liveGames = home.live.filter((m) => m.id !== rotationId);
  const liveCount = liveGames.length + (now?.phase === "live" ? 1 : 0);
  const options: FilterOption<Filter>[] = [
    { id: "all", label: "All", icon: "grid" },
    { id: "live", label: `Live (${liveCount})`, icon: "live" },
    { id: "results", label: "Results", icon: "calendar" },
    { id: "upcoming", label: "Upcoming", icon: "history" },
  ];
  const show = (f: Filter) => filter === "all" || filter === f;
  const featured = home.featured;
  const featuredLive = featured ? (featured.match.id === rotationId ? now?.phase === "live" : featured.match.status === "live") : false;
  const showFeatured = featured && (filter === "all" || (filter === "live" && featuredLive));
  const otherLive = liveGames.filter((m) => m.id !== featured?.match.id);

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
              {filter === "live" && liveCount === 0 && (
                <>
                  <EmptyFilter
                    title="No games live right now"
                    text="Live games show here with their score and Your Call! questions. Here's what's on next."
                    links={[
                      { label: "Upcoming games", onClick: () => setFilter("upcoming") },
                      { label: "All results", onClick: () => setFilter("results") },
                    ]}
                  />
                  {home.recent.length > 0 && (
                    <MatchSection title="Latest results">
                      <div className="grid gap-3">
                        {home.recent.slice(0, 3).map((m) => (
                          <MatchCard key={m.id} match={m} />
                        ))}
                      </div>
                    </MatchSection>
                  )}
                </>
              )}
              {filter === "results" && home.recent.length === 0 && (
                <EmptyFilter title="No results yet" text="Finished games show here with what they meant for the table." links={[{ label: "Upcoming games", onClick: () => setFilter("upcoming") }]} />
              )}
              {filter === "upcoming" && home.upcoming.length === 0 && (
                <>
                  <EmptyFilter title="No games scheduled" text="New fixtures show here as soon as the league publishes them." links={[{ label: "Latest results", onClick: () => setFilter("results") }]} />
                  {home.recent.length > 0 && (
                    <MatchSection title="Latest results">
                      <div className="grid gap-3">
                        {home.recent.slice(0, 3).map((m) => (
                          <MatchCard key={m.id} match={m} />
                        ))}
                      </div>
                    </MatchSection>
                  )}
                </>
              )}
              {show("live") && otherLive.length > 0 && (
                <MatchSection title={`Live Matches (${liveCount})`}>
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
                <MatchSection title={filter === "results" ? "Results" : "Recent Matches"}>
                  <div className={`grid gap-3 ${filter === "results" ? "lg:grid-cols-2" : ""}`}>
                    {(filter === "results" ? home.recent : home.recent.slice(0, 3)).map((m) => (
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
