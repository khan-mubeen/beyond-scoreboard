import { motion } from "motion/react";

/** game seconds left before a call locks */
export function Countdown({
  locksAt,
  opensAt,
  gameTimeSeconds,
}: {
  locksAt: number;
  opensAt: number;
  gameTimeSeconds: number;
}) {
  const left = Math.max(0, locksAt - gameTimeSeconds);
  const share = Math.min(1, left / Math.max(1, locksAt - opensAt));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${share * 100}%` }}
          transition={{ ease: "linear", duration: 1 }}
        />
      </div>
      <span className="w-10 text-right font-mono text-sm tabular-nums">{left > 0 ? `${left}s` : "locked"}</span>
    </div>
  );
}
