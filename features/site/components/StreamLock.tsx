import { NAMES } from "@/shared/copy/names";
import type { LiveMatchDetail } from "@/shared/types";
import { Icon } from "./Icon";

export const FREE_NOTE = `${NAMES.call} and the season stakes are free for everyone.`;

/**
 * the live stream for fans without a plan that includes it: the poster, a lock, and the plan to
 * subscribe to. the server sends no video url in this case; buying refetches the page, which
 * then carries the stream. the checkout lives with the page (it outlasts this lock)
 */
export function StreamLock({ lock, onSubscribe, overlay }: { lock: NonNullable<LiveMatchDetail["streamLock"]>; onSubscribe: () => void; overlay?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-video overflow-hidden rounded-card bg-dark text-dark-ink shadow-card">
        {lock.poster && <img src={lock.poster} alt="" className="absolute inset-0 size-full object-cover opacity-50 blur-[1px]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/50 to-dark/30" />
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div className="flex max-w-md flex-col items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-dark-ink/15 ring-2 ring-dark-ink/40">
              <Icon name="lock" className="size-7" />
            </span>
            <p className="text-lg leading-snug font-bold md:text-2xl">Watch the game live with {lock.planName}</p>
            <p className="text-sm opacity-85">{lock.priceLabel} · pay part of it with your points</p>
            <button type="button" onClick={onSubscribe} className="flex h-11 items-center gap-2 rounded-lg bg-accent px-6 font-semibold text-accent-ink hover:brightness-110">
              Subscribe
            </button>
          </div>
        </div>
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
      </div>
      <p className="text-center text-sm font-semibold text-good">{FREE_NOTE}</p>
    </div>
  );
}
