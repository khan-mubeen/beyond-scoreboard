import { useEffect, useRef, useState } from "react";
import type { GameOutcome, WhatIfGame, WhatIfOptions, WhatIfResult } from "@/shared/types";
import { postJson } from "../data";
import { ChangeTag } from "./StakesChip";

/** the four results, from the home team's view */
const RESULTS = (g: WhatIfGame): [GameOutcome, string][] => [
  ["regulationWin", `${g.home.name} win`],
  ["overtimeWin", `${g.home.name} win in overtime`],
  ["overtimeLoss", `${g.away.name} win in overtime`],
  ["regulationLoss", `${g.away.name} win`],
];

/**
 * "what if?" under the stakes card: set this match's result and up to three other games on the
 * same date, see each team's playoff chance move. the games left unset are simulated
 */
export function WhatIfPanel({ options }: { options: WhatIfOptions }) {
  const [picks, setPicks] = useState<Record<string, GameOutcome>>({});
  const [result, setResult] = useState<{ key: string; data: WhatIfResult } | { key: string; error: string } | null>(null);
  const matchId = options.games[0].gameId;
  const set = Object.keys(picks).length;
  const key = JSON.stringify(Object.entries(picks).sort());
  const latest = useRef(key);

  useEffect(() => {
    latest.current = key;
    if (set === 0) return;
    // a short pause so a fan changing several picks sends one request
    const t = setTimeout(async () => {
      const res = await postJson<WhatIfResult>("/api/site/whatif", { matchId, overrides: Object.entries(picks).map(([gameId, outcome]) => ({ gameId, outcome })) });
      if (latest.current !== key) return;
      setResult(res.ok ? { key, data: res.data } : { key, error: res.error });
    }, 250);
    return () => clearTimeout(t);
  }, [key, set, matchId, picks]);

  const shown = set > 0 && result?.key === key ? result : null;
  const busy = set > 0 && !shown;

  return (
    <section aria-labelledby="what-if-title" className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="what-if-title" className="font-semibold">
          What if?
        </h3>
        {set > 0 && (
          <button type="button" onClick={() => setPicks({})} className="text-sm font-semibold text-accent hover:underline">
            Clear
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Pick results and see how the playoff race changes. Games you don't pick play out in the simulation as usual.</p>

      <ul className="mt-3 flex flex-col gap-2">
        {options.games.map((g, i) => {
          const full = set >= options.max && !picks[g.gameId];
          return (
            <li key={g.gameId} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center sm:gap-3">
              <label htmlFor={`whatif-${g.gameId}`} className="text-sm">
                <span className="font-semibold">
                  {i === 0 && "This match: "}
                  {g.home.name} – {g.away.name}
                </span>
                <span className="text-muted"> · {g.when}</span>
              </label>
              <select
                id={`whatif-${g.gameId}`}
                value={picks[g.gameId] ?? ""}
                disabled={full}
                onChange={(e) =>
                  setPicks((p) => {
                    const next = { ...p };
                    if (e.target.value) next[g.gameId] = e.target.value as GameOutcome;
                    else delete next[g.gameId];
                    return next;
                  })
                }
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{full ? `Up to ${options.max} results` : "Not set"}</option>
                {RESULTS(g).map(([o, label]) => (
                  <option key={o} value={o}>
                    {label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="mt-3">
        {busy && <p className="text-sm text-muted">Working it out…</p>}
        {shown && "error" in shown && <p className="text-sm text-bad">{shown.error}</p>}
        {shown && "data" in shown && (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {shown.data.teams.map((t) => (
              <li key={t.team.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <span className="font-semibold">{t.team.name}</span>
                <span className="tabular-nums">
                  Playoffs {t.before.playoffs}% → <span className="font-semibold">{t.after.playoffs}%</span> <ChangeTag change={t.after.playoffs - t.before.playoffs} />
                  {t.after.top4 !== t.before.top4 && (
                    <span className="text-muted">
                      {" "}
                      · Top 4 {t.before.top4}% → {t.after.top4}%
                    </span>
                  )}
                  {t.after.relegation !== t.before.relegation && (
                    <span className="text-muted">
                      {" "}
                      · Relegation {t.before.relegation}% → {t.after.relegation}%
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
