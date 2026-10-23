import type { PublicCall } from "@/shared/types";
import { Card } from "@/shared/ui";
import { isLate } from "../calls/lock";
import { CALL_POINTS } from "../calls/scoring";
import { Countdown } from "./Countdown";

export function CallCard({
  call,
  gameTimeSeconds,
  myOptionId,
  onAnswer,
}: {
  call: PublicCall;
  gameTimeSeconds: number;
  myOptionId?: string;
  onAnswer: (optionId: string) => void;
}) {
  const locked = isLate(call, gameTimeSeconds);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex justify-between text-xs uppercase tracking-wide text-muted">
        <span>Live call</span>
        <span>{CALL_POINTS[call.type]} points</span>
      </div>
      <p className="text-xl font-bold">{call.question}</p>
      {call.stakesLine && <p className="text-sm text-muted">{call.stakesLine}</p>}
      <div className="flex flex-col gap-2">
        {call.options.map((o) => {
          const picked = myOptionId === o.id;
          return (
            <button
              key={o.id}
              disabled={locked || !!myOptionId}
              onClick={() => onAnswer(o.id)}
              className={`rounded-card border px-4 py-3 text-left font-semibold transition disabled:cursor-not-allowed ${
                picked ? "border-accent bg-accent/15" : "border-line bg-surface-2 enabled:hover:border-accent/60"
              } ${!picked && (locked || myOptionId) ? "opacity-50" : ""}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <Countdown opensAt={call.opensAt} locksAt={call.locksAt} gameTimeSeconds={gameTimeSeconds} />
    </Card>
  );
}
