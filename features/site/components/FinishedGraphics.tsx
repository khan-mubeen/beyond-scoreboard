// the finished match page's graphics: what the game meant for the season (gauge + the table
// moving), the game in one chart (goals on one axis, the playoff-chance steps over them), shots and
// puck control per period, the player of the game, and "next time"
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { zoneForRank } from "@/features/stakes";
import type { FinishedInsights, GoalMarker, NextTimePanel as NextTime, TeamRef, VideoInfo } from "@/shared/types";
import { ordinal } from "../format";
import { setReminderApi } from "../data";
import { teamColors } from "../team-colors";
import { ArcGauge, FormStrip, MirroredBars, MovingTable, type MovingRow } from "./charts";
import { FollowButton } from "./Follow";
import { Icon } from "./Icon";
import { Pill, SectionCard } from "./SectionCard";
import { ChangeTag } from "./StakesChip";
import { InitialAvatar, TeamLogo } from "./TeamLogo";
import { toast } from "./Toast";

/** a player's photo from the liiga api, else their initials */
function Face({ photo, initials, name, size = 56 }: { photo: string | null; initials: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!photo || broken) return <InitialAvatar name={initials || name} size={size} />;
  return <img src={photo} alt={name} width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full bg-surface-2 object-cover object-top" style={{ width: size, height: size }} />;
}

/** the table around the team, first as it stood, then sliding into tonight's places */
function TableMove({ rows, teamIds }: { rows: FinishedInsights["impact"]["table"]; teamIds: string[] }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAfter(true), 900);
    return () => clearTimeout(t);
  }, []);
  const focus = rows.find((r) => r.team.id === teamIds[0]);
  const lo = Math.max(1, Math.min(focus?.rank ?? 1, focus?.rankBefore ?? 1) - 2);
  const hi = Math.min(rows.length, Math.max(focus?.rank ?? 5, focus?.rankBefore ?? 5) + 2);
  const shown: MovingRow[] = useMemo(() => {
    const list = after
      ? rows.filter((r) => r.rank >= lo && r.rank <= hi)
      : [...rows]
          .sort((a, b) => a.rankBefore - b.rankBefore)
          .filter((r) => r.rankBefore >= lo && r.rankBefore <= hi)
          .map((r) => ({ ...r, rank: r.rankBefore, points: r.pointsBefore, zone: zoneForRank(r.rankBefore) }));
    return list;
  }, [after, rows, lo, hi]);
  return <MovingTable rows={shown} highlight={teamIds} caption={after ? "The table after the game" : "The table before the game"} />;
}

/** what the game did to the season: the playoff chance (before -> after) and the table */
export function SeasonImpact({ insights }: { insights: FinishedInsights }) {
  const { impact, focus } = insights;
  const change = impact.chanceAfter - impact.chanceBefore;
  const moved = impact.rankBefore - impact.rankAfter;
  const c = teamColors(focus.team);
  return (
    <SectionCard title="Season impact" action={<Pill tone="outline">From league data · scenario model</Pill>} className="h-full">
      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <ArcGauge value={impact.chanceAfter} before={impact.chanceBefore} label={`${focus.team.name} · playoff chance`} color={c.bg} size={230} />
          <p className="text-sm">
            <span className="font-semibold">{impact.chanceBefore}%</span> before <Icon name="arrowRight" className="inline size-3.5" label="to" /> <span className="font-semibold">{impact.chanceAfter}%</span> after{" "}
            <ChangeTag change={change} />
          </p>
          <p className="text-sm text-muted">
            {ordinal(impact.rankBefore)} <Icon name="arrowRight" className="inline size-3.5" label="to" /> <span className="font-semibold text-ink">{ordinal(impact.rankAfter)}</span>
            {moved !== 0 && <span className={moved > 0 ? "text-good" : "text-bad"}> ({moved > 0 ? `up ${moved}` : `down ${-moved}`})</span>}
          </p>
        </div>
        <TableMove rows={impact.table} teamIds={[focus.team.id]} />
      </div>
    </SectionCard>
  );
}

const W = 640;
const H = 210;
const LEFT = 28;
const RIGHT = 12;
const AXIS = 112;

/** one goal, tapped: the scorer (photo), time, score, and what it did to the chance */
function GoalCard({ goal, focusName, onWatch, onClose }: { goal: GoalMarker; focusName: string; onWatch: (v: VideoInfo) => void; onClose: () => void }) {
  const delta = goal.chanceBefore !== null && goal.chanceAfter !== null ? goal.chanceAfter - goal.chanceBefore : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface-2 p-3"
      role="region"
      aria-label={`Goal ${goal.score}`}
      data-testid="goal-card"
    >
      <Face photo={goal.photo} initials={goal.initials} name={goal.scorer ?? goal.team.name} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          <TeamLogo team={goal.team} size={20} /> {goal.scorer ?? goal.team.name} <span className="tabular-nums">· {goal.score}</span>
        </p>
        <p className="text-sm text-muted">
          {goal.time}
          {goal.kind ? ` · ${goal.kind}` : ""}
          {goal.assists.length ? ` · Assists: ${goal.assists.join(", ")}` : ""}
        </p>
        {delta !== null && (
          <p className="mt-1 text-sm">
            {focusName} playoff chance {goal.chanceBefore}% → <span className="font-semibold">{goal.chanceAfter}%</span> <ChangeTag change={delta} />
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {goal.video && (goal.video.src || goal.video.href) && (
          <button type="button" onClick={() => onWatch(goal.video!)} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink">
            <Icon name="play" className="size-3.5" /> Watch
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg border border-line">
          <Icon name="close" className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * the game in one chart: the three periods on one axis, home goals above it and away goals
 * below in team colours, and the focus team's playoff chance as a step line behind them
 */
export function GameChart({ insights, home, away, onWatch }: { insights: FinishedInsights; home: TeamRef; away: TeamRef; onWatch: (v: VideoInfo) => void }) {
  const { game, focus } = insights;
  const [open, setOpen] = useState<string | null>(null);
  const x = (s: number) => LEFT + (Math.min(s, game.endSeconds) * (W - LEFT - RIGHT)) / game.endSeconds;
  const y = (chance: number) => 14 + ((100 - chance) * (H - 34)) / 100;
  const line = game.steps.map((p, i) => (i === 0 ? `M ${x(0)} ${y(p.chance)}` : `H ${x(p.seconds)} V ${y(p.chance)}`)).join(" ") + ` H ${x(game.endSeconds)}`;
  const periods = [0, 1200, 2400, 3600, ...(game.endSeconds > 3600 ? [game.endSeconds] : [])];
  const chosen = game.goals.find((g) => g.id === open) ?? null;
  const last = game.steps[game.steps.length - 1];
  return (
    <SectionCard title="The game in one chart" action={<span className="text-xs text-muted">Tap a goal</span>}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: teamColors(home).bg }} aria-hidden />
          {home.name} goals above the line
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: teamColors(away).bg }} aria-hidden />
          {away.name} below
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" aria-hidden /> {focus.team.name} playoff chance
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`Goals: ${game.goals.map((g) => `${g.time} ${g.team.name} ${g.score}`).join(", ") || "none"}. ${focus.team.name}'s playoff chance went from ${game.steps[0]?.chance}% to ${last?.chance}%.`}>
        {/* the periods */}
        {periods.slice(0, -1).map((p, i) => (
          <g key={p}>
            <rect x={x(p)} y={6} width={x(periods[i + 1]) - x(p)} height={H - 22} className={i % 2 ? "fill-surface-2/60" : "fill-transparent"} />
            <text x={(x(p) + x(periods[i + 1])) / 2} y={H - 4} textAnchor="middle" className="fill-muted text-[10px] font-semibold">
              {i < 3 ? `${ordinal(i + 1)} period` : "OT"}
            </text>
          </g>
        ))}
        {[25, 50, 75].map((v) => (
          <text key={v} x={2} y={y(v) + 3} className="fill-muted text-[9px]">
            {v}%
          </text>
        ))}
        <line x1={LEFT} x2={W - RIGHT} y1={AXIS} y2={AXIS} className="stroke-ink/40" strokeWidth={1.5} />
        <motion.path d={line} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
        <text x={W - RIGHT} y={y(last?.chance ?? 0) - 6} textAnchor="end" className="fill-accent text-[11px] font-bold">
          {last?.chance}%
        </text>
        {game.goals.map((g) => {
          const c = teamColors(g.team);
          const cy = g.side === "home" ? AXIS - 30 : AXIS + 30;
          const on = open === g.id;
          return (
            <g
              key={g.id}
              role="button"
              tabIndex={0}
              aria-label={`${g.time}, ${g.team.name} goal ${g.score}${g.scorer ? ` by ${g.scorer}` : ""}`}
              aria-pressed={on}
              onClick={() => setOpen(on ? null : g.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(on ? null : g.id);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-accent"
            >
              <line x1={x(g.seconds)} x2={x(g.seconds)} y1={AXIS} y2={cy} stroke={c.bg} strokeWidth={2} />
              <circle cx={x(g.seconds)} cy={cy} r={on ? 15 : 12} fill={c.bg} stroke={on ? "var(--pp-ink)" : "white"} strokeWidth={on ? 3 : 2} />
              <text x={x(g.seconds)} y={cy + 3.5} textAnchor="middle" fill={c.fg} className="pointer-events-none text-[9px] font-bold">
                {g.score}
              </text>
            </g>
          );
        })}
      </svg>
      <AnimatePresence>{chosen && <GoalCard key={chosen.id} goal={chosen} focusName={focus.team.name} onWatch={onWatch} onClose={() => setOpen(null)} />}</AnimatePresence>
      {!game.goals.length && <p className="text-sm text-muted">No goals in regulation or overtime.</p>}
    </SectionCard>
  );
}

/** shots per period (mirrored) and puck control per period, where the feed has them */
export function PeriodsPanel({ insights, home, away }: { insights: FinishedInsights; home: TeamRef; away: TeamRef }) {
  const shots = insights.periods.filter((p) => p.shots).map((p) => ({ label: p.label, home: p.shots!.home, away: p.shots!.away }));
  const control = insights.periods.filter((p) => p.control);
  if (!shots.length && !control.length) return null;
  const hc = teamColors(home).bg;
  const ac = teamColors(away).bg;
  return (
    <SectionCard title="Shots and momentum">
      {shots.length > 0 && (
        <>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Shots on goal per period</h3>
          <MirroredBars rows={shots} home={{ name: home.name, color: hc }} away={{ name: away.name, color: ac }} />
        </>
      )}
      {control.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Time with the puck</h3>
          <ul className="flex flex-col gap-1.5">
            {control.map((p) => (
              <li key={p.label} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 text-xs tabular-nums">
                <span className="text-muted">{p.label}</span>
                <span className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={`${p.label}: ${home.name} ${p.control!.home}%, ${away.name} ${p.control!.away}%`}>
                  <motion.span className="flex items-center pl-2 font-bold text-white" style={{ background: hc }} initial={{ width: "50%" }} animate={{ width: `${p.control!.home}%` }} transition={{ duration: 0.6 }}>
                    {p.control!.home}%
                  </motion.span>
                  <span className="flex flex-1 items-center justify-end pr-2 font-bold text-white" style={{ background: ac }}>
                    {p.control!.away}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

/** the player with the most points tonight: photo, tonight, the season, one fact */
export function PlayerOfGame({ player }: { player: NonNullable<FinishedInsights["playerOfGame"]> }) {
  const c = teamColors(player.team);
  return (
    <SectionCard title="Player of the game">
      <div className="flex items-center gap-4">
        <div className="rounded-full p-1" style={{ background: c.bg }}>
          <Face photo={player.photo} initials={player.initials} name={player.name} size={84} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold">{player.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <TeamLogo team={player.team} size={18} /> {player.team.name}
          </p>
          {player.note && <Pill tone="accent" className="mt-2">{player.note}</Pill>}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-xs text-muted">Tonight</dt>
          <dd className="text-2xl font-black tabular-nums">
            {player.goals} G + {player.assists} A
          </dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-xs text-muted">Season{player.season ? `, ${player.season.games} games` : ""}</dt>
          <dd className="text-2xl font-black tabular-nums">{player.season ? `${player.season.goals} G + ${player.season.assists} A` : "—"}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

/** "next time": the next game, what it's worth, the head-to-head, both teams' form, a player to watch */
export function NextTimePanel({ next, focus }: { next: NextTime; focus: FinishedInsights["focus"] }) {
  const [reminded, setReminded] = useState(false);
  const vs = next.home ? `${focus.team.name} vs ${next.opponent.name}` : `${next.opponent.name} vs ${focus.team.name}`;
  async function remind() {
    const on = !reminded;
    const r = await setReminderApi(next.matchId, on);
    if (!r.ok) return toast("Couldn't save the reminder, try again", { tone: "bad" });
    setReminded(on);
    toast(on ? `We'll remind you before ${vs}` : "Reminder removed");
  }
  const w = next.worth;
  return (
    <section aria-labelledby="next-time" className="flex h-full flex-col gap-4 rounded-card border-2 border-accent/30 bg-gradient-to-br from-accent-soft to-surface p-5 shadow-card" data-testid="next-time">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-accent uppercase">Next time</p>
          <h2 id="next-time" className="mt-1 flex items-center gap-2 text-xl font-bold">
            <TeamLogo team={focus.team} size={30} />
            <span className="text-muted">{next.home ? "vs" : "at"}</span>
            <TeamLogo team={next.opponent} size={30} /> {next.opponent.name}
          </h2>
          <p className="text-sm text-muted">{next.when}</p>
        </div>
        <a href={`/match/${next.matchId}`} className="flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
          Match preview <Icon name="arrowRight" className="size-4" />
        </a>
      </div>

      {w && (
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">What it's worth for {focus.team.name}</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-good-soft p-2">
              <p className="text-xs text-muted">With a win</p>
              <p className="text-xl font-black text-good tabular-nums">{w.win}%</p>
            </div>
            <div className="rounded-lg bg-surface p-2 ring-1 ring-line">
              <p className="text-xs text-muted">Now</p>
              <p className="text-xl font-black tabular-nums">{w.now}%</p>
            </div>
            <div className="rounded-lg bg-live-soft p-2">
              <p className="text-xs text-muted">With a loss</p>
              <p className="text-xl font-black text-bad tabular-nums">{w.loss}%</p>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">Playoff chance · a win and a loss are {w.win - w.loss} percentage points apart</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">This season, head to head</h3>
          {next.headToHead.length ? <FormStrip results={next.headToHead.map((h) => ({ result: h.result, title: `${h.date}: ${h.score}` }))} label={`${focus.team.name} against ${next.opponent.name} this season`} /> : <p className="text-sm text-muted">First meeting this season</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Last 5</h3>
          {next.form.map((f) => (
            <span key={f.team.id} className="flex items-center gap-2">
              <TeamLogo team={f.team} size={20} />
              <FormStrip results={f.results} label={`${f.team.name} last ${f.results.length}`} />
            </span>
          ))}
        </div>
      </div>

      {next.playerToWatch && (
        <div className="flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-line">
          <Face photo={next.playerToWatch.photo} initials={next.playerToWatch.initials} name={next.playerToWatch.name} size={48} />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Player to watch</p>
            <p className="font-bold">
              {next.playerToWatch.name} <span className="font-normal text-muted">· {next.playerToWatch.team.name}</span>
            </p>
            <p className="text-sm">🔥 {next.playerToWatch.note}</p>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={reminded}
          onClick={() => void remind()}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${reminded ? "border border-good bg-good-soft text-good" : "bg-accent text-accent-ink hover:brightness-110"}`}
        >
          <Icon name="bell" className="size-4" />
          {reminded ? "Reminder set" : "Set reminder"}
        </button>
        <FollowButton teamId={next.followTeamId} name={focus.team.name} />
      </div>
    </section>
  );
}
