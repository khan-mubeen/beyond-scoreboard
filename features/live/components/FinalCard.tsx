import type { RoomState } from "@/shared/types";
import { Card } from "@/shared/ui";

export function FinalCard({ state }: { state: RoomState }) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wide text-muted">Final</p>
      {state.me && (
        <p className="text-2xl font-bold">
          You finished #{state.me.rank} with {state.me.score} points
        </p>
      )}
      <ol className="flex flex-col gap-1">
        {state.leaderboard.slice(0, 10).map((e) => (
          <li
            key={e.playerId}
            className={`flex justify-between ${e.playerId === state.me?.playerId ? "font-bold text-accent" : ""}`}
          >
            <span>
              {e.rank}. {e.nickname}
            </span>
            <span className="tabular-nums">{e.score}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
