import { useState } from "react";
import type { MeResponse, RoomLeaderboardRow, RoomSummary } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon } from "./Icon";
import { InviteModal } from "./InviteModal";
import { SectionCard } from "./SectionCard";
import { InitialAvatar } from "./TeamLogo";

/** a party board as a plain list (the finished match's final board) */
export function RoomLeaderboard({ rows }: { rows: RoomLeaderboardRow[] }) {
  return (
    <ol className="flex flex-col divide-y divide-line text-sm">
      {rows.map((r, i) =>
        r.isYou ? (
          <li
            key={`you-${i}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2 font-semibold text-accent"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 text-right tabular-nums">{r.rank ?? "–"}</span>
              <InitialAvatar name={r.name} size={24} />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="tabular-nums">{r.score === null ? (r.rank ? `#${r.rank}` : "See your rank") : fmtInt(r.score)}</span>
          </li>
        ) : (
          <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-2 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 text-right text-muted tabular-nums">{r.rank}</span>
              <InitialAvatar name={r.name} size={24} />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="font-semibold tabular-nums" aria-label={r.score === null ? "no score yet" : undefined}>
              {r.score === null ? "—" : fmtInt(r.score)}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}

const TOP = 10;

/** the top 10 by points, and you (from wherever you placed) at the end */
export function topWithYou(rows: RoomLeaderboardRow[]): RoomLeaderboardRow[] {
  const first = rows.slice(0, TOP);
  const you = rows.find((r) => r.isYou);
  return you && !first.includes(you) ? [...rows.filter((r) => !r.isYou).slice(0, TOP), you] : first;
}

/**
 * the finished page's party board: the top 10 + you, how many are watching now, and an invite.
 * stretches to its row's height. nobody here yet: the empty state and its call to action
 */
export function FinalPartyBoard({ room, matchId, me }: { room: RoomSummary; matchId: string | null; me: MeResponse | null }) {
  const [invite, setInvite] = useState(false);
  const rows = topWithYou(room.leaderboard);
  return (
    <SectionCard
      title={room.leaderboardTitle}
      action={<span className="text-xs text-muted">{room.leaderboardNote}</span>}
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col p-5"
    >
      {rows.length > 0 ? (
        <RoomLeaderboard rows={rows} />
      ) : (
        <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line px-4 py-6 text-center">
          <div>
            <Icon name="users" className="mx-auto size-7 text-muted" />
            <p className="mt-2 text-sm text-muted">{room.footnote ?? "Nobody here yet."}</p>
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm">
          <span aria-hidden className="size-2 rounded-full bg-good" />
          <span>
            <span className="font-bold tabular-nums">{fmtInt(room.watching)}</span> watching now
          </span>
        </p>
        <button type="button" onClick={() => setInvite(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
          <Icon name="friends" className="size-4" /> Invite
        </button>
      </div>
      <InviteModal open={invite} onClose={() => setInvite(false)} matchId={matchId} me={me} />
    </SectionCard>
  );
}
