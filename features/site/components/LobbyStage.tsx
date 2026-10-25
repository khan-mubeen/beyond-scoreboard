import type { LiveRotation, MatchSummary, MeResponse } from "@/shared/types";
import { fmtCountdown, useServerNow } from "../data";
import { joinUrl } from "./JoinAt";
import { TeamLogo } from "./TeamLogo";

/** the rotation's lobby: who plays, "Starting soon" with a countdown; the tv adds "Join at …" in big type */
export function LobbyStage({ match, rotation, tv = false, me = null }: { match: MatchSummary; rotation: LiveRotation; tv?: boolean; me?: MeResponse | null }) {
  const now = useServerNow(500);
  return (
    <section
      aria-label="Starting soon"
      className={`grid items-center gap-6 rounded-card bg-dark p-6 text-dark-ink shadow-card ${tv ? "min-h-[60vh] p-10" : ""}`}
    >
      <div>
        <p className={`font-bold tracking-wider text-live-bright uppercase ${tv ? "text-2xl" : "text-sm"}`}>Starting soon</p>
        <div className={`mt-3 flex flex-wrap items-center gap-4 font-bold ${tv ? "text-5xl" : "text-2xl"}`}>
          <TeamLogo team={match.home} size={tv ? 96 : 48} />
          <span>
            {match.home.name} <span className="opacity-60">vs</span> {match.away.name}
          </span>
          <TeamLogo team={match.away} size={tv ? 96 : 48} />
        </div>
        <p className={`mt-4 tabular-nums ${tv ? "text-6xl font-black" : "text-3xl font-bold"}`} role="timer" aria-live="off">
          {rotation.paused ? "Paused" : fmtCountdown(rotation.phaseEndsAt - now)}
        </p>
        <p className={`mt-2 opacity-90 ${tv ? "text-2xl" : "text-sm"}`}>Make your match prediction now: who wins? +30 pts if right, one per match. It locks when the game starts.</p>
        {tv && (
          <p className="mt-8 text-5xl font-bold break-all" data-testid="join-at">
            Join at <span className="font-mono text-live-bright">{joinUrl(me)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
