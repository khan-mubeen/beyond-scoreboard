import { useState } from "react";
import { StakesMeter } from "@/features/stakes";
import { teamById } from "@/shared/mock";
import type { RoomState } from "@/shared/types";
import { Badge, Card } from "@/shared/ui";
import { formatGameClock } from "../replay/clock";
import { CallCard } from "../components/CallCard";
import { FinalCard } from "../components/FinalCard";
import { JoinForm } from "../components/JoinForm";
import { savePlayerId, usePlayerId } from "../components/player-session";
import { useRoomState } from "../components/use-room-state";

/** the phone: join with a nickname, then answer live calls */
export function PhoneRoom({ code }: { code: string }) {
  const playerId = usePlayerId(code);
  if (!playerId) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">PowerPlay</h1>
        <JoinForm code={code} onJoined={(id) => savePlayerId(code, id)} />
      </Shell>
    );
  }
  return <JoinedPhone code={code} playerId={playerId} />;
}

function JoinedPhone({ code, playerId }: { code: string; playerId: string }) {
  const { state, error } = useRoomState(code, playerId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function answer(callId: string, optionId: string) {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, callId, optionId }),
    });
    if (res.ok || res.status === 409) setAnswers((a) => ({ ...a, [callId]: optionId }));
    setNotice(res.ok ? null : ((await res.json()).error ?? "answer not saved"));
  }

  if (!state) return <Shell>{error ?? "Connecting…"}</Shell>;
  return (
    <Shell>
      <PhoneRoomView state={state} answers={answers} onAnswer={answer} />
      {notice && <p className="text-sm text-bad">{notice}</p>}
    </Shell>
  );
}

export function PhoneRoomView({
  state,
  answers,
  onAnswer,
}: {
  state: RoomState;
  answers: Record<string, string>;
  onAnswer: (callId: string, optionId: string) => void;
}) {
  const home = teamById(state.game.homeTeamId);
  const away = teamById(state.game.awayTeamId);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold">
          {home.shortName}{" "}
          <span className="tabular-nums">
            {state.score.home}–{state.score.away}
          </span>{" "}
          {away.shortName}
        </span>
        <span className="font-mono text-sm text-muted">
          {state.phase === "lobby" ? "lobby" : formatGameClock(state.gameTimeSeconds)}
        </span>
      </header>

      {state.me && (
        <div className="flex gap-2">
          <Badge tone="accent">{state.me.score} points</Badge>
          <Badge>rank #{state.me.rank}</Badge>
        </div>
      )}

      {state.lastResolved?.youWereRight !== undefined && (
        <Badge tone={state.lastResolved.youWereRight ? "good" : "bad"}>
          {state.lastResolved.youWereRight ? "You called it" : "Not this time"}
        </Badge>
      )}

      {state.phase === "final" ? (
        <FinalCard state={state} />
      ) : state.phase === "lobby" ? (
        <Card>You're in. Calls start at puck drop.</Card>
      ) : state.activeCall ? (
        <CallCard
          call={state.activeCall}
          gameTimeSeconds={state.gameTimeSeconds}
          myOptionId={answers[state.activeCall.id]}
          onAnswer={(optionId) => state.activeCall && onAnswer(state.activeCall.id, optionId)}
        />
      ) : (
        <Card className="text-muted">
          {state.phase === "intermission" ? "Intermission. Next call soon." : "Next call soon."}
        </Card>
      )}

      <Card>
        <StakesMeter card={state.stakes} compact />
      </Card>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-gutter">{children}</main>;
}
