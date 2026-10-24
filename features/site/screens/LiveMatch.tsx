import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { LiveMatchDetail, VideoInfo } from "@/shared/types";
import { CallItCard } from "../components/CallItCard";
import { EventList } from "../components/EventList";
import { Icon } from "../components/Icon";
import { LiveDiscussion } from "../components/LiveDiscussion";
import { LiveBadge } from "../components/LiveMatchCard";
import { MatchStats } from "../components/MatchStats";
import { type BottomBarItem, MobileBottomBar } from "../components/MobileBottomBar";
import { ScoreHeader } from "../components/ScoreHeader";
import { SeasonStakesCard } from "../components/SeasonStakesCard";
import { ActionLink, SectionCard } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesSummary } from "../components/StakesSummary";
import { type TabItem, Tabs } from "../components/Tabs";
import { useCallIt } from "../components/use-call-it";
import { VideoModal, VideoPlayer } from "../components/VideoPlayer";
import { JoinRoomModal, WatchTogetherCard } from "../components/WatchTogetherCard";
import { useSiteChrome } from "../data";

type Tab = "overview" | "events" | "stats" | "lineups" | "stakes" | "call";
type Section = "call-it" | "discussion" | "season-stakes" | "watch-together";

const TABS: TabItem<Tab>[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "stats", label: "Statistics" },
  { id: "lineups", label: "Lineups" },
  { id: "stakes", label: "Season stakes" },
  { id: "call", label: "Call It!" },
];
const BAR: BottomBarItem<Section>[] = [
  { id: "call-it", label: "Call It!", icon: "sparkle" },
  { id: "discussion", label: "Discussion", icon: "discussion" },
  { id: "season-stakes", label: "Stakes", icon: "chart" },
  { id: "watch-together", label: "Watch Together", icon: "users" },
];

const scrollTo = (id: string) =>
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
const startsOnCallIt = () => typeof window !== "undefined" && window.location.hash === "#call-it";

/** a live match page (docs/design/02-live-match.png) */
export function LiveMatch({ match }: { match: LiveMatchDetail }) {
  const chrome = useSiteChrome();
  const call = useCallIt(match.callIt);
  const [tab, setTab] = useState<Tab>("overview");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(startsOnCallIt);

  // arriving from "Call It! · 2 open" on the home page
  useEffect(() => {
    if (startsOnCallIt()) scrollTo("call-it");
  }, []);

  function goTo(section: Section) {
    if (section === "call-it") {
      setSheetOpen(true);
      return scrollTo("call-it");
    }
    if (section === "season-stakes" && tab !== "overview" && tab !== "stakes") setTab("stakes");
    scrollTo(section);
  }

  const events = (
    <EventList
      title="Latest events"
      events={match.events}
      note={match.eventsNote}
      onWatch={(e) => setVideo(e.video)}
      onViewAll={tab === "events" ? undefined : () => setTab("events")}
    />
  );
  const stats = <MatchStats stats={match.stats} source={match.statsSource} note={match.statsNote} />;
  const stakes = <SeasonStakesCard stakes={match.seasonStakes} />;

  return (
    <SiteLayout chrome={chrome} sidebar={{ docked: false }}>
      <div className="px-4 pb-32 md:px-[30px] md:pb-12">
        <Breadcrumbs items={match.breadcrumbs} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ScoreHeader
            match={match.match}
            venue={match.venue}
            dateLabel={match.dateLabel}
            spectators={match.spectators}
          />
          <StakesSummary chips={match.stakesSummary} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_343px]">
          <main className="flex min-w-0 flex-col gap-4">
            <VideoPlayer
              video={match.video}
              onPlay={() => setVideo(match.video)}
              className="aspect-[4/3] sm:aspect-video md:aspect-[1020/278]"
              progress={0.6}
              overlay={
                <>
                  <p className="absolute top-4 left-4 flex items-center gap-3 text-sm font-semibold">
                    <LiveBadge />
                    {match.match.periodLabel} {match.match.clock}
                  </p>
                  <div className="absolute inset-x-4 bottom-6 flex flex-col gap-3 md:inset-x-5 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                      <h2 className="text-lg font-bold md:text-xl">What it means</h2>
                      <p className="text-sm md:text-[15px]">{match.whatItMeans}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("stakes");
                        scrollTo("live-tabs");
                      }}
                      className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
                    >
                      See season stakes <Icon name="arrowRight" className="size-4" />
                    </button>
                  </div>
                </>
              }
            />

            <Tabs label="Match sections" idPrefix="live" tabs={TABS} active={tab} onChange={setTab} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                id="live-panel"
                role="tabpanel"
                aria-labelledby={`live-tab-${tab}`}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {tab === "overview" && (
                  <>
                    {stakes}
                    <div className="grid gap-4 lg:grid-cols-2">
                      {events}
                      {stats}
                    </div>
                  </>
                )}
                {tab === "events" && events}
                {tab === "stats" && stats}
                {tab === "stakes" && stakes}
                {tab === "lineups" && (
                  <SectionCard title="Lineups">
                    <p className="text-sm text-muted">Lineups appear here when the match feed supplies them.</p>
                  </SectionCard>
                )}
                {tab === "call" && <CallItCard view={call} id="call-it" />}
              </motion.div>
            </AnimatePresence>
          </main>

          <aside aria-label="Discussion, calls and rooms" className="flex min-w-0 flex-col gap-4">
            <LiveDiscussion
              id="discussion"
              comments={match.discussion}
              action={
                <ActionLink href={match.guidelinesHref}>
                  Community guidelines <Icon name="arrowUpRight" className="size-3.5" />
                </ActionLink>
              }
            />
            {tab !== "call" && (
              <CallItCard view={call} id="call-it" sheet sheetOpen={sheetOpen} onSheetOpenChange={setSheetOpen} />
            )}
            <WatchTogetherCard id="watch-together" room={match.room} onJoin={() => setJoinOpen(true)} />
          </aside>
        </div>
      </div>

      <MobileBottomBar items={BAR} onSelect={goTo} />
      <VideoModal video={video} onClose={() => setVideo(null)} />
      <JoinRoomModal code={match.room.code} open={joinOpen} onClose={() => setJoinOpen(false)} />
    </SiteLayout>
  );
}
