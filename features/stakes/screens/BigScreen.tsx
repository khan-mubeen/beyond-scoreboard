import { QRCodeSVG } from "qrcode.react";
import { formatGameClock, useJoinUrl, useRoomState } from "@/features/live";
import { teamById } from "@/shared/mock";
import type { RoomState } from "@/shared/types";
import { Card } from "@/shared/ui";
import { ProjectedTable } from "../components/ProjectedTable";
import { StakesMeter } from "../components/StakesMeter";

/** the tv in the bar: lobby with the qr code, live stakes, final */
export function BigScreen({ code }: { code: string }) {
  const { state, error } = useRoomState(code);
  const joinUrl = useJoinUrl(code);
  if (!state) return <Centered>{error ?? "Connecting…"}</Centered>;
  return <BigScreenView state={state} joinUrl={joinUrl} />;
}

export function BigScreenView({ state, joinUrl }: { state: RoomState; joinUrl: string | null }) {
  const home = teamById(state.game.homeTeamId);
  const away = teamById(state.game.awayTeamId);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 p-8 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div className="text-4xl font-bold">
            {home.name}{" "}
            <span className="tabular-nums text-accent">
              {state.score.home}–{state.score.away}
            </span>{" "}
            {away.name}
          </div>
          <div className="text-right text-muted">
            <div className="text-sm uppercase tracking-wide">{state.phase}</div>
            {state.phase !== "lobby" && (
              <div className="font-mono text-2xl text-ink">{formatGameClock(state.gameTimeSeconds)}</div>
            )}
          </div>
        </header>

        {state.phase === "lobby" ? (
          <Card className="flex items-center gap-8 p-8">
            {joinUrl && <QRCodeSVG value={joinUrl} size={220} bgColor="transparent" fgColor="currentColor" />}
            <div className="flex flex-col gap-2">
              <p className="text-3xl font-bold">Scan to play along</p>
              <p className="text-muted">{joinUrl ?? "…"}</p>
              <p className="text-muted">
                Room {state.code} · {state.leaderboard.length} players in · points only
              </p>
            </div>
          </Card>
        ) : (
          state.activeCall && (
            <Card className="border-accent/50">
              <p className="text-sm uppercase tracking-wide text-accent">Live call</p>
              <p className="text-3xl font-bold">{state.activeCall.question}</p>
              {state.activeCall.stakesLine && <p className="text-muted">{state.activeCall.stakesLine}</p>}
            </Card>
          )
        )}

        <Card className="p-6">
          <StakesMeter card={state.stakes} />
        </Card>

        {state.leaderboard.length > 0 && (
          <Card>
            <p className="mb-2 text-sm uppercase tracking-wide text-muted">
              {state.phase === "final" ? "Final standings" : "Leaderboard"}
            </p>
            <ol className="grid grid-cols-2 gap-x-6 text-lg">
              {state.leaderboard.slice(0, 6).map((e) => (
                <li key={e.playerId} className="flex justify-between">
                  <span>
                    {e.rank}. {e.nickname}
                  </span>
                  <span className="tabular-nums">{e.score}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>

      <Card>
        <p className="mb-2 text-sm uppercase tracking-wide text-muted">Table if it ended now</p>
        <ProjectedTable rows={state.projectedTable} highlightTeamIds={[home.id, away.id]} />
      </Card>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center text-muted">{children}</main>;
}
