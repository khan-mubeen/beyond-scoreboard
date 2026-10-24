import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DataSource, LiveMatchDetail, LiveRotation, MeResponse, VideoInfo } from "@/shared/types";
import { BurstLayer } from "../components/BurstLayer";
import { CallBanner, CallItCard } from "../components/CallItCard";
import { CheckoutModal } from "../components/Checkout";
import { DebugPanel, debugMode } from "../components/DebugPanel";
import { EventList } from "../components/EventList";
import { HighlightPlayer } from "../components/HighlightPlayer";
import { HostBar } from "../components/HostBar";
import { Icon } from "../components/Icon";
import { InviteModal } from "../components/InviteModal";
import { Lineups } from "../components/Lineups";
import { LiveBadge } from "../components/LiveMatchCard";
import { LobbyStage } from "../components/LobbyStage";
import { MatchStats } from "../components/MatchStats";
import { type BottomBarItem, MobileBottomBar } from "../components/MobileBottomBar";
import { NicknamePrompt } from "../components/NicknamePrompt";
import { ScoreHeader } from "../components/ScoreHeader";
import { SeasonStakesCard } from "../components/SeasonStakesCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { StakesSummary } from "../components/StakesSummary";
import { StreamLock } from "../components/StreamLock";
import { type TabItem, Tabs } from "../components/Tabs";
import { toast } from "../components/Toast";
import { useCallIt } from "../components/use-call-it";
import { useLiveMatch } from "../components/use-live-match";
import { VideoModal, VideoPlayer } from "../components/VideoPlayer";
import { type PartyActions, type PartyTab, WatchPartyPanel } from "../components/WatchParty";
import { askApi, fmtCountdown, isMockMatch, joinMatchApi, postBurstApi, postCommentApi, reactApi, useMe, useServerNow } from "../data";
import { NAMES } from "@/shared/copy/names";

type Tab = "overview" | "events" | "stats" | "lineups" | "stakes";
type Section = "call-it" | "chat" | "party" | "season-stakes";

const TABS: TabItem<Tab>[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "stats", label: "Statistics" },
  { id: "lineups", label: "Lineups" },
  { id: "stakes", label: "Season stakes" },
];
const BAR: BottomBarItem<Section>[] = [
  { id: "call-it", label: NAMES.call, icon: "target" },
  { id: "chat", label: "Chat", icon: "discussion" },
  { id: "party", label: "Party", icon: "users" },
  { id: "season-stakes", label: "Stakes", icon: "chart" },
];

const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
// the your call! sheet starts open when arriving from the home card or an old room qr code
const startsOnCallIt = () =>
  typeof window !== "undefined" && (window.location.hash === "#call-it" || new URLSearchParams(window.location.search).has("room"));
const hostMode = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("host");
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/**
 * a demo rotation match: the lobby (countdown), its highlight in step with the server while
 * live, or when it comes up next. "what it means" sits under the video instead of over it
 */
function RotationStage({ match, rotation, onSeeStakes, me }: { match: LiveMatchDetail; rotation: LiveRotation; onSeeStakes: () => void; me: MeResponse | null }) {
  const now = useServerNow(1000);
  // here, not in the lock: the success screen stays up while the stream unlocks underneath
  const [checkout, setCheckout] = useState<string | null>(null);
  const modal = <CheckoutModal planId={checkout} open={checkout !== null} onClose={() => setCheckout(null)} liveHref={`/match/${match.id}`} />;
  if (rotation.phase === "lobby")
    return (
      <>
        <LobbyStage match={match.match} rotation={rotation} me={me} />
        {modal}
      </>
    );
  const live = rotation.phase === "live";
  const badges = (
    <p className="absolute top-4 left-4 flex items-center gap-3 text-sm font-semibold">
      {live ? <LiveBadge /> : <span className="rounded-md bg-dark/70 px-2.5 py-1 text-xs font-bold">Starts in {fmtCountdown(rotation.phaseEndsAt - now)}</span>}
      {live && <span className="rounded-md bg-dark/70 px-2 py-0.5">{`${match.match.periodLabel ?? ""} ${match.match.clock ?? ""}`}</span>}
    </p>
  );
  return (
    <>
      {/* no plan with the live stream: the poster and a lock (the server sent no video) */}
      {match.streamLock ? (
        <StreamLock lock={match.streamLock} matchId={match.id} onSubscribe={() => setCheckout(match.streamLock!.planId)} overlay={badges} />
      ) : (
        <HighlightPlayer video={match.highlight ?? null} rotation={rotation} liigaUrl={match.liigaUrl} className="aspect-video" overlay={badges} />
      )}
      {modal}
      <section className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card md:flex-row md:items-end md:justify-between">
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

/**
 * a live (or upcoming) match page. desktop (1280 px and up): a smaller video (at most ~60% of
 * the width and 45% of the screen's height) with the watch party panel beside it, sticky while
 * the stats scroll. tablet: the panel under the video, your call! first. phone: your call! stays
 * a bottom sheet. onChange refetches the page (the game ended)
 */
export function LiveMatch({ match: initial, source, onChange }: { match: LiveMatchDetail; source?: DataSource | null; onChange?: () => void }) {
  const real = !isMockMatch(initial.id);
  const me = useMe().data;
  const live = useLiveMatch(real ? initial : null, me);
  const match = live?.match ?? initial;
  const mockCall = useCallIt(real ? null : initial.callIt);
  const call = real ? (live?.call ?? null) : mockCall;
  const [tab, setTab] = useState<Tab>("overview");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [partyTab, setPartyTab] = useState<PartyTab>(() => (isPhone() ? "chat" : "call"));
  // the phone sheet: your last choice, unless a new call has arrived since (then it opens)
  const [sheet, setSheet] = useState<{ open: boolean; forCall: string | null }>(() => ({ open: startsOnCallIt(), forCall: null }));
  // the nickname sheet, and the party action waiting for it
  const [promptOpen, setPromptOpen] = useState(false);
  const [pending, setPending] = useState<{ run: () => Promise<unknown> } | null>(null);
  const needsNickname = real && me !== null && !me.joined;

  useEffect(() => {
    if (startsOnCallIt()) scrollTo("call-it");
  }, []);

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

  /** a party action: a guest picks a nickname first, then it runs */
  function named<T>(action: () => Promise<T>): Promise<T | null> {
    if (!needsNickname) return action();
    setPending({ run: action });
    setPromptOpen(true);
    return Promise.resolve(null);
  }

  async function join(nickname: string): Promise<string | null> {
    const res = await joinMatchApi(match.id, nickname);
    if (!res.ok) return res.error;
    setPromptOpen(false);
    const next = pending;
    setPending(null);
    if (next) {
      const out = await next.run();
      // an error from the action that waited: tell the fan here, its input may be gone
      if (typeof out === "string") toast(out);
      else if (out && typeof out === "object" && "error" in out && typeof out.error === "string") toast(out.error);
    }
    return null;
  }

  const act: PartyActions = {
    post: async (text) =>
      (await named(async () => {
        const r = await postCommentApi(match.id, text);
        if (!r.ok) return r.error;
        live?.local("comment", { comment: r.data.comment });
        return null;
      })) ?? null,
    ask: async (text) =>
      (await named(async () => {
        const r = await askApi(match.id, text.startsWith("?") ? text.slice(1) : text);
        if (!r.ok) return { error: r.error };
        if (r.data.comment) live?.local("comment", { comment: r.data.comment });
        return { error: null, privateCard: r.data.posted ? null : r.data.card };
      })) ?? { error: null },
    burst: async (emoji) =>
      (await named(async () => {
        const r = await postBurstApi(match.id, emoji);
        if (!r.ok) return r.error;
        live?.local("burst", { burst: r.data.burst });
        return null;
      })) ?? null,
    react: async (commentId, emoji) =>
      (await named(async () => {
        const r = await reactApi(commentId, emoji);
        if (!r.ok) return r.status === 409 ? null : r.error;
        live?.local("reaction", { commentId, reactions: r.data.reactions });
        return null;
      })) ?? null,
  };

  function goTo(section: Section) {
    if (section === "call-it") {
      setSheetOpen(true);
      setPartyTab("call");
      return scrollTo("call-it");
    }
    if (section === "chat" || section === "party") {
      setPartyTab(section);
      return scrollTo("watch-party");
    }
    if (tab !== "overview" && tab !== "stakes") setTab("stakes");
    scrollTo("season-stakes");
  }

  // on a phone the sheet folds a moment after the answer ("Locked in" first): the party is under it
  const answered = () => {
    if (isPhone()) setTimeout(() => setSheet({ open: false, forCall: callId }), 1200);
  };
  const pick = (optionId: string) => {
    if (needsNickname) {
      setPending({ run: async () => (call?.pick(optionId), answered()) });
      return setPromptOpen(true);
    }
    call?.pick(optionId);
    answered();
  };
  const callView = call ? { ...call, pick } : null;
  const trivia = live?.trivia ? { ...live.trivia, pick: (id: string) => void named(async () => live.trivia!.pick(id)) } : null;
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
  const callCard = (
    <CallItCard
      view={callView}
      id="call-it"
      lastCall={live?.lastCall ?? null}
      waitingText={isLive ? "Next question soon" : "Questions open when the game starts"}
      answered={live?.answered ?? null}
      sheet
      sheetOpen={sheetOpen}
      onSheetOpenChange={setSheetOpen}
    />
  );
  const seeStakes = () => {
    setTab("stakes");
    scrollTo("live-tabs");
  };

  return (
    <SiteLayout sidebar={{ docked: false }} source={live?.isReplay ? null : source}>
      {/* the banner points to the question when it is out of view: on wide screens the panel always shows it */}
      {callView?.phase === "open" && !callView.picked && (
        <div className="xl:hidden">
          <CallBanner view={callView} onGo={() => goTo("call-it")} />
        </div>
      )}
      {real && hostMode() && <HostBar matchId={match.id} />}
      <div className="px-4 pb-32 md:px-[30px] md:pb-12 xl:pt-4">
        <div className="grid gap-4 [grid-template-areas:'head'_'video'_'party'_'rest'] xl:grid-cols-[minmax(0,1fr)_minmax(400px,40%)] xl:[grid-template-areas:'head_party'_'video_party'_'rest_party']">
          {/* the breadcrumbs sit in the left column: the party panel starts at the top and fits the screen */}
          <div className="flex min-w-0 flex-col gap-3 [grid-area:head]">
            <div className="xl:-mt-4">
              <Breadcrumbs items={match.breadcrumbs} />
            </div>
            <div className="flex flex-col gap-3 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] 2xl:items-stretch">
              <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={match.spectators} />
              <StakesSummary chips={match.stakesSummary} />
            </div>
          </div>

          <div className="min-w-0 [grid-area:video]" data-testid="video-stage">
            {/* at most 45% of the screen's height: the party panel stays beside it, fully visible */}
            <div className="w-full">
              {rotation ? (
                <RotationStage match={match} rotation={rotation} onSeeStakes={seeStakes} me={me} />
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
                          onClick={seeStakes}
                          className="flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
                        >
                          See season stakes <Icon name="arrowRight" className="size-4" />
                        </button>
                      </div>
                    </>
                  }
                />
              )}
            </div>
          </div>

          <div className="min-w-0 [grid-area:party] xl:sticky xl:top-20 xl:h-[calc(100vh-8rem)] xl:self-start">
            <WatchPartyPanel
              className="xl:h-full"
              tab={partyTab}
              onTab={(t) => (t === "call" && isPhone() ? goTo("call-it") : setPartyTab(t))}
              watching={match.room.watching}
              members={live?.members ?? match.room.members ?? []}
              board={match.room.leaderboard}
              feed={live?.feed ?? match.discussion}
              myId={live?.myId ?? null}
              friends={me?.friends ?? []}
              callCard={callCard}
              callOpen={callView?.phase === "open"}
              trivia={trivia}
              pulse={!!live?.roomPulse}
              onInvite={() => void named(async () => setInviteOpen(true))}
              act={act}
            />
          </div>

          <main className="flex min-w-0 flex-col gap-4 [grid-area:rest]">
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
                    <div id="season-stakes" className="scroll-mt-20">
                      {stakes}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {events}
                      {stats}
                    </div>
                  </>
                )}
                {tab === "events" && events}
                {tab === "stats" && stats}
                {tab === "stakes" && (
                  <div id="season-stakes" className="scroll-mt-20">
                    {stakes}
                  </div>
                )}
                {tab === "lineups" && <Lineups home={match.match.home} away={match.match.away} lineups={match.lineups} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <BurstLayer bursts={live?.bursts ?? []} />
      <MobileBottomBar items={BAR} onSelect={goTo} />
      <VideoModal video={video} onClose={() => setVideo(null)} />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} matchId={real ? match.id : null} me={me ?? null} />
      <NicknamePrompt
        open={promptOpen}
        onClose={() => {
          setPromptOpen(false);
          setPending(null);
        }}
        onSubmit={join}
      />
      {real && debugMode() && live && <DebugPanel debug={live.debug} state={live.state} />}
    </SiteLayout>
  );
}
