import { QRCodeSVG } from "qrcode.react";
import type { LiveRotation, MatchSummary } from "@/shared/types";
import { fmtCountdown, useServerNow } from "../data";
import { TeamLogo } from "./TeamLogo";
import { roomUrl } from "./WatchTogetherCard";

/** the rotation's lobby: who plays, "Starting soon" with a countdown, and the room's qr code */
export function LobbyStage({ match, rotation, roomCode, tv = false }: { match: MatchSummary; rotation: LiveRotation; roomCode: string; tv?: boolean }) {
  const now = useServerNow(500);
  const url = roomUrl(roomCode, match.id);
  return (
    <section
      aria-label="Starting soon"
      className={`grid items-center gap-6 rounded-card bg-dark p-6 text-dark-ink shadow-card md:grid-cols-[1fr_auto] ${tv ? "min-h-[60vh] p-10" : ""}`}
    >
      <div>
        <p className={`font-bold tracking-wider text-accent uppercase ${tv ? "text-2xl" : "text-sm"}`}>Starting soon</p>
        <div className={`mt-3 flex items-center gap-4 font-bold ${tv ? "text-5xl" : "text-2xl"}`}>
          <TeamLogo team={match.home} size={tv ? 96 : 48} />
          <span>
            {match.home.name} <span className="opacity-60">vs</span> {match.away.name}
          </span>
          <TeamLogo team={match.away} size={tv ? 96 : 48} />
        </div>
        <p className={`mt-4 tabular-nums ${tv ? "text-6xl font-black" : "text-3xl font-bold"}`} role="timer" aria-live="off">
          {rotation.paused ? "Paused" : fmtCountdown(rotation.phaseEndsAt - now)}
        </p>
        <p className={`mt-2 opacity-90 ${tv ? "text-2xl" : "text-sm"}`}>Make your first call now: who wins? Answers close when the game starts.</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-lg bg-surface p-3">
          <QRCodeSVG value={url} size={tv ? 320 : 160} title={`QR code for ${url}`} />
        </div>
        <p className={`font-semibold ${tv ? "text-2xl" : "text-sm"}`}>Scan to play along</p>
        <p className="font-mono text-xs opacity-80">Room {roomCode}</p>
      </div>
    </section>
  );
}
