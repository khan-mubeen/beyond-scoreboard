import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameOutcome, MatchPrediction, WhatIfGame, WhatIfOptions, WhatIfResult } from "@/shared/types";
import { postJson, predictApi, usePrediction } from "../data";
import { teamColors, tintVars } from "../team-colors";
import { relevantMetric, type ChanceMetric } from "@/features/stakes";
import { ArcGauge, MovingTable } from "./charts";
import { Icon } from "./Icon";
import { TeamLogo } from "./TeamLogo";
import { toast } from "./Toast";


const GAUGES: Record<ChanceMetric, { label: string; color: string }> = {
  playoffs: { label: "Playoffs", color: "var(--pp-zone-playoffs)" },
  top4: { label: "Top 4", color: "var(--pp-zone-top4)" },
  relegation: { label: "Relegation", color: "var(--pp-zone-relegated)" },
};
/**
 * the relevant chance first, then the other two: the one this game moves most (the server's, the
 * same as the stakes card), else what the picks moved most, else the team's level
 */
const gaugeOrder = (t: { before: Record<ChanceMetric, number>; after: Record<ChanceMetric, number> }, known?: ChanceMetric): ChanceMetric[] => {
  const metric = known ?? relevantMetric({ before: t.before, after: t.after }).metric;
  return [metric, ...(["playoffs", "top4", "relegation"] as const).filter((m) => m !== metric)];
};
/** the four results, from the home team's view */
const OUTCOMES: { outcome: GameOutcome; side: "home" | "away"; extra: boolean }[] = [
  { outcome: "regulationWin", side: "home", extra: false },
  { outcome: "overtimeWin", side: "home", extra: true },
  { outcome: "overtimeLoss", side: "away", extra: true },
  { outcome: "regulationLoss", side: "away", extra: false },
];
/**
 * one big result card: a light tint of the winning team's colour (stronger when selected, with a
 * 2px border in the full colour); the full colour only for the left bar, the logo ring and the
 * trophy or OT/SO badge. text stays dark ink
 */
function OutcomeCard({ game, o, selected, mine, onPick }: { game: WhatIfGame; o: (typeof OUTCOMES)[number]; selected: boolean; mine: boolean; onPick: () => void }) {
  const team = game[o.side];
  const c = teamColors(team);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`relative flex min-h-28 flex-col justify-between overflow-hidden rounded-card border-2 p-3 pl-4 text-left text-ink transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected ? "team-tint-strong" : "team-tint border-transparent hover:border-line"
      }`}
      style={{ ...tintVars(c), ...(selected && { borderColor: c.bg }) }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.bg }} />
      <span className="flex items-start justify-between gap-2">
        <span className="rounded-full p-0.5" style={{ background: c.bg }}>
          <TeamLogo team={team} size={32} className="bg-white" />
        </span>
        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-black tracking-wider" style={{ background: c.bg, color: c.fg }}>
          {o.extra ? "OT/SO" : <Icon name="trophy" className="size-4" label="In regulation" />}
        </span>
      </span>
      <span>
        <span className="block text-base leading-tight font-bold">{team.name} win</span>
        <span className="text-xs text-ink/75">{o.extra ? "in OT or a shootout" : "in regulation"}</span>
      </span>
      {mine && (
        <span className="mt-2 flex items-center gap-1 self-start rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink shadow">
          <Icon name="lock" className="size-3" /> Your prediction
        </span>
      )}
    </button>
  );
}

/** what the prediction bar says, for each state of the fan's one prediction */
function PredictionBar({ p, picked, busy, onLock }: { p: MatchPrediction | null; picked: GameOutcome | null; busy: boolean; onLock: () => void }) {
  if (!p) return null;
  const label = (id: string | null) => p.options.find((o) => o.id === id)?.label ?? "";
  const pickedOption = p.options.find((o) => o.outcome === picked);
  const box = "mt-3 flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm";
  if (p.status === "open" && !p.choice)
    return (
      <div className={`${box} border border-accent/30 bg-accent-soft`} data-testid="prediction-bar">
        <span className="min-w-60 flex-1">
          <span className="font-semibold">Make it your prediction:</span> {pickedOption ? pickedOption.label : "pick a result above"}.{" "}
          <span className="text-muted">One per match, locks when the game starts.</span>
        </span>
        <button
          type="button"
          disabled={!pickedOption || busy}
          onClick={onLock}
          className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50"
        >
          <Icon name="lock" className="size-4" /> {busy ? "Locking…" : `Lock it in · +${p.points} pts if right`}
        </button>
      </div>
    );
  if (p.status === "open" || p.status === "locked")
    return (
      <p className={`${box} bg-surface-2`} data-testid="prediction-bar">
        <Icon name="lock" className="size-4 text-accent" />
        <span>
          <span className="font-semibold">Your prediction: {label(p.choice)}</span> · +{p.points} pts if right · {p.status === "open" ? "locks when the game starts" : "locked, the game is on"}
        </span>
      </p>
    );
  if (p.status === "won")
    return (
      <p className={`${box} bg-good-soft font-semibold text-good`} data-testid="prediction-bar">
        <Icon name="check" className="size-4" /> You called it: {label(p.choice)} · +{p.points} pts
      </p>
    );
  if (p.status === "lost")
    return (
      <p className={`${box} bg-surface-2`} data-testid="prediction-bar">
        Not this time: you said {label(p.choice)}, it was {label(p.correctOptionId)}.
      </p>
    );
  if (p.status === "cancelled") return <p className={`${box} bg-surface-2 text-muted`}>This match's prediction was cancelled. No points either way.</p>;
  return <p className={`${box} bg-surface-2 text-muted`}>Predictions are closed for this game. You can still explore what if?</p>;
}

/** another game tonight as a compact chip: its four results as a segmented control */
/** "KÄR": the team's short code, so a chip never cuts a name at 390 or 1440 */
const abbrOf = (t: { abbr?: string; name: string }) => t.abbr ?? t.name.slice(0, 3).toUpperCase();

function GameChip({ g, value, disabled, onPick }: { g: WhatIfGame; value: GameOutcome | undefined; disabled: boolean; onPick: (o: GameOutcome | null) => void }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface p-2" title={`${g.home.name} – ${g.away.name} · ${g.when}`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <TeamLogo team={g.home} size={18} />
        <span>{abbrOf(g.home)}</span>
        <span className="text-muted">–</span>
        <span>{abbrOf(g.away)}</span>
        <TeamLogo team={g.away} size={18} />
        <span className="ml-auto truncate font-normal text-muted">{g.when}</span>
      </span>
      <span className="grid grid-cols-4 gap-1" role="group" aria-label={`${g.home.name} – ${g.away.name} result`}>
        {OUTCOMES.map((o) => {
          const on = value === o.outcome;
          const c = teamColors(g[o.side]);
          return (
            <button
              key={o.outcome}
              type="button"
              aria-pressed={on}
              disabled={disabled && !on}
              title={o.extra ? `${g[o.side].name} win in OT/SO` : `${g[o.side].name} win`}
              onClick={() => onPick(on ? null : o.outcome)}
              className={`h-7 rounded border px-1 text-[10px] font-bold whitespace-nowrap transition disabled:opacity-40 ${on ? "team-tint-strong text-ink" : "border-transparent bg-surface-2 text-muted hover:bg-line"}`}
              style={on ? { ...tintVars(c), borderColor: c.bg } : undefined}
            >
              {abbrOf(g[o.side])}
              {o.extra && " OT"}
            </button>
          );
        })}
      </span>
    </li>
  );
}

/**
 * "what if?" under the stakes card: big result cards for this match (and the fan's one match
 * prediction, +30 if right), the other games tonight as chips, then the playoff, top-4 and
 * relegation gauges against now and the table sliding into place. unset games are simulated
 */
export function WhatIfPanel({ options }: { options: WhatIfOptions }) {
  const match = options.games[0];
  const matchId = match.gameId;
  const prediction = usePrediction(matchId).data;
  // the fan's own picks; null: unset on purpose (cleared), so the prediction isn't filled back in
  const [own, setPicks] = useState<Record<string, GameOutcome | null>>({});
  const [result, setResult] = useState<{ key: string; data: WhatIfResult } | { key: string; error: string } | null>(null);
  const [focus, setFocus] = useState<string>(match.home.id);
  const [busy, setBusy] = useState(false);
  const predicted = prediction?.choice ? (prediction.options.find((o) => o.id === prediction.choice)?.outcome ?? null) : null;
  // the fan's prediction is where what if? starts
  const picks = useMemo(() => {
    const all: Record<string, GameOutcome | null> = predicted && own[matchId] === undefined ? { ...own, [matchId]: predicted } : own;
    return Object.fromEntries(Object.entries(all).filter((e): e is [string, GameOutcome] => e[1] !== null));
  }, [own, predicted, matchId]);
  const set = Object.keys(picks).length;
  const key = JSON.stringify(Object.entries(picks).sort());
  const latest = useRef(key);

  useEffect(() => {
    latest.current = key;
    // a short pause so a fan changing several picks sends one request (no picks: the season now)
    const t = setTimeout(async () => {
      const res = await postJson<WhatIfResult>("/api/site/whatif", { matchId, overrides: Object.entries(picks).map(([gameId, outcome]) => ({ gameId, outcome })) });
      if (latest.current !== key) return;
      setResult(res.ok ? { key, data: res.data } : { key, error: res.error });
    }, 250);
    return () => clearTimeout(t);
  }, [key, matchId, picks]);

  const shown = result && "data" in result ? result.data : null;
  const busyAsk = result?.key !== key;
  const pick = (gameId: string, o: GameOutcome | null) => setPicks((p) => ({ ...p, [gameId]: o }));

  async function lock() {
    const outcome = picks[matchId];
    const option = prediction?.options.find((o) => o.outcome === outcome);
    if (!option) return;
    setBusy(true);
    const r = await predictApi(matchId, option.id);
    setBusy(false);
    if (r.ok) toast(`Prediction locked: ${option.label} · +${r.data.points} pts if right`, { tone: "good" });
    else toast(r.error, { tone: "bad" });
  }

  const teams = shown?.teams ?? [];
  const focusTeam = teams.find((t) => t.team.id === focus) ?? teams[0];
  const color = focusTeam ? teamColors(focusTeam.team).bg : undefined;
  const highlight = useMemo(() => [match.home.id, match.away.id], [match.home.id, match.away.id]);
  const others = options.games.slice(1);

  return (
    <section aria-labelledby="what-if-title" className="mt-5 border-t border-line pt-4" data-testid="what-if">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="what-if-title" className="flex items-center gap-2 text-lg font-bold">
          <Icon name="sparkle" className="size-5 text-accent" /> What if?
        </h3>
        {set > 0 && (
          <button type="button" onClick={() => setPicks(Object.fromEntries(Object.keys(picks).map((id) => [id, null])))} className="text-sm font-semibold text-accent hover:underline">
            Clear
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Pick a result and watch the playoff race move. Games you don't pick play out in the simulation as usual.</p>

      <p className="mt-3 text-xs font-semibold tracking-wider text-muted uppercase">
        This match · {match.home.name} – {match.away.name} · {match.when}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        {OUTCOMES.map((o) => (
          <OutcomeCard key={o.outcome} game={match} o={o} selected={picks[matchId] === o.outcome} mine={predicted === o.outcome} onPick={() => pick(matchId, picks[matchId] === o.outcome ? null : o.outcome)} />
        ))}
      </div>
      <PredictionBar p={prediction} picked={picks[matchId] ?? null} busy={busy} onLock={() => void lock()} />

      {others.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold tracking-wider text-muted uppercase">Other games tonight</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((g) => (
              <GameChip key={g.gameId} g={g} value={picks[g.gameId]} disabled={set >= options.max && !picks[g.gameId]} onPick={(o) => pick(g.gameId, o)} />
            ))}
          </ul>
          {set >= options.max && <p className="mt-1 text-xs text-muted">Up to {options.max} results at once.</p>}
        </>
      )}

      <div aria-live="polite" className="mt-4">
        {result && "error" in result && <p className="text-sm text-bad">{result.error}</p>}
        {shown && focusTeam && (
          <div className={`grid gap-4 ${set ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
            {/* on a phone the gauges stay in view while the cards and table scroll */}
            <div className="sticky top-16 z-10 self-start rounded-card border border-line bg-surface p-3 shadow-card lg:static lg:shadow-none">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Team">
                {teams.slice(0, 6).map((t) => (
                  <button
                    key={t.team.id}
                    type="button"
                    role="tab"
                    aria-selected={t.team.id === focusTeam.team.id}
                    onClick={() => setFocus(t.team.id)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.team.id === focusTeam.team.id ? "bg-ink text-surface" : "bg-surface-2 hover:bg-line"}`}
                  >
                    <TeamLogo team={t.team} size={16} /> {t.team.name}
                  </button>
                ))}
              </div>
              <div className={`mt-2 grid grid-cols-3 gap-1 transition-opacity ${busyAsk ? "opacity-60" : ""}`}>
                {/* the team's most relevant chance first: relegation for a team out of the race, top 4 for one sure of the playoffs */}
                {gaugeOrder(focusTeam, options.metrics?.[focusTeam.team.id]).map((m) => (
                  <ArcGauge
                    key={m}
                    label={GAUGES[m].label}
                    value={focusTeam.after[m]}
                    before={focusTeam.before[m]}
                    higherIsBetter={m !== "relegation"}
                    color={m === "playoffs" ? color : GAUGES[m].color}
                    size={140}
                  />
                ))}
              </div>
              <p className="mt-1 text-center text-xs text-muted">{set ? "Faint arc: the chance now. Solid: with your picks." : "The season as it stands. Pick a result to see it move."}</p>
            </div>
            {/* the table now is the stakes card's, just above: this one shows only what your picks change */}
            {set > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">The table tonight with your results</p>
                <MovingTable rows={shown.table} highlight={highlight} caption="The table with the results you set" />
              </div>
            )}
          </div>
        )}
        <AnimatePresence>
          {busyAsk && set > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-muted">
              Working it out…
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
