// reaction bursts floating up over the page for a couple of seconds, on every screen in the party
// (tv mode too). only bursts newer than a few seconds float; each one once. reduced motion: a
// short fade in place instead of the rise
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Burst } from "@/shared/types";
import { useServerNow } from "../data";

const SHOW_MS = 2600;
/** a burst that came by polling can be a few seconds late: still worth a float */
const VISIBLE_MS = 4500;

/** a stable spot across the screen for a burst id */
const lane = (id: string) => 8 + ([...id].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5) % 76);

export function BurstLayer({ bursts, big = false }: { bursts: Burst[]; big?: boolean }) {
  // the server's clock: a burst floats from when it arrives until a few seconds after it was sent
  const now = useServerNow(250);
  const still = useReducedMotion();
  const live = bursts.filter((b) => now - b.at < VISIBLE_MS).slice(-24);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" data-testid="burst-layer">
      <AnimatePresence>
        {live.map((b) => (
          <motion.div
            key={b.id}
            className="absolute bottom-24 flex flex-col items-center"
            style={{ left: `${lane(b.id)}%` }}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={still ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], y: big ? -420 : -300, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: SHOW_MS / 1000, ease: "easeOut" }}
            data-testid="burst"
          >
            <span className={big ? "text-7xl" : "text-4xl"}>{b.emoji}</span>
            <span
              className={`rounded-full bg-dark/75 px-2 py-0.5 font-semibold text-dark-ink ${big ? "text-lg" : "text-[11px]"}`}
            >
              {b.name}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
