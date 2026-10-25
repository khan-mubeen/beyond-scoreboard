// the line under a your call! question: what the moment means for the team it matters most to,
// in that team's most relevant chance (playoff, top-4 or relegation: metricFor). a line that
// moves nothing ("would keep Ilves's playoff chance at 99%") says nothing, so it is left out:
// no chance moves by at least 1 percentage point, no line. pure, so it can be tested
import type { LiigaGame } from "@/features/liiga";
import type { CallDraft } from "@/features/live/server";
import { ifEndsNow, metricNoun, type ChanceMetric } from "@/features/stakes/server";
import { checkText } from "@/shared/guardrails";
import { fixArticles } from "@/shared/copy/articles";
import { metricFor, type GameStakes } from "./game-stakes";
import { pct } from "./labels";

type Side = "home" | "away";
type Game = Pick<LiigaGame, "status" | "decidedIn" | "home" | "away">;

/** less than this, in shown percentage points, is no movement */
const MIN_MOVE = 1;
const METRICS: ChanceMetric[] = ["playoffs", "top4", "relegation"];

/** the relevant metric first, then the others: the first that moves at least 1 point */
function moving(relevant: ChanceMetric, move: (m: ChanceMetric) => number): ChanceMetric | null {
  return [relevant, ...METRICS.filter((m) => m !== relevant)].find((m) => move(m) >= MIN_MOVE) ?? null;
}

export function stakesLineFor(s: GameStakes, game: Game, rule: CallDraft["rule"], fav: Side): string | null {
  // the team this game matters most to: the widest win/loss gap in its own relevant chance
  const gap = (x: Side) => {
    const m = metricFor(s, x, game).metric;
    return Math.abs(s.worth[x].regulationWin[m] - s.worth[x].regulationLoss[m]) + (x === fav ? 1e-6 : 0);
  };
  const side: Side = gap("home") >= gap("away") ? "home" : "away";
  const relevant = metricFor(s, side, game).metric;
  const team = game[side].name;
  const worth = s.worth[side];
  const own = (sc: { home: number; away: number }) => (side === "home" ? sc.home : sc.away);
  const opp = (sc: { home: number; away: number }) => (side === "home" ? sc.away : sc.home);
  const score = { home: game.home.goals, away: game.away.goals };
  const ifNow = (sc: { home: number; away: number }) => ifEndsNow(worth, own(sc), opp(sc), s.otRate[side]);

  let line: string | null = null;
  if (rule.kind === "who_wins") {
    const m = moving(relevant, (x) => Math.abs(pct(worth.regulationWin[x]) - pct(worth.regulationLoss[x])));
    if (m) {
      line =
        m === "relegation"
          ? `A regulation loss would leave ${team} with a ${pct(worth.regulationLoss.relegation)}% relegation chance (${pct(worth.regulationWin.relegation)}% with a win).`
          : `A regulation win would take ${team} to a ${pct(worth.regulationWin[m])}% ${metricNoun(m)} (${pct(worth.regulationLoss[m])}% with a loss).`;
    }
  } else if (rule.kind === "overtime") {
    const ot = (x: ChanceMetric) => worth.overtimeWin[x] * s.otRate[side] + worth.overtimeLoss[x] * (1 - s.otRate[side]);
    const now = ifNow(score);
    const m = moving(relevant, (x) => Math.abs(pct(ot(x)) - pct(now[x])));
    if (m) line = `Overtime would put ${team}'s ${metricNoun(m)} at ${pct(ot(m))}%.`;
  } else {
    const scorer: Side = rule.kind === "power_play" || rule.kind === "answer_back" ? rule.side : side;
    const next = { home: score.home + (scorer === "home" ? 1 : 0), away: score.away + (scorer === "away" ? 1 : 0) };
    const now = ifNow(score);
    const after = ifNow(next);
    // compared as shown: 99% -> 99% moves nothing
    const m = moving(relevant, (x) => Math.abs(pct(after[x]) - pct(now[x])));
    if (m) {
      const up = pct(after[m]) > pct(now[m]);
      const verb = m === "relegation" ? (up ? "raise" : "cut") : up ? "lift" : "drop";
      line = `A ${game[scorer].name} goal now would ${verb} ${team}'s ${metricNoun(m)} to ${pct(after[m])}%.`;
    }
  }
  return line && !checkText(line).length ? fixArticles(line) : null;
}
