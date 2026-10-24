import { fmtClock } from "../format";

/** a red ring that empties as the seconds run out */
export function CountdownRing({ seconds, total, size = 56 }: { seconds: number; total: number; size?: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? seconds / total : 0;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={seconds > 0 ? `${seconds} seconds left` : "Time is up"}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" className="stroke-accent-soft" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
        />
      </svg>
      <span className="relative text-[13px] font-bold tabular-nums">{fmtClock(seconds)}</span>
    </div>
  );
}
