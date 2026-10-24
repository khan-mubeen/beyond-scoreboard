import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DataSource, LiveMatchDetail, LiveRotation, VideoInfo } from "@/shared/types";
import { CallBanner, CallItCard } from "../components/CallItCard";
import { EventList } from "../components/EventList";
import { HighlightPlayer } from "../components/HighlightPlayer";
import { HostBar } from "../components/HostBar";
import { LobbyStage } from "../components/LobbyStage";
import { Icon } from "../components/Icon";
import { Lineups } from "../components/Lineups";
import { LiveDiscussion } from "../components/LiveDiscussion";
import { LiveBadge } from "../components/LiveMatchCard";
import { MatchStats } from "../components/MatchStats";
import { type BottomBarItem, MobileBottomBar } from "../components/MobileBottomBar";
import { NicknamePrompt } from "../components/NicknamePrompt";
import { ScoreHeader } from "../components/ScoreHeader";
import { SeasonStakesCard } from "../components/SeasonStakesCard";
import { ActionLink } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesSummary } from "../components/StakesSummary";
import { type TabItem, Tabs } from "../components/Tabs";
import { useCallIt } from "../components/use-call-it";
import { useLiveMatch } from "../components/use-live-match";
import { VideoModal, VideoPlayer } from "../components/VideoPlayer";
import { JoinRoomModal, WatchTogetherCard } from "../components/WatchTogetherCard";
import { fmtCountdown, isMockMatch, joinMatchApi, postCommentApi, roomFromUrl, useMe, useServerNow } from "../data";

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

const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
// the call it! sheet starts open when arriving from "Call It! · 2 open" or a room qr code
const startsOnCallIt = () =>
  typeof window !== "undefined" && (window.location.hash === "#call-it" || new URLSearchParams(window.location.search).has("room"));
const hostMode = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("host");
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/**
 * a demo rotation match: the lobby (qr, countdown), its highlight in step with the server while
 * live, or when it comes up next. "what it means" sits under the video instead of over it
 */
function RotationStage({ match, rotation, onSeeStakes }: { match: LiveMatchDetail; rotation: LiveRotation; onSeeStakes: () => void }) {
  const now = useServerNow(1000);
  if (rotation.phase === "lobby") return <LobbyStage match={match.match} rotation={rotation} roomCode={match.room.code} />;
  const live = rotation.phase === "live";
  return (
    <>
      <HighlightPlayer
        video={match.highlight ?? null}
        rotation={rotation}
        className="aspect-video"
        overlay={
          <p className="absolute top-4 left-4 flex items-center gap-3 text-sm font-semibold">
            {live ? <LiveBadge /> : <span className="rounded-md bg-dark/70 px-2.5 py-1 text-xs font-bold">Starts in {fmtCountdown(rotation.phaseEndsAt - now)}</span>}
            {live && <span className="rounded-md bg-dark/70 px-2 py-0.5">{`${match.match.periodLabel ?? ""} ${match.match.clock ?? ""}`}</span>}
            <span className="rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-dark">HIGHLIGHTS</span>
          </p>
        }
      />
      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold">What it means</h2>
          <p className="text-sm md:text-[15px]">{match.whatItMeans}</p>
        </div>
        <button
          type="button"
          onClick={onSeeStakes}
          className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
        >
          See season stakes <Icon name="arrowRight" className="size-4" />
        </button>
      </section>
    </>
  );
}

/** a live (or upcoming) match page (docs/design/02-live-match.png). onChange refetches the page (the game ended) */
export function LiveMatch({ match: initial, source, onChange }: { match: LiveMatchDetail; source?: DataSource | null; onChange?: () => void }) {
  const real = !isMockMatch(initial.id);
  const me = useMe().data;
  const live = useLiveMatch(real ? initial : null, me);
  const match = live?.match ?? initial;
  const mockCall = useCallIt(real ? null : initial.callIt);
  const call = real ? (live?.call ?? null) : mockCall;
  const [tab, setTab] = useState<Tab>("overview");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  // the phone sheet: your last choice, unless a new call has arrived since (then it opens)
  const [sheet, setSheet] = useState<{ open: boolean; forCall: string | null }>(() => ({ open: startsOnCallIt(), forCall: null }));
  const roomCode = roomFromUrl();
  const [promptOpen, setPromptOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const needsNickname = real && me !== null && !me.joined;

  // arriving from the home page or a qr code: show the call; a first-time visitor picks a nickname
  useEffect(() => {
    if (startsOnCallIt()) scrollTo("call-it");
  }, []);
  const showPrompt = promptOpen || (needsNickname && roomCode !== null && !dismissed);

  // a new call: phones open the sheet and buzz once
  const callId = call?.phase === "open" ? `${call.question}|${call.totalSeconds}` : null;
  const sheetOpen = callId && callId !== sheet.forCall && isPhone() ? true : sheet.open;
  const setSheetOpen = (open: boolean) => setSheet({ open, forCall: callId });
  const buzzed = useRef<string | null>(null);
  useEffect(() => {
    if (!callId || callId === buzzed.current) return;
    buzzed.current = callId;
    if (isPhone()) navigator.vibrate?.(50);
  }, [callId]);

  // the game ended: the page becomes the finished layout
  const finished = live?.state?.status === "final";
  useEffect(() => {
    if (finished) onChange?.();
  }, [finished, onChange]);

  async function join(nickname: string): Promise<string | null> {
    const res = await joinMatchApi(match.id, nickname, roomCode);
    if (!res.ok) return res.error;
    setPromptOpen(false);
    return null;
  }

  function goTo(section: Section) {
    if (section === "call-it") {
      setSheetOpen(true);
      return scrollTo("call-it");
    }
    if (section === "season-stakes" && tab !== "overview" && tab !== "stakes") setTab("stakes");
    scrollTo(section);
  }

  const pick = (optionId: string) => {
    if (needsNickname) return setPromptOpen(true);
    call?.pick(optionId);
  };
  const callView = call ? { ...call, pick } : null;
  const isLive = match.status === "live";
  const rotation = live?.state?.rotation ?? initial.rotation ?? null;

  const events = (
    <EventList
      title="Latest events"
      events={match.events}
      note={match.eventsNote}
      onWatch={(e) => e.video && setVideo(e.video)}
      onViewAll={tab === "events" ? undefined : () => setTab("events")}
    />
  );
  const stats = <MatchStats stats={match.stats} source={match.statsSource} note={match.statsNote} />;
  const stakes = <SeasonStakesCard stakes={match.seasonStakes} />;
  const callCard = (extra: Partial<Parameters<typeof CallItCard>[0]>) => (
    <CallItCard
      view={callView}
      id="call-it"
      lastCall={live?.lastCall ?? null}
      waitingText={isLive ? "Next call coming soon" : "Calls open when the game starts"}
      {...extra}
    />
  );

  return (
    <SiteLayout sidebar={{ docked: false }} source={live?.isReplay ? null : source}>
      {callView?.phase === "open" && !callView.picked && <CallBanner view={callView} onGo={() => goTo("call-it")} />}
      {real && hostMode() && <HostBar matchId={match.id} />}
      <div className="px-4 pb-32 md:px-[30px] md:pb-12">
        <Breadcrumbs items={match.breadcrumbs} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={match.spectators} />
          <StakesSummary chips={match.stakesSummary} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_343px]">
          <main className="flex min-w-0 flex-col gap-4">
            {rotation ? (
              <RotationStage
                match={match}
                rotation={rotation}
                onSeeStakes={() => {
                  setTab("stakes");
                  scrollTo("live-tabs");
                }}
              />
            ) : (
            <VideoPlayer
              video={match.video}
              onPlay={() => setVideo(match.video)}
              className="aspect-[4/3] sm:aspect-video md:aspect-[1020/278]"
              progress={isLive ? Math.min(1, (live?.gameTime ?? 0) / 3600) : undefined}
              overlay={
                <>
                  <p className="absolute top-4 left-4 flex items-center gap-3 text-sm font-semibold">
                    {isLive ? <LiveBadge /> : <span className="rounded-md bg-dark-ink/15 px-2.5 py-1 text-xs font-bold">{match.match.whenLabel}</span>}
                    {isLive && `${match.match.periodLabel ?? ""} ${match.match.clock ?? ""}`}
                    {live?.isReplay && <span className="rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-dark">REPLAY</span>}
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
            )}

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
                {tab === "lineups" && <Lineups home={match.match.home} away={match.match.away} lineups={match.lineups} />}
                {tab === "call" && callCard({})}
              </motion.div>
            </AnimatePresence>
          </main>

          <aside aria-label="Calls and rooms" className="flex min-w-0 flex-col gap-4">
            {tab !== "call" && callCard({ sheet: true, sheetOpen, onSheetOpenChange: setSheetOpen })}
            <WatchTogetherCard id="watch-together" room={match.room} matchId={real ? match.id : undefined} onJoin={() => setJoinOpen(true)} you={live?.you ?? null} />
            <LiveDiscussion
              id="discussion"
              comments={match.discussion}
              action={
                <ActionLink href={match.guidelinesHref}>
                  Community guidelines <Icon name="arrowRight" className="size-3.5" />
                </ActionLink>
              }
              onPost={
                real
                  ? async (text) => {
                      if (needsNickname) {
                        setPromptOpen(true);
                        return { error: "Pick a nickname first." };
                      }
                      const res = await postCommentApi(match.id, text);
                      return res.ok ? { comment: res.data.comment } : { error: res.error };
                    }
                  : undefined
              }
            />
          </aside>
        </div>
      </div>

      <MobileBottomBar items={BAR} onSelect={goTo} />
      <VideoModal video={video} onClose={() => setVideo(null)} />
      <JoinRoomModal code={match.room.code} matchId={real ? match.id : undefined} open={joinOpen} onClose={() => setJoinOpen(false)} />
      <NicknamePrompt
        open={showPrompt}
        onClose={() => {
          setPromptOpen(false);
          setDismissed(true);
        }}
        onSubmit={join}
        roomCode={roomCode}
      />
    </SiteLayout>
  );
}
