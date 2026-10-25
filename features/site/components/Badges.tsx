// achievements as medals: a disc in its tier colour (bronze, silver, gold) with its own glyph.
// locked: grey, with a ring that fills as the fan gets closer (x/y). unlocked: full colour, a
// slow shine (off with reduced motion) and the date. its own look, apart from the offer cards
import type { AchievementItem } from "@/shared/types";

const TIERS: Record<AchievementItem["tier"], { light: string; dark: string; rim: string; label: string }> = {
  bronze: { light: "#f0b27a", dark: "#a8622b", rim: "#7c4519", label: "Bronze" },
  silver: { light: "#eef1f5", dark: "#9aa4b1", rim: "#6b7480", label: "Silver" },
  gold: { light: "#ffe28a", dark: "#d19a00", rim: "#946c00", label: "Gold" },
};

/** each badge's glyph, drawn in a 24 x 24 box, white on the medal */
function Glyph({ id }: { id: string }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  switch (id) {
    case "first-call":
      return (
        <g {...p}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" />
        </g>
      );
    case "called-it":
      return <path {...p} strokeWidth={2.6} d="M5 12.5l4.5 4.5L19 7.5" />;
    case "loyal-fan":
      return <path {...p} d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.6 12 19 12 19z" />;
    case "team-player":
      return (
        <g {...p}>
          <circle cx="9" cy="9" r="3" />
          <circle cx="16.5" cy="10" r="2.4" />
          <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.6c.7-.4 1.3-.6 2-.6 2.2 0 3.7 1.6 4 4.4" />
        </g>
      );
    case "century":
      return (
        <text
          x="12"
          y="15.6"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="800"
          fill="currentColor"
          fontFamily="system-ui, sans-serif"
        >
          100
        </text>
      );
    case "sharp-eye":
      return (
        <g {...p}>
          <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
          <circle cx="12" cy="12" r="2.8" />
        </g>
      );
    case "hot-streak":
      return (
        <path
          {...p}
          d="M12 20c-3.6 0-6-2.4-6-5.6 0-3.4 3-5 3.4-8.4 2.4 1.4 3.6 3.4 3.6 5.2 1-.6 1.6-1.8 1.8-3 1.8 1.6 3.2 3.6 3.2 6.2 0 3.2-2.4 5.6-6 5.6z"
        />
      );
    case "regular":
      return (
        <g {...p}>
          <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
          <path d="M8 3.5v4M16 3.5v4M4 10h16M8.5 14.5l2 2 4-4" />
        </g>
      );
    default:
      return <path {...p} d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />;
  }
}

/** the medal: a disc in the tier's colours, its glyph, and (locked) a ring with the progress */
export function Medal({ a, size = 96 }: { a: AchievementItem; size?: number }) {
  const t = TIERS[a.tier];
  const gid = `medal-${a.id}-${size}`;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const frac = a.progress.need ? a.progress.have / a.progress.need : 0;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={a.unlocked ? "" : "grayscale"}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={t.light} />
            <stop offset="1" stopColor={t.dark} />
          </linearGradient>
        </defs>
        {/* the track; locked medals fill it with their progress */}
        <circle cx="50" cy="50" r={r} fill="none" stroke={a.unlocked ? t.rim : "var(--pp-line)"} strokeWidth="6" />
        {!a.unlocked && frac > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--pp-muted)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${circ * frac} ${circ}`}
            transform="rotate(-90 50 50)"
          />
        )}
        <circle cx="50" cy="50" r="36" fill={`url(#${gid})`} opacity={a.unlocked ? 1 : 0.45} />
        <circle cx="50" cy="50" r="31" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
        <svg
          x="30"
          y="30"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          className={a.unlocked ? "text-white" : "text-white/90"}
        >
          <Glyph id={a.id} />
        </svg>
      </svg>
      {/* a slow light sweep across unlocked medals; none with reduced motion */}
      {a.unlocked && <span aria-hidden className="badge-shine pointer-events-none absolute inset-0 rounded-full" />}
    </span>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Helsinki",
  });

/** one badge in the grid: the medal, its name, what it takes, and the date or x/y */
export function BadgeTile({ a }: { a: AchievementItem }) {
  return (
    <li
      className={`flex flex-col items-center gap-2 rounded-card border bg-surface p-4 text-center shadow-card ${a.unlocked ? "border-line" : "border-dashed border-line"}`}
      data-testid="badge"
      data-unlocked={a.unlocked ? "true" : "false"}
    >
      <Medal a={a} />
      <h3 className={`text-sm font-bold ${a.unlocked ? "" : "text-muted"}`}>{a.title}</h3>
      <p className="text-xs text-muted">{a.description}</p>
      <p className="mt-auto text-xs font-semibold tabular-nums">
        {a.unlocked ? (
          <span className="text-good">{a.unlockedAt ? `Unlocked ${fmtDate(a.unlockedAt)}` : "Unlocked"}</span>
        ) : (
          <span className="text-muted">
            {a.progress.have}/{a.progress.need} · {TIERS[a.tier].label}
          </span>
        )}
      </p>
      <span className="sr-only">{a.unlocked ? "Unlocked" : `Locked, ${a.progress.have} of ${a.progress.need}`}</span>
    </li>
  );
}

/** what the closest locked badge still needs: "Answer 1 question to unlock First call" */
export function nextUpText(a: AchievementItem): string {
  const n = a.progress.need - a.progress.have;
  const s = (word: string) => (n === 1 ? word : `${word}s`);
  const what: Record<string, string> = {
    "first-call": `Answer ${n} ${s("question")}`,
    "called-it": `Get ${n} ${s("call")} right`,
    "loyal-fan": "Follow a team",
    "team-player": "Join a Watch Party",
    century: `Earn ${n} more points`,
    "sharp-eye": `Get ${n} more right ${s("call")} in one match`,
    "hot-streak": `Get ${n} more right ${s("call")} in a row`,
    regular: `Play along in ${n} more ${n === 1 ? "match" : "matches"}`,
  };
  return `${what[a.id] ?? a.description} to unlock ${a.title}`;
}

/** the locked badge closest to done (by share of the way there), easier tiers first on a tie */
export function nextUp(list: AchievementItem[]): AchievementItem | null {
  const order = { bronze: 0, silver: 1, gold: 2 };
  return (
    list
      .filter((a) => !a.unlocked)
      .sort(
        (x, y) =>
          y.progress.have / y.progress.need - x.progress.have / x.progress.need || order[x.tier] - order[y.tier],
      )[0] ?? null
  );
}

/** the summary: a ring with "1 of 8 unlocked", and the next badge with what it needs */
export function BadgeSummary({ list }: { list: AchievementItem[] }) {
  const done = list.filter((a) => a.unlocked).length;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const next = nextUp(list);
  return (
    <section
      aria-label="Your badges"
      className="grid gap-5 rounded-card border border-line bg-surface p-5 shadow-card md:grid-cols-[auto_minmax(0,1fr)] md:items-center"
    >
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" width="88" height="88" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--pp-surface-2)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="var(--pp-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(circ * done) / Math.max(1, list.length)} ${circ}`}
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--pp-ink)">
            {done}/{list.length}
          </text>
        </svg>
        <div>
          <p className="text-2xl font-bold" data-testid="badges-unlocked">
            {done} of {list.length} unlocked
          </p>
          <p className="text-sm text-muted">Bronze, silver and gold, by how hard they are.</p>
        </div>
      </div>
      {next ? (
        <div className="flex items-center gap-4 rounded-lg bg-surface-2 p-3 md:justify-self-end">
          <Medal a={next} size={64} />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Next up</p>
            <p className="font-semibold" data-testid="badge-next">
              {nextUpText(next)}
            </p>
          </div>
        </div>
      ) : (
        <p className="font-semibold text-good md:justify-self-end">Every badge unlocked. Well played.</p>
      )}
    </section>
  );
}
