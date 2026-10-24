import type { StakesStep } from "@/shared/types";

const W = 320;
const H = 96;
const PAD = { left: 16, right: 12, top: 18, bottom: 14 };

/** the playoff chance after each goal as a step line. one point per step, labelled */
export function StepChart({ steps }: { steps: StakesStep[] }) {
  if (steps.length === 0) return null;
  const values = steps.map((s) => s.chance);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, steps.length - 1);
  const y = (v: number) => PAD.top + ((max - v) * (H - PAD.top - PAD.bottom)) / Math.max(1, max - min);

  // horizontal at the old value, then vertical to the new one
  const d = steps.map((s, i) => (i === 0 ? `M ${x(0)} ${y(s.chance)}` : `H ${x(i)} V ${y(s.chance)}`)).join(" ");
  const summary = steps.map((s) => `${s.label} ${s.chance}%`).join(", ");

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Playoff chance by score: ${summary}`}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom + 4}
          y2={H - PAD.bottom + 4}
          className="stroke-line"
        />
        <path d={d} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" />
        {steps.map((s, i) => {
          const changed = i === 0 || s.chance !== steps[i - 1].chance;
          if (!changed) return null;
          const below = i === 0 || s.chance < steps[i - 1].chance;
          return (
            <g key={s.label}>
              <circle cx={x(i)} cy={y(s.chance)} r={4.5} className="fill-surface stroke-accent" strokeWidth={2} />
              <text
                x={x(i)}
                y={y(s.chance) + (below ? 15 : -9)}
                textAnchor="middle"
                className="fill-muted text-[10px] font-semibold tabular-nums"
              >
                {s.chance}%
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted" aria-hidden>
        {steps.map((s, i) => (
          <span key={s.label} className="flex items-center gap-2">
            {i > 0 && <span>→</span>}
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
