// pure: when a call opens, how it is decided, and when an event in the answer window cancels it.
// fairness against api delay: only events with gameTime > lock_game_time count; an event that
// would decide the call with gameTime between open and lock cancels it (no points)
import type { LiigaGame, Side } from "@/features/liiga";
import { PERIOD, REGULATION } from "./replay";

export type CallKind = "who_wins" | "first_goal_period" | "power_play" | "answer_back" | "overtime";

export type ResolveRule =
  | { kind: "who_wins" }
  | { kind: "first_goal_period"; period: number }
  | { kind: "power_play"; side: Side; until: number }
  | { kind: "answer_back"; side: Side; window: number }
  | { kind: "overtime" };

export interface CallDraft {
  kind: CallKind;
  /** unique per match, so a trigger fires once even across restarts */
  trigger: string;
  rule: ResolveRule;
  options: { id: string; label: string }[];
  /** names for the question template */
  vars: Record<string, string>;
}

export const MIN_GAP_SECONDS = 60;
export const ANSWER_BACK_WINDOW = 300;

const other = (s: Side): Side => (s === "home" ? "away" : "home");
const yesNo = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

export interface TriggerContext {
  /** game time the last call opened, null if none yet */
  lastOpenedAt: number | null;
  /** a call is currently taking answers */
  hasOpenCall: boolean;
  /** triggers already used in this match */
  used: Set<string>;
}

/**
 * "who wins?": the match prediction (one per fan, match and rotation cycle, see prediction.ts).
 * four outcomes from the home team's view; made before the game (what if?, the rotation's
 * lobby), locked when it starts, decided by the final result
 */
export function whoWinsDraft(g: Pick<LiigaGame, "home" | "away">): CallDraft {
  const names = { home: g.home.name, away: g.away.name };
  return {
    kind: "who_wins",
    trigger: "who_wins",
    rule: { kind: "who_wins" },
    options: [
      { id: "home_win", label: `${names.home} win` },
      { id: "home_ot", label: `${names.home} win in OT/SO` },
      { id: "away_ot", label: `${names.away} win in OT/SO` },
      { id: "away_win", label: `${names.away} win` },
    ],
    vars: names,
  };
}

/** the call to open now, if any: at most one open, 60 s of game time apart, each trigger once */
export function nextCall(g: LiigaGame, ctx: TriggerContext): CallDraft | null {
  if (g.status !== "live" || ctx.hasOpenCall) return null;
  const t = g.gameTime;
  if (ctx.lastOpenedAt !== null && t - ctx.lastOpenedAt < MIN_GAP_SECONDS) return null;
  const fresh = (key: string) => !ctx.used.has(key);
  const names = { home: g.home.name, away: g.away.name };
  const score = { home: g.home.goals, away: g.away.goals };

  // the game starts: who wins?
  if (t <= 120 && fresh("who_wins")) return whoWinsDraft(g);

  // late in the third and tied: overtime?
  if (t >= REGULATION - 300 && t < REGULATION - 30 && score.home === score.away && fresh("overtime")) {
    return { kind: "overtime", trigger: "overtime", rule: { kind: "overtime" }, options: yesNo, vars: names };
  }

  // a new 2- or 5-minute penalty that gives a real power play
  // not in the last minute of regulation (or overtime): the answers would still be open at the horn
  const pen = t < REGULATION - 60 ? [...g.penalties].reverse().find((p) => (p.minutes === 2 || p.minutes === 5) && t - p.gameTime <= 60 && p.end > t) : undefined;
  if (pen && fresh(`power_play:${pen.id}`)) {
    const offsetting = g.penalties.some((p) => p.side !== pen.side && p.gameTime === pen.gameTime && p.minutes === pen.minutes);
    const pp = other(pen.side);
    if (!offsetting) {
      return {
        kind: "power_play",
        trigger: `power_play:${pen.id}`,
        rule: { kind: "power_play", side: pp, until: pen.end },
        options: yesNo,
        vars: { ...names, team: g[pp].name },
      };
    }
  }

  // a goal: will the other team answer within 5 minutes?
  const goal = g.goals.at(-1);
  if (goal && goal.period <= 3 && t - goal.gameTime <= 90 && t < REGULATION - 120 && fresh(`answer_back:${goal.id}`)) {
    const side = other(goal.side);
    return {
      kind: "answer_back",
      trigger: `answer_back:${goal.id}`,
      rule: { kind: "answer_back", side, window: ANSWER_BACK_WINDOW },
      options: yesNo,
      vars: { ...names, team: g[side].name, other: g[side].name, scorer: g[goal.side].name },
    };
  }

  // period start: who scores first this period?
  const period = Math.ceil(Math.max(t, 1) / PERIOD);
  const periodStart = (period - 1) * PERIOD;
  if (period <= 3 && t - periodStart <= 180 && !g.goals.some((x) => x.period === period) && fresh(`first_goal_period:${period}`)) {
    return {
      kind: "first_goal_period",
      trigger: `first_goal_period:${period}`,
      rule: { kind: "first_goal_period", period },
      options: [
        { id: "home", label: names.home },
        { id: "away", label: names.away },
        { id: "none", label: "No goal" },
      ],
      vars: { ...names, period: String(period) },
    };
  }
  return null;
}

const goalsIn = (g: LiigaGame, from: number, to: number) => g.goals.filter((x) => x.gameTime > from && x.gameTime <= to);

/** the correct option once the game decides it, else null. only events after the lock count */
export function resolve(rule: ResolveRule, g: LiigaGame, lockGameTime: number): string | null {
  const t = g.gameTime;
  const done = g.status === "final";
  switch (rule.kind) {
    case "who_wins": {
      if (!done) return null;
      const home = g.home.goals > g.away.goals;
      if (g.decidedIn === "regulation") return home ? "home_win" : "away_win";
      return home ? "home_ot" : "away_ot";
    }
    case "first_goal_period": {
      const first = g.goals.find((x) => x.period === rule.period && x.gameTime > lockGameTime);
      if (first) return first.side;
      return t >= rule.period * PERIOD || done ? "none" : null;
    }
    case "power_play":
      if (goalsIn(g, lockGameTime, rule.until).some((x) => x.side === rule.side)) return "yes";
      return t > rule.until || done ? "no" : null;
    case "answer_back": {
      const until = lockGameTime + rule.window;
      if (goalsIn(g, lockGameTime, until).some((x) => x.side === rule.side)) return "yes";
      return t > until || done ? "no" : null;
    }
    case "overtime": {
      if (t < REGULATION && !done) return null;
      const reg = g.goals.filter((x) => x.gameTime <= REGULATION);
      const h = reg.filter((x) => x.side === "home").length;
      return h === reg.length - h ? "yes" : "no";
    }
  }
}

/**
 * true when something that decides the call happened while fans could still answer
 * (gameTime between open and lock). such a call is cancelled
 */
export function decidedInWindow(rule: ResolveRule, g: LiigaGame, openedGameTime: number, lockGameTime: number): boolean {
  const window = goalsIn(g, openedGameTime, lockGameTime);
  switch (rule.kind) {
    case "who_wins":
      return false;
    case "first_goal_period":
      return window.some((x) => x.period === rule.period);
    case "power_play":
      return window.some((x) => x.side === rule.side) || rule.until <= lockGameTime;
    case "answer_back":
      return window.some((x) => x.side === rule.side);
    case "overtime":
      return window.length > 0 || lockGameTime >= REGULATION;
  }
}
