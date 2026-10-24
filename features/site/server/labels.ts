// labels in Europe/Helsinki: "Today 17:00", "Tue 27 Oct 18:30", "Saturday 24 October 2026"
const TZ = "Europe/Helsinki";

const parts = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

export const timeLabel = (d: Date) => `${parts(d).hour}:${parts(d).minute}`;

/** "Today 17:00", "Yesterday", "Tomorrow 18:30", "Tue 27 Oct 18:30" */
export function whenLabel(startIso: string, now: Date, withTime = true): string {
  const d = new Date(startIso);
  const day = dayKey(d);
  const p = parts(d);
  const t = withTime ? ` ${p.hour}:${p.minute}` : "";
  if (day === dayKey(now)) return `Today${t}`;
  if (day === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  if (day === dayKey(new Date(now.getTime() + 86_400_000))) return `Tomorrow${t}`;
  return `${p.weekday} ${p.day} ${p.month}${t}`;
}

/** "Saturday 24 October 2026" */
export const longDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);

/** "Sat 24 Oct 2026" */
export const shortDate = (d: Date) => {
  const p = parts(d);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
};

/** monday 00:00 helsinki time of the week containing `d`, as an instant */
export function weekStart(d: Date): Date {
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const offsetMs = local.getTime() - d.getTime();
  const daysSinceMonday = (local.getDay() + 6) % 7;
  const mondayLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate() - daysSinceMonday);
  return new Date(mondayLocal.getTime() - offsetMs);
}

const PERIOD_NAMES = ["", "1st period", "2nd period", "3rd period", "Overtime", "Shootout"];
export const periodName = (p: number) => PERIOD_NAMES[p] ?? `Period ${p}`;

/** game seconds -> "11:40" elapsed in its period */
export function clockIn(gameTime: number, period: number): string {
  const s = Math.max(0, gameTime - (Math.min(period, 4) - 1) * 1200);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const pct = (x: number) => Math.round(x * 100);
