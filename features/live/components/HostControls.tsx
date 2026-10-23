import type { ControlRequest, RoomPhase } from "@/shared/types";
import { Button } from "@/shared/ui";

export function HostControls({
  phase,
  gameTimeSeconds,
  onAction,
}: {
  phase: RoomPhase;
  gameTimeSeconds: number;
  onAction: (req: ControlRequest) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {phase === "lobby" ? (
        <Button onClick={() => onAction({ action: "start" })}>Start replay</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={() => onAction({ action: "pause" })}>
            Pause
          </Button>
          <Button variant="ghost" onClick={() => onAction({ action: "resume" })}>
            Resume
          </Button>
          <Button variant="ghost" onClick={() => onAction({ action: "seek", seconds: gameTimeSeconds + 60 })}>
            +1 min
          </Button>
          <Button variant="ghost" onClick={() => onAction({ action: "seek", seconds: gameTimeSeconds + 300 })}>
            +5 min
          </Button>
          <Button variant="ghost" onClick={() => onAction({ action: "intermission" })}>
            Intermission
          </Button>
          <Button variant="ghost" onClick={() => onAction({ action: "finish" })}>
            Finish
          </Button>
        </>
      )}
      <Button variant="ghost" onClick={() => onAction({ action: "reset" })}>
        Reset
      </Button>
    </div>
  );
}
