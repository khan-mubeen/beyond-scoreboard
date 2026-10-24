import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import type { FinishedMatchDetail, LiveMatchDetail, MatchDetail, RoomLeaderboardRow } from "@/shared/types";
import { AudioSummary } from "../components/AudioSummary";
import { CallItCard } from "../components/CallItCard";
import { HighlightPlayer } from "../components/HighlightPlayer";
import { LobbyStage } from "../components/LobbyStage";
import { ScoreHeader } from "../components/ScoreHeader";
import { SiteLayout } from "../components/SiteLayout";
import { MatchSkeleton } from "../components/Skeleton";
import { StakesSummary } from "../components/StakesSummary";
import { useLiveMatch } from "../components/use-live-match";
import { RoomLeaderboard, roomUrl } from "../components/WatchTogetherCard";
import { WhatItMeant } from "../components/WhatItMeant";
import { navigate, useMatchDetail, useRotation } from "../data";

const board = (rows: RoomLeaderboardRow[]) => rows.filter((r) => r.score !== null && r.name !== "You");

function RoomQr({ code, matchId, size = 168 }: { code: string; matchId: string; size?: number }) {
  const url = roomUrl(code, matchId);
  return (
    <div className="flex flex-col items-center gap-2 rounded-card bg-surface p-4 text-center shadow-card">
      <QRCodeSVG value={url} size={size} title={`QR code for ${url}`} />
      <p className="text-lg font-semibold">Scan to play along</p>
      <p className="font-mono text-sm text-muted">Room {code}</p>
    </div>
  );
}

function Board({ rows, title }: { rows: RoomLeaderboardRow[]; title: string }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 text-lg shadow-card">
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      {rows.length ? <RoomLeaderboard rows={rows.slice(0, 8)} /> : <p className="text-muted">The first correct call puts you here.</p>}
    </section>
  );
}

/** lobby and live: the stage, the call (no buttons), the room and the stakes */
function TvLive({ detail, onChange }: { detail: LiveMatchDetail; onChange: () => void }) {
  const live = useLiveMatch(detail, null);
  const match = live?.match ?? detail;
  const rotation = live?.state?.rotation ?? detail.rotation ?? null;
  const finished = live?.state?.status === "final";
  useEffect(() => {
    if (finished) onChange();
  }, [finished, onChange]);

  if (rotation?.phase === "lobby") {
    return (
      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <LobbyStage match={match.match} rotation={rotation} roomCode={match.room.code} tv />
        <div className="flex flex-col gap-6">
          <CallItCard view={live?.call ?? null} display waitingText="The first call opens in a moment" />
          <Board rows={board(match.room.leaderboard)} title="Watch Together" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ScoreHeader match={match.match} venue={match.venue} dateLabel={match.dateLabel} spectators={match.spectators} />
        <HighlightPlayer video={match.highlight ?? null} rotation={rotation} tv className="aspect-video" />
        <StakesSummary chips={match.stakesSummary} />
      </div>
      <div className="flex flex-col gap-6">
        <CallItCard view={live?.call ?? null} display lastCall={live?.lastCall ?? null} waitingText="Next call coming soon" />
        <Board rows={board(match.room.leaderboard)} title="Watch Together" />
        <RoomQr code={match.room.code} matchId={match.id} size={140} />
      </div>
    </div>
  );
}

/** summary: what it meant, and the podium of the room so far */
function TvSummary({ detail }: { detail: FinishedMatchDetail }) {
  const rows = board(detail.room.leaderboard);
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
          <h2 className="text-2xl font-bold">Watch Together podium</h2>
          {rows.length === 0 && <p className="mt-2 text-muted">No points yet. Scan the code and make your calls in the next match.</p>}
          <ol className="mt-6 grid grid-cols-3 items-end gap-3 text-center">
            {podium.map((r, i) => (
              <li key={i} className={`rounded-t-lg bg-accent-soft px-2 pt-3 ${i === 1 ? "h-44" : i === 0 ? "h-36" : "h-28"}`}>
                {r && (
                  <>
                    <p className="text-3xl font-black text-accent">{r.rank}</p>
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="tabular-nums text-muted">{r.score} pts</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
        <RoomQr code={detail.room.code} matchId={detail.id} size={140} />
      </div>
    </div>
  );
}

/**
 * tv mode for the projector (/match/<id>?tv=1 or /tv): no nav or sidebar, big type, and it
 * follows the rotation by itself. the host presses play for any sound
 */
export function TvMatch({ id }: { id: string }) {
  const { data, refresh } = useMatchDetail(id);
  const current = useRotation().data?.current.matchId;
  useEffect(() => {
    if (current && current !== id) navigate(`/match/${current}?tv=1`);
  }, [current, id]);
  const detail: MatchDetail | null = data;
  return (
    <SiteLayout sidebar={{ docked: false }} bare>
      {!detail ? <MatchSkeleton /> : detail.status === "final" ? <TvSummary detail={detail} /> : <TvLive detail={detail} onChange={refresh} />}
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
