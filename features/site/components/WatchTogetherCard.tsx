import { QRCodeSVG } from "qrcode.react";
import type { RoomLeaderboardRow, RoomSummary } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ActionLink, Pill, SectionCard } from "./SectionCard";
import { Avatar } from "./TeamLogo";
import { useToast } from "./Toast";
import { NAMES } from "@/shared/copy/names";

/** the link phones open for a room, built from where this page is served */
export const roomUrl = (code: string, matchId?: string) =>
  matchId ? `${window.location.origin}/match/${matchId}?room=${code}` : `${window.location.origin}/room/${code}`;

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

/** who's watching in the room, invite and join, your place, and the room leaderboard */
export function WatchTogetherCard({
  room,
  onJoin,
  id,
  matchId,
  you = null,
  justJoined = false,
}: {
  room: RoomSummary;
  onJoin: () => void;
  id?: string;
  matchId?: string;
  /** set once the viewer has joined */
  you?: { rank: number | null; of: number } | null;
  /** someone joined a moment ago: the active highlight for a few seconds */
  justJoined?: boolean;
}) {
  const toast = useToast();

  async function invite() {
    const url = roomUrl(room.code, matchId);
    try {
      await navigator.clipboard.writeText(url);
      toast("Room link copied");
    } catch {
      toast(`Share this link: ${url}`);
    }
  }

  return (
    <SectionCard
      id={id}
      frame={justJoined ? "active" : "feature"}
      title={
        <span className="flex items-center gap-1.5">
          <Icon name="users" className="size-5 text-accent" />
          {NAMES.watchTogether}
        </span>
      }
      action={<Pill tone="outline">Room {room.code}</Pill>}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold tabular-nums" aria-live="polite">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            {fmtInt(room.watching)} watching
          </p>
          <p className="text-xs text-muted">{room.subtitle}</p>
        </div>
        <ActionLink onClick={invite}>
          Invite friends <Icon name="arrowUpRight" className="size-3.5" />
        </ActionLink>
      </div>
      <div className="mt-4 flex items-center -space-x-1.5" aria-label={`${fmtInt(room.watching)} people in the room`}>
        {room.avatars.map((a, i) => (
          <span key={i} className="rounded-full ring-2 ring-surface">
            <Avatar src={a} name="" size={30} />
          </span>
        ))}
        {room.extraCount > 0 && <span className="pl-3 text-xs font-semibold text-muted">+{fmtInt(room.extraCount)}</span>}
      </div>
      {you ? (
        <p className="mt-4 rounded-lg bg-accent-soft px-4 py-3 text-center font-semibold text-accent" aria-live="polite">
          {you.rank ? `You're #${you.rank} of ${fmtInt(you.of)}` : "You're in — answer a question to get on the board"}
        </p>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-accent-ink hover:brightness-110"
        >
          <Icon name="users" className="size-5" />
          Join room
        </button>
      )}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between text-sm">
          <h3 className="font-semibold">{room.leaderboardTitle}</h3>
          <span className="text-xs text-muted">Live</span>
        </div>
        <div className="mt-1 mb-3 flex items-center justify-between text-xs text-muted">
          <span>{room.leaderboardNote}</span>
          <a href={matchId ? "/leaderboard?scope=room" : `/room/${room.code}`} className="flex items-center gap-1 hover:text-ink">
            View full leaderboard <Icon name="arrowRight" className="size-3" />
          </a>
        </div>
        <RoomLeaderboard rows={room.leaderboard} />
      </div>
    </SectionCard>
  );
}

/**
 * room code and a qr for phones. for a real match both open the new match page with the room
 * (/match/<id>?room=<code>); the old /room pages stay as host and big-screen tools for the demo room
 */
export function JoinRoomModal({ code, matchId, open, onClose }: { code: string; matchId?: string; open: boolean; onClose: () => void }) {
  const url = roomUrl(code, matchId);
  const links = matchId
    ? [
        { href: `/match/${matchId}?room=${code}`, label: "Open on this device" },
        { href: `/match/${matchId}?host=1`, label: "Host controls" },
      ]
    : [
        { href: `/room/${code}`, label: "Open on this device" },
        { href: `/room/${code}/host`, label: "Host controls" },
        { href: `/room/${code}/screen`, label: "Big screen" },
      ];
  return (
    <Modal open={open} onClose={onClose} title={`Join room ${code}`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-3xl font-bold tracking-[0.3em]">{code}</p>
        {open && (
          <div className="rounded-lg border border-line bg-surface p-3">
            <QRCodeSVG value={url} size={176} title={`QR code for ${url}`} />
          </div>
        )}
        <p className="text-sm text-muted">Scan with your phone to join, or open the room here.</p>
        <ul className="flex w-full flex-col gap-2">
          {links.map((l, i) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={`flex h-11 items-center justify-center rounded-lg text-sm font-semibold ${
                  i === 0 ? "bg-accent text-accent-ink hover:brightness-110" : "border border-line hover:bg-surface-2"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
