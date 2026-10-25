import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { Comment, FinishedMatchDetail, LiveMatchDetail, MatchDetail, MeResponse, RoomLeaderboardRow } from "@/shared/types";
import { AudioSummary } from "../components/AudioSummary";
import { BurstLayer } from "../components/BurstLayer";
import { CallItCard } from "../components/CallItCard";
import { HighlightPlayer } from "../components/HighlightPlayer";
import { JoinAt } from "../components/JoinAt";
import { LobbyStage } from "../components/LobbyStage";
import { ScoreHeader } from "../components/ScoreHeader";
import { SiteLayout } from "../components/SiteLayout";
import { MatchSkeleton } from "../components/Skeleton";
import { StakesSummary } from "../components/StakesSummary";
import { InitialAvatar } from "../components/TeamLogo";
import { useLiveMatch } from "../components/use-live-match";
import { TriviaCard } from "../components/WatchParty";
import { WhatItMeant } from "../components/WhatItMeant";
import { navigate, useMatchDetail, useMe, useRotation } from "../data";
import { fmtInt } from "../format";
import { NAMES } from "@/shared/copy/names";

/** the party board on the big screen: everyone in the party, 0 points too */
function Board({ rows, watching, title = NAMES.party }: { rows: RoomLeaderboardRow[]; watching: number; title?: string }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 text-lg shadow-card" data-testid="tv-board">
      <h2 className="mb-2 flex items-baseline justify-between text-2xl font-bold">
        {title} <span className="text-base font-semibold text-muted tabular-nums">{fmtInt(watching)} watching</span>
      </h2>
      {rows.length ? (
        <ol className="flex flex-col divide-y divide-line">
          {rows.slice(0, 8).map((r, i) => (
            <li key={r.userId ?? i} className="flex items-center gap-3 py-2">
              <span className="w-6 text-right text-muted tabular-nums">{r.rank}</span>
              <InitialAvatar name={r.name} size={32} />
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <span className="tabular-nums">{fmtInt(r.score ?? 0)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">Open the address below on your phone to join.</p>
      )}
    </section>
  );
}

/** one line at the bottom: the latest chat message or fact card, sliding in */
function Ticker({ feed }: { feed: Comment[] }) {
  const last = [...feed].reverse().find((c) => c.kind !== "trivia");
  if (!last) return null;
  const text =
    last.kind === "fact" && last.fact
      ? `${last.author} asked "${last.fact.question}" — ${last.fact.answer}`
      : last.kind === "system"
        ? last.text
        : `${last.author}: ${last.text}`;
  return (
    <div className="overflow-hidden rounded-card bg-dark px-5 py-3 text-xl text-dark-ink shadow-card" aria-live="polite" data-testid="tv-ticker">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={last.id} className="truncate" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.3 }}>
          <span className="mr-2 font-bold text-live-bright">{last.kind === "fact" ? "ASK" : last.kind === "system" ? "★" : "CHAT"}</span>
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** lobby and live: the stage, the call (no buttons) with its answer count, the party and its chat */
function TvLive({ detail, onChange, me }: { detail: LiveMatchDetail; onChange: () => void; me: MeResponse | null }) {
  // the tv shows the party; it isn't a fan in it
  const live = useLiveMatch(detail, null, { presence: false });
  const match = live?.match ?? detail;
  const rotation = live?.state?.rotation ?? detail.rotation ?? null;
  const finished = live?.state?.status === "final";
  useEffect(() => {
    if (finished) onChange();
  }, [finished, onChange]);
  const trivia = live?.trivia && live.trivia.phase !== "revealed" ? live.trivia : null;
  const side = (
    <div className="flex flex-col gap-6">
      <CallItCard view={live?.call ?? null} display lastCall={live?.lastCall ?? null} answered={live?.answered ?? null} waitingText={rotation?.phase === "lobby" ? "The first call opens in a moment" : "Next question soon"} />
      {trivia && <TriviaCard t={trivia} display />}
      <Board rows={match.room.leaderboard} watching={match.room.watching} />
    </div>
  );

  if (rotation?.phase === "lobby") {
    return (
      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-6">
          <LobbyStage match={match.match} rotation={rotation} tv me={me} />
          <Ticker feed={live?.feed ?? []} />
        </div>
        {side}
        <BurstLayer bursts={live?.bursts ?? []} big />
      </div>
    );
  }
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={match.spectators} />
        <HighlightPlayer video={match.highlight ?? null} rotation={rotation} tv className="aspect-video" />
        <Ticker feed={live?.feed ?? []} />
        <StakesSummary chips={match.stakesSummary} />
      </div>
      <div className="flex flex-col gap-6">
        {side}
        <JoinAt me={me} size="md" />
      </div>
      <BurstLayer bursts={live?.bursts ?? []} big />
    </div>
  );
}

/** summary: what it meant, and the party's podium */
function TvSummary({ detail, me }: { detail: FinishedMatchDetail; me: MeResponse | null }) {
  const rows = detail.room.leaderboard.filter((r) => r.name !== "You" || r.score !== null);
  const podium = [rows[1], rows[0], rows[2]];
  return (
    <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex flex-col gap-6">
        <ScoreHeader match={detail.match} venue={detail.venue} dateLabel={detail.dateLabel} spectators={detail.spectators} />
        <WhatItMeant data={detail.whatItMeant} />
        {detail.summary && <AudioSummary summary={detail.summary} tv />}
      </div>
      <div className="flex flex-col gap-6">
        <section aria-label="Podium" className="rounded-card border border-line bg-surface p-6 shadow-card">
          <h2 className="text-2xl font-bold">{NAMES.party} podium</h2>
          {rows.length === 0 && <p className="mt-2 text-muted">Nobody played this one. Join on your phone for the next match.</p>}
          <ol className="mt-6 grid grid-cols-3 items-end gap-3 text-center">
            {podium.map((r, i) => (
              <li key={i} className={`rounded-t-lg bg-accent-soft px-2 pt-3 ${i === 1 ? "h-44" : i === 0 ? "h-36" : "h-28"}`}>
                {r && (
                  <>
                    <p className="text-3xl font-black text-accent">{r.rank}</p>
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="text-muted tabular-nums">{r.score ?? 0} pts</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
        <JoinAt me={me} size="md" />
      </div>
    </div>
  );
}

/**
 * tv mode for the projector (/match/<id>?tv=1 or /tv): no nav or sidebar, big type, and it
 * follows the rotation by itself. no qr codes: "Join at …" in big type, so anyone can type it.
 * the host presses play for any sound
 */
export function TvMatch({ id }: { id: string }) {
  // the host's tv sends the host token: never locked
  const { data, refresh } = useMatchDetail(id, { tv: true });
  const me = useMe().data;
  const current = useRotation().data?.current.matchId;
  useEffect(() => {
    if (current && current !== id) navigate(`/match/${current}?tv=1`);
  }, [current, id]);
  const detail: MatchDetail | null = data;
  return (
    <SiteLayout sidebar={{ docked: false }} bare>
      {!detail ? (
        <MatchSkeleton />
      ) : detail.status === "preview" ? (
        <div className="flex flex-col gap-6 p-8">
          <ScoreHeader match={detail.match} venue={detail.venue} dateLabel={detail.dateLabel} spectators={null} />
          <JoinAt me={me} size="xl" />
        </div>
      ) : detail.status === "final" ? (
        <TvSummary detail={detail} me={me} />
      ) : (
        <TvLive detail={detail} onChange={refresh} me={me} />
      )}
    </SiteLayout>
  );
}

/** /tv: the rotation's current match in tv mode */
export function TvNow() {
  const { data, status } = useRotation();
  useEffect(() => {
    if (data) navigate(`/match/${data.current.matchId}?tv=1`);
  }, [data]);
  return (
    <SiteLayout sidebar={{ docked: false }} bare>
      <p className="grid min-h-screen place-items-center text-2xl text-muted">
        {status === "notfound" ? "The demo rotation is off (DEMO_MODE=true starts it)." : "Finding the match on now…"}
      </p>
    </SiteLayout>
  );
}

/** /join (the short address on the tv): the match the rotation is on now, as a fan */
export function JoinNow() {
  const { data, status } = useRotation();
  useEffect(() => {
    if (data) window.location.replace(`/match/${data.current.matchId}`);
  }, [data]);
  return (
    <SiteLayout sidebar={{ docked: false }} bare>
      <p className="grid min-h-screen place-items-center p-6 text-center text-xl text-muted">
        {status === "notfound" ? (
          <a href="/sports" className="underline">
            No watch party is on right now. See what's live
          </a>
        ) : (
          "Finding the watch party…"
        )}
      </p>
    </SiteLayout>
  );
}
