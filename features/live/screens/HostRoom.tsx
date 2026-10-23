import { QRCodeSVG } from "qrcode.react";
import type { ControlRequest, RoomState } from "@/shared/types";
import { Card } from "@/shared/ui";
import { formatGameClock } from "../replay/clock";
import { HostControls } from "../components/HostControls";
import { useJoinUrl, useRoomState } from "../components/use-room-state";

/** the host's laptop: qr code, replay controls, who joined */
export function HostRoom({ code }: { code: string }) {
  const { state, error } = useRoomState(code);
  const joinUrl = useJoinUrl(code);

  async function control(req: ControlRequest) {
    await fetch(`/api/rooms/${encodeURIComponent(code)}/control`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-gutter">
      {state ? (
        <HostRoomView state={state} joinUrl={joinUrl} onAction={control} />
      ) : (
        <p className="text-muted">{error ?? "Connecting…"}</p>
      )}
    </main>
  );
}

export function HostRoomView({
  state,
  joinUrl,
  onAction,
}: {
  state: RoomState;
  joinUrl: string | null;
  onAction: (req: ControlRequest) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Host · room {state.code}</h1>
        <a
          className="text-sm text-accent underline"
          href={`/room/${state.code}/screen`}
          target="_blank"
          rel="noreferrer"
        >
          open big screen
        </a>
      </header>

      <Card className="flex items-center gap-6">
        {joinUrl && <QRCodeSVG value={joinUrl} size={120} bgColor="transparent" fgColor="currentColor" />}
        <div className="text-sm">
          <p className="text-muted">Phones join at</p>
          <p className="font-mono">{joinUrl ?? "…"}</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="uppercase tracking-wide text-muted">{state.phase}</span>
          <span className="font-mono">
            {formatGameClock(state.gameTimeSeconds)} · {state.score.home}–{state.score.away}
          </span>
        </div>
        <HostControls phase={state.phase} gameTimeSeconds={state.gameTimeSeconds} onAction={onAction} />
      </Card>

      <Card>
        <p className="mb-1 text-sm text-muted">Active call</p>
        {state.activeCall ? (
          <p>
            {state.activeCall.question}{" "}
            <span className="text-muted">(locks at {formatGameClock(state.activeCall.locksAt)})</span>
          </p>
        ) : (
          <p className="text-muted">none</p>
        )}
      </Card>

      <Card>
        <p className="mb-1 text-sm text-muted">{state.leaderboard.length} players</p>
        <ol className="grid grid-cols-2 gap-x-4 text-sm">
          {state.leaderboard.map((e) => (
            <li key={e.playerId} className="flex justify-between">
              <span>
                {e.rank}. {e.nickname}
              </span>
              <span className="tabular-nums">{e.score}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
