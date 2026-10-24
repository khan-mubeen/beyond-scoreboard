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
import { SectionCard } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesSummary } from "../components/StakesSummary";
import { type TabItem, Tabs } from "../components/Tabs";
import { VideoModal, VideoPlayer } from "../components/VideoPlayer";
import { RoomLeaderboard } from "../components/WatchTogetherCard";
import { WhatItMeant } from "../components/WhatItMeant";
import { YourNight } from "../components/YourNight";
import { Icon } from "../components/Icon";
import { toast } from "../components/Toast";
import { AudioSummary } from "../components/AudioSummary";
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

/** a finished match page (docs/design/03-finished-match.png). onChange refetches the page */
export function FinishedMatch({ match, source, onChange }: { match: FinishedMatchDetail; source?: DataSource | null; onChange?: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const next = useRotationSummary(match, onChange);
  const lang = useMe().data?.language ?? "en";
  const [video, setVideo] = useState<VideoInfo | null>(null);

  const moments = (
    <EventList
      title="Key moments"
      events={match.events}
      note={match.eventsNote}
      onWatch={(e) => e.video && setVideo(e.video)}
      onViewAll={tab === "moments" ? undefined : () => setTab("moments")}
    />
  );
  const stats = <MatchStats stats={match.stats} source={match.statsSource} note={match.statsNote} />;
  const gotg = match.goalOfTheGame;
  const real = !isMockMatch(match.id);

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
            <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
              <VideoPlayer
                video={match.video}
                onPlay={() => setVideo(match.video)}
                className="aspect-video lg:aspect-auto lg:min-h-[380px]"
                overlay={<p className="absolute bottom-5 left-4 text-sm font-semibold">{match.video.title}</p>}
              />
              <WhatItMeant data={match.whatItMeant} />
            </div>

            {match.summary && <AudioSummary summary={match.summary} defaultLang={lang} />}

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
                    {gotg && <GoalOfTheGame goal={gotg} onWatch={() => setVideo(gotg.video)} />}
                    <div className="grid gap-4 lg:grid-cols-2">
                      {moments}
                      {stats}
                    </div>
                  </>
                )}
                {tab === "moments" && moments}
                {tab === "stats" && stats}
                {tab === "stakes" && <SeasonStakesCard stakes={match.seasonStakes} />}
                {tab === "discussion" && <LiveDiscussion title="Discussion" comments={match.discussion} readOnly />}
              </motion.div>
            </AnimatePresence>

            {match.nextUp && (
              <NextUpBanner
                next={match.nextUp}
                onToggle={real && match.nextUp.matchId ? (on) => setReminderApi(match.nextUp!.matchId!, on).then((r) => r.ok) : undefined}
              />
            )}
          </main>

          <aside aria-label="Your night and the room" className="flex min-w-0 flex-col gap-4">
            {match.yourNight && <YourNight night={match.yourNight} />}
            <SectionCard
              title={match.room.leaderboardTitle}
              action={<span className="text-xs text-muted">{match.room.leaderboardNote}</span>}
            >
              <RoomLeaderboard rows={match.room.leaderboard} />
              {match.room.footnote && (
                <p className="mt-3 rounded-lg border border-line px-3 py-2.5 text-xs text-muted">
                  {match.room.footnote}
                </p>
              )}
            </SectionCard>

          </aside>
        </div>
      </div>
      <VideoModal video={video} onClose={() => setVideo(null)} />
    </SiteLayout>
  );
}
