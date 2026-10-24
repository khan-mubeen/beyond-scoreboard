import { QRCodeSVG } from "qrcode.react";
import type { RoomLeaderboardRow, RoomSummary } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ActionLink, Pill, SectionCard } from "./SectionCard";
import { Avatar } from "./TeamLogo";
import { useToast } from "./Toast";

/** the link phones open for a room, built from where this page is served */
export const roomUrl = (code: string) => `${window.location.origin}/room/${code}`;

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

/** who's watching in the room, invite and join, and the room leaderboard */
export function WatchTogetherCard({ room, onJoin, id }: { room: RoomSummary; onJoin: () => void; id?: string }) {
  const toast = useToast();

  async function invite() {
    try {
      await navigator.clipboard.writeText(roomUrl(room.code));
      toast("Room link copied");
    } catch {
      toast(`Share this link: ${roomUrl(room.code)}`);
    }
  }

  return (
    <SectionCard id={id} title="Watch Together" action={<Pill tone="outline">Room {room.code}</Pill>}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold tabular-nums">{fmtInt(room.watching)} watching</p>
          <p className="text-xs text-muted">{room.subtitle}</p>
        </div>
        <ActionLink onClick={invite}>
          Invite friends <Icon name="arrowUpRight" className="size-3.5" />
        </ActionLink>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center -space-x-1.5" aria-label={`${fmtInt(room.watching)} people in the room`}>
          {room.avatars.map((a, i) => (
            <span key={i} className="rounded-full ring-2 ring-surface">
              <Avatar src={a} name="" size={28} />
            </span>
          ))}
          {room.extraCount > 0 && (
            <span className="pl-3 text-xs font-semibold text-muted">+{fmtInt(room.extraCount)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onJoin}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
        >
          Join room
        </button>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between text-sm">
          <h3 className="font-semibold">{room.leaderboardTitle}</h3>
          <span className="text-xs text-muted">Live</span>
        </div>
        <div className="mt-1 mb-3 flex items-center justify-between text-xs text-muted">
          <span>{room.leaderboardNote}</span>
          <a href={`/room/${room.code}`} className="flex items-center gap-1 hover:text-ink">
            View standings <Icon name="arrowRight" className="size-3" />
          </a>
        </div>
        <RoomLeaderboard rows={room.leaderboard} />
      </div>
    </SectionCard>
  );
}

/** room code, a qr for phones, and links into the existing room pages */
export function JoinRoomModal({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const links = [
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
            <QRCodeSVG value={roomUrl(code)} size={176} title={`QR code for ${roomUrl(code)}`} />
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
