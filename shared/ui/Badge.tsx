import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "bad" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  good: "bg-good/15 text-good",
  bad: "bg-bad/15 text-bad",
  accent: "bg-accent/15 text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
