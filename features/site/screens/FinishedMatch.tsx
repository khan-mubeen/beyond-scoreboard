import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { FinishedMatchDetail, VideoInfo } from "@/shared/types";
import { EventList } from "../components/EventList";
import { GoalOfTheGame } from "../components/GoalOfTheGame";
import { LiveDiscussion } from "../components/LiveDiscussion";
import { MatchStats } from "../components/MatchStats";
import { NextUpBanner } from "../components/NextUpBanner";
import { ScoreHeader } from "../components/ScoreHeader";
import { SeasonStakesCard } from "../components/SeasonStakesCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesSummary } from "../components/StakesSummary";
import { type TabItem, Tabs } from "../components/Tabs";
import { VideoModal } from "../components/VideoPlayer";
import { FinalPartyBoard } from "../components/WatchTogetherCard";
import { WhatItMeant } from "../components/WhatItMeant";
import { YourNight } from "../components/YourNight";
import { Icon } from "../components/Icon";
import { toast } from "../components/Toast";
import { AudioSummary } from "../components/AudioSummary";
import { GameChart, NextTimePanel, PlayerOfGame, SeasonImpact } from "../components/FinishedGraphics";
import { fmtCountdown, isMockMatch, setReminderApi, useMe, useRotation, useServerNow } from "../data";
import type { DataSource } from "@/shared/types";

type Tab = "overview" | "moments" | "stats" | "stakes" | "discussion";

const TABS: TabItem<Tab>[] = [
  { id: "overview", label: "Overview" },
  { id: "moments", label: "Key moments" },
  { id: "stats", label: "Statistics" },
  { id: "stakes", label: "Season stakes" },
  { id: "discussion", label: "Discussion" },
];

/**
 * the demo rotation's summary phase: "next match starts in 9:12", a toast when the next lobby
 * opens, and the page refetches once this match's summary is over (it then shows as upcoming:
 * outside its own turn, a rotation match shows no result)
 */
function useRotationSummary(match: FinishedMatchDetail, onChange?: () => void) {
  const isRotation = !!match.rotation;
  const info = useRotation(isRotation).data;
  const now = useServerNow(1000);
  const onAir = info?.current.matchId === match.id && info.current.phase === "summary";
  const over = isRotation && !!info && !onAir;
  useEffect(() => {
    if (over) onChange?.();
  }, [over, onChange]);
  const toasted = useRef(false);
  useEffect(() => {
    if (!over || toasted.current || !info || info.current.phase !== "lobby") return;
    toasted.current = true;
    toast("Next match is starting — join now", { action: { label: "Join", href: `/match/${info.current.matchId}` }, ms: 8000 });
  }, [over, info]);
  return onAir && info ? { title: info.next.title, matchId: info.next.matchId, left: fmtCountdown(info.next.startsAt - now) } : null;
}

/** key moments shown on the overview; "View all" opens the full list */
const MOMENTS = 8;

/**
 * a finished match page. on top the score and both chances; then the goal of the game, what it
 * meant and the final party board in one row; below that everything spans the width (the
 * 60-second summary, the tabs, the game chart), and the overview ends in two columns: key moments
 * | player of the game + match statistics (one column below 1280 px). onChange refetches the page
 */
export function FinishedMatch({ match, source, onChange }: { match: FinishedMatchDetail; source?: DataSource | null; onChange?: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const next = useRotationSummary(match, onChange);
  const me = useMe().data ?? null;
  const lang = me?.language ?? "en";
  const [video, setVideo] = useState<VideoInfo | null>(null);

  const real = !isMockMatch(match.id);
  const insights = match.insights ?? null;
  const { home, away } = match.match;
  const moments = (all: boolean) => (
    <EventList
      title="Key moments"
      events={all ? match.events : match.events.slice(0, MOMENTS)}
      note={match.eventsNote}
      onWatch={(e) => e.video && setVideo(e.video)}
      onViewAll={!all && match.events.length > MOMENTS ? () => setTab("moments") : undefined}
    />
  );
  const stats = <MatchStats stats={match.stats} source={match.statsSource} note={match.statsNote} home={home} away={away} periods={insights?.periods} />;

  return (
    <SiteLayout sidebar={{ docked: false }} source={source}>
      {next && (
        <a href={`/match/${next.matchId}`} className="sticky top-16 z-30 flex items-center justify-center gap-2 bg-dark px-4 py-2 text-sm font-semibold text-dark-ink">
          Next match: {next.title} starts in <span className="tabular-nums">{next.left}</span>
          <Icon name="arrowRight" className="size-4" />
        </a>
      )}
      <div className="px-4 pb-12 md:px-[30px]">
        <Breadcrumbs items={match.breadcrumbs} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={match.spectators} />
          <StakesSummary chips={match.stakesSummary} />
        </div>

        {/* what this means, and why to watch the next one */}
        {insights && (
          <div className={`mt-4 grid gap-4 ${insights.nextTime ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" : ""}`}>
            <SeasonImpact insights={insights} />
            {insights.nextTime && <NextTimePanel next={insights.nextTime} focus={insights.focus} />}
          </div>
        )}

        {/* goal of the game | what it meant | the final party board, one row of equal height */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <GoalOfTheGame goal={match.goalOfTheGame} video={match.video} onWatch={setVideo} />
          <WhatItMeant data={match.whatItMeant} matchId={match.id} />
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
            {match.yourNight && <YourNight night={match.yourNight} />}
            <div className="flex-1">
              <FinalPartyBoard room={match.room} matchId={real ? match.id : null} me={me} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-w-0 flex-col gap-4">
          {match.summary && <AudioSummary summary={match.summary} defaultLang={lang} matchId={match.id} />}

          <Tabs label="Match sections" idPrefix="final" tabs={TABS} active={tab} onChange={setTab} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              id="final-panel"
              role="tabpanel"
              aria-labelledby={`final-tab-${tab}`}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {tab === "overview" && (
                <>
                  {insights && <GameChart insights={insights} home={home} away={away} onWatch={setVideo} />}
                  <div className="grid items-start gap-4 xl:grid-cols-2">
                    {moments(false)}
                    <div className="flex min-w-0 flex-col gap-4">
                      {insights?.playerOfGame && <PlayerOfGame player={insights.playerOfGame} />}
                      {stats}
                    </div>
                  </div>
                </>
              )}
              {tab === "moments" && moments(true)}
              {tab === "stats" && stats}
              {tab === "stakes" && <SeasonStakesCard stakes={match.seasonStakes} />}
              {tab === "discussion" && <LiveDiscussion title="Discussion" comments={match.discussion} readOnly />}
            </motion.div>
          </AnimatePresence>

          {match.nextUp && !insights?.nextTime && (
            <NextUpBanner
              next={match.nextUp}
              onToggle={real && match.nextUp.matchId ? (on) => setReminderApi(match.nextUp!.matchId!, on).then((r) => r.ok) : undefined}
            />
          )}
        </div>
      </div>
      <VideoModal video={video} onClose={() => setVideo(null)} />
    </SiteLayout>
  );
}
