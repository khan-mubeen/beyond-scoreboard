import { useState } from "react";
import { mockRoomStates } from "@/shared/mock";
import { Button, Card } from "@/shared/ui";
import { formatGameClock } from "../replay/clock";
import { HostRoomView } from "./HostRoom";
import { PhoneRoomView } from "./PhoneRoom";

/** steps through shared/mock/room-states.json with the phone and host side by side */
export function DevLive() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lastAction, setLastAction] = useState<string>("none");
  const state = mockRoomStates[step];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">/dev/live</h1>
      <Card className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ◀ prev
        </Button>
        <Button disabled={step === mockRoomStates.length - 1} onClick={() => setStep(step + 1)}>
          next ▶
        </Button>
        <span className="text-sm tabular-nums">
          state {step + 1}/{mockRoomStates.length} · {state.phase} · {formatGameClock(state.gameTimeSeconds)}
        </span>
        <span className="text-sm text-muted">last host action: {lastAction}</span>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <Card className="bg-bg">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">phone</p>
          <PhoneRoomView
            state={state}
            answers={answers}
            onAnswer={(callId, optionId) => setAnswers({ ...answers, [callId]: optionId })}
          />
        </Card>
        <Card className="bg-bg">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">host</p>
          <HostRoomView state={state} joinUrl={null} onAction={(req) => setLastAction(req.action)} />
        </Card>
      </div>
    </main>
  );
}
