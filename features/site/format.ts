import type { Score } from "@/shared/types";

const nf = new Intl.NumberFormat("en-US");

/** 1250 -> "1,250" */
export const fmtInt = (n: number) => nf.format(n);

/** +12 -> "+12", -9 -> "−9" (a real minus sign) */
export const fmtChange = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0");

/** 13 -> "13th" */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "2 – 1" */
export const scoreText = (s: Score) => `${s.home} – ${s.away}`;

/** "(1–0, 1–1, –)" */
export const periodScoresText = (periods: (Score | null)[]) =>
  periods.length ? `(${periods.map((p) => (p ? `${p.home}–${p.away}` : "–")).join(", ")})` : "";

/** a team's page: "495643563:kärpät" -> "/teams/k%C3%A4rp%C3%A4t" (the slug reads well and is unique) */
export const teamHref = (teamId: string) => `/teams/${encodeURIComponent(teamId.split(":")[1] ?? teamId)}`;

/** 42 -> "00:42" */
export const fmtClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
