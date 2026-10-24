import { useState } from "react";
import { NAMES } from "@/shared/copy/names";
import type { LiveMatchDetail } from "@/shared/types";
import { claimPassApi } from "../data";
import { Icon } from "./Icon";

export const FREE_NOTE = `${NAMES.call} and the season stakes are free for everyone.`;

/**
 * the live stream for fans without a plan that includes it: the poster, a lock, and the plan to
 * subscribe to. the server sends no video url in this case; buying refetches the page, which
 * then carries the stream. a fan with a guest pass from a friend's invite gets "Watch free":
 * the server binds the pass to this match and the page refetches with the stream. the checkout
 * lives with the page (it outlasts this lock)
 */
export function StreamLock({ lock, onSubscribe, overlay, matchId }: { lock: NonNullable<LiveMatchDetail["streamLock"]>; onSubscribe: () => void; overlay?: React.ReactNode; matchId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function watchFree() {
    if (!matchId) return;
    setBusy(true);
    const r = await claimPassApi(matchId);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }
  return (
    <div className="flex flex-col gap-1">
      {/* 4:3 on phones: the lock's text and button need the height a 16:9 box doesn't have there */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-dark text-dark-ink shadow-card sm:aspect-video" data-testid="stream-lock">
        {lock.poster && <img src={lock.poster} alt="" className="absolute inset-0 size-full object-cover opacity-50 blur-[1px]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/50 to-dark/30" />
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div className="mt-6 flex max-w-md flex-col items-center gap-2 sm:mt-0 sm:gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-dark-ink/15 ring-2 ring-dark-ink/40 sm:size-14">
              <Icon name={lock.guestPass ? "sparkle" : "lock"} className="size-5 sm:size-7" />
            </span>
            {lock.guestPass ? (
              <>
                <p className="text-base leading-snug font-bold sm:text-lg md:text-2xl" data-testid="guest-pass">
                  1 free live match from {lock.guestPass.from}
                </p>
                <p className="text-xs opacity-85 sm:text-sm">Use it on this match: it's yours until the match ends.</p>
                <button type="button" onClick={() => void watchFree()} disabled={busy} className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
                  <Icon name="play" className="size-4" /> {busy ? "Starting…" : "Watch free"}
                </button>
              </>
            ) : (
              <>
                <p className="text-base leading-snug font-bold sm:text-lg md:text-2xl">
                  {lock.passUsed ? `Your free match is used — get ${lock.planName}` : `Watch the game live with ${lock.planName}`}
                </p>
                <p className="text-xs opacity-85 sm:text-sm">{lock.priceLabel} · pay part of it with your points</p>
                <button type="button" onClick={onSubscribe} className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 font-semibold text-accent-ink hover:brightness-110">
                  Subscribe
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm font-semibold">
                {error}
              </p>
            )}
          </div>
        </div>
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
      </div>
      {/* dark text with a green check: green text alone is under 4.5:1 on white */}
      <p className="text-center text-sm font-semibold text-ink">
        <Icon name="check" className="mr-1 inline size-4 align-[-3px] text-good" />
        {FREE_NOTE}
      </p>
    </div>
  );
}
