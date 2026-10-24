import type { RoomLeaderboardRow } from "@/shared/types";
import { fmtInt } from "../format";

/** a party board as a plain list (the finished match's final board) */
export function RoomLeaderboard({ rows }: { rows: RoomLeaderboardRow[] }) {
  return (
    <ol className="flex flex-col divide-y divide-line text-sm">
      {rows.map((r, i) =>
        r.isYou ? (
          <li
            key={`you-${i}`}
            className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 font-semibold text-accent"
          >
            <span>{r.name}</span>
            <span>{r.rank ? `#${r.rank}` : "See your rank"}</span>
          </li>
        ) : (
          <li key={`${r.name}-${i}`} className="flex items-center justify-between py-2.5">
            <span>
              {r.rank}. {r.name}
            </span>
            <span className="tabular-nums" aria-label={r.score === null ? "no score yet" : undefined}>
              {r.score === null ? "—" : fmtInt(r.score)}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}
