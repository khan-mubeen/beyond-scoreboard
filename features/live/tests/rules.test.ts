// call it!: when calls open, how they are decided, and the fairness rule (an event that decides a
// call while fans can still answer cancels it). plus every recorded game played through
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeGame, type GameDTO, type LiigaGame, type LiigaGoal, type LiigaPenalty, type Side } from "@/features/liiga";
import { gameAt, PERIOD, REGULATION, replayEnd } from "../engine/replay";
import { decidedInWindow, MIN_GAP_SECONDS, nextCall, resolve, type CallDraft, type ResolveRule } from "../engine/rules";

function game(t: number, opts: { goals?: [Side, number][]; penalties?: [Side, number, number?][]; status?: LiigaGame["status"]; decidedIn?: LiigaGame["decidedIn"] } = {}): LiigaGame {
  let home = 0;
  let away = 0;
  const goals: LiigaGoal[] = (opts.goals ?? []).map(([side, at]) => {
    if (side === "home") home++;
    else away++;
    return { id: `g${at}`, teamId: `${side}-id`, side, gameTime: at, period: Math.min(4, Math.ceil(at / PERIOD)), scorer: null, scorerId: null, assists: [], assistIds: [], types: [], homeScore: home, awayScore: away, winningGoal: false, videoUrl: null, thumbUrl: null };
  });
  const penalties: LiigaPenalty[] = (opts.penalties ?? []).map(([side, at, minutes = 2]) => ({
    id: `p${side}${at}`,
    teamId: `${side}-id`,
    side,
    gameTime: at,
    period: Math.ceil(at / PERIOD),
    minutes,
    begin: at,
    end: at + minutes * 60,
    fault: null,
    playerId: null,
  }));
  return {
    id: "2027-1",
    gameId: 1,
    season: 2027,
    start: "2026-10-24T15:30:00Z",
    status: opts.status ?? "live",
    decidedIn: opts.decidedIn ?? null,
    home: { teamId: "home-id", name: "Kärpät", logo: null, goals: home },
    away: { teamId: "away-id", name: "Tappara", logo: null, goals: away },
    currentPeriod: Math.max(1, Math.ceil(t / PERIOD)),
    gameTime: t,
    periods: [],
    spectators: null,
    rink: null,
    goals,
    penalties,
    powerPlay: null,
    video: null,
  };
}

const fresh = () => ({ lastOpenedAt: null as number | null, hasOpenCall: false, used: new Set<string>() });

describe("when a call opens", () => {
  it("asks who wins when the game starts, once", () => {
    const draft = nextCall(game(30), fresh());
    expect(draft?.kind).toBe("who_wins");
    expect(draft?.options.map((o) => o.id)).toEqual(["home_win", "home_ot", "away_ot", "away_win"]);
    expect(nextCall(game(30), { ...fresh(), used: new Set(["who_wins"]) })?.kind).not.toBe("who_wins");
    expect(nextCall(game(200), fresh())?.kind).not.toBe("who_wins");
  });

  it("opens one call at a time, 60 s of game time apart, only while live", () => {
    expect(nextCall(game(30), { ...fresh(), hasOpenCall: true })).toBeNull();
    expect(nextCall(game(100), { ...fresh(), lastOpenedAt: 100 - MIN_GAP_SECONDS + 1 })).toBeNull();
    expect(nextCall(game(100), { ...fresh(), lastOpenedAt: 100 - MIN_GAP_SECONDS })).not.toBeNull();
    expect(nextCall(game(30, { status: "scheduled" }), fresh())).toBeNull();
    expect(nextCall(game(3600, { status: "final", decidedIn: "regulation" }), fresh())).toBeNull();
  });

  it("asks about a power play right after a real penalty, for the team on it", () => {
    const used = new Set(["who_wins", "first_goal_period:1"]);
    const draft = nextCall(game(530, { penalties: [["away", 500]] }), { ...fresh(), used });
    expect(draft).toMatchObject({ kind: "power_play", trigger: "power_play:paway500", rule: { kind: "power_play", side: "home", until: 620 } });
    expect(draft?.vars.team).toBe("Kärpät");
    // offsetting minors are not a power play
    expect(nextCall(game(530, { penalties: [["away", 500], ["home", 500]] }), { ...fresh(), used })).toBeNull();
    // too late after the penalty, or a 10-minute misconduct
    expect(nextCall(game(570, { penalties: [["away", 500]] }), { ...fresh(), used })).toBeNull();
    expect(nextCall(game(530, { penalties: [["away", 500, 10]] }), { ...fresh(), used })).toBeNull();
  });

  it("asks if the other team answers after a goal, not late in the game", () => {
    const used = new Set(["who_wins", "first_goal_period:1"]);
    const draft = nextCall(game(830, { goals: [["home", 800]] }), { ...fresh(), used });
    expect(draft).toMatchObject({ kind: "answer_back", rule: { kind: "answer_back", side: "away" } });
    expect(nextCall(game(REGULATION - 100, { goals: [["home", REGULATION - 130]] }), { ...fresh(), used: new Set(["who_wins", "overtime"]) })).toBeNull();
  });

  it("asks about overtime late in a tied third, not in a game with a lead", () => {
    const used = new Set(["who_wins", "first_goal_period:3"]);
    expect(nextCall(game(REGULATION - 200, { goals: [["home", 100], ["away", 200]] }), { ...fresh(), used })?.kind).toBe("overtime");
    expect(nextCall(game(REGULATION - 200, { goals: [["home", 100]] }), { ...fresh(), used })).toBeNull();
  });

  it("asks who scores first at the start of a period with no goal yet", () => {
    const draft = nextCall(game(PERIOD + 60), { ...fresh(), used: new Set(["who_wins"]) });
    expect(draft).toMatchObject({ kind: "first_goal_period", rule: { kind: "first_goal_period", period: 2 } });
    expect(nextCall(game(PERIOD + 60, { goals: [["home", PERIOD + 20]] }), { ...fresh(), used: new Set(["who_wins", "answer_back:g1220"]) })).toBeNull();
  });
});

describe("how a call is decided (only events after the lock count)", () => {
  it("who wins: the final result, overtime for an overtime or shootout game, never cancelled", () => {
    const rule: ResolveRule = { kind: "who_wins" };
    expect(resolve(rule, game(3000, { goals: [["away", 100]] }), 50)).toBeNull();
    expect(resolve(rule, game(3600, { goals: [["away", 100]], status: "final", decidedIn: "regulation" }), 50)).toBe("away_win");
    expect(resolve(rule, game(3700, { goals: [["home", 3650]], status: "final", decidedIn: "overtime" }), 50)).toBe("home_ot");
    expect(decidedInWindow(rule, game(100, { goals: [["home", 60]] }), 30, 100)).toBe(false);
  });

  it("first goal of a period: cancelled by a goal in the answer window", () => {
    const rule: ResolveRule = { kind: "first_goal_period", period: 2 };
    expect(decidedInWindow(rule, game(1290, { goals: [["home", 1270]] }), 1260, 1280)).toBe(true);
    expect(decidedInWindow(rule, game(1400, { goals: [["home", 1300]] }), 1260, 1280)).toBe(false);
    expect(resolve(rule, game(1400, { goals: [["away", 1300]] }), 1280)).toBe("away");
    expect(resolve(rule, game(2000), 1280)).toBeNull();
    expect(resolve(rule, game(2400), 1280)).toBe("none");
  });

  it("power play: cancelled if the team scores or the penalty ends before the lock", () => {
    const rule: ResolveRule = { kind: "power_play", side: "home", until: 620 };
    expect(decidedInWindow(rule, game(530, { goals: [["home", 515]] }), 505, 525)).toBe(true);
    expect(decidedInWindow({ ...rule, until: 520 }, game(530), 505, 525)).toBe(true);
    // the other team scoring shorthanded decides nothing
    expect(decidedInWindow(rule, game(530, { goals: [["away", 515]] }), 505, 525)).toBe(false);
    expect(resolve(rule, game(600, { goals: [["home", 590]] }), 525)).toBe("yes");
    expect(resolve(rule, game(610), 525)).toBeNull();
    expect(resolve(rule, game(621), 525)).toBe("no");
  });

  it("answer back: cancelled when the answering team scores while answers are open", () => {
    const rule: ResolveRule = { kind: "answer_back", side: "away", window: 300 };
    expect(decidedInWindow(rule, game(840, { goals: [["home", 800], ["away", 835]] }), 820, 840)).toBe(true);
    expect(decidedInWindow(rule, game(840, { goals: [["home", 800], ["home", 835]] }), 820, 840)).toBe(false);
    expect(resolve(rule, game(1000, { goals: [["away", 900]] }), 840)).toBe("yes");
    expect(resolve(rule, game(1141), 840)).toBe("no");
  });

  it("overtime: any goal in the window cancels it; tied after 60 minutes is yes", () => {
    const rule: ResolveRule = { kind: "overtime" };
    const tied: [Side, number][] = [["home", 100], ["away", 200]];
    expect(decidedInWindow(rule, game(3420, { goals: [...tied, ["home", 3410]] }), 3400, 3420)).toBe(true);
    expect(decidedInWindow(rule, game(3420, { goals: tied }), 3400, 3420)).toBe(false);
    expect(resolve(rule, game(3500, { goals: tied }), 3420)).toBeNull();
    expect(resolve(rule, game(REGULATION, { goals: tied }), 3420)).toBe("yes");
    expect(resolve(rule, game(REGULATION, { goals: [...tied, ["away", 3500]] }), 3420)).toBe("no");
  });
});

// every recorded finished game, played second by second the way the engine does it
// (a replay runs at 1x while a call takes answers, so 20 s of answers is 20 s of game time)
interface Played {
  draft: CallDraft;
  openedAt: number;
  lockAt: number;
  status: "open" | "locked" | "resolved" | "cancelled";
  correct: string | null;
  /** when it stopped taking answers: the lock, or a cancel while open */
  closedAt: number | null;
}

function playThrough(full: LiigaGame, answerSeconds = 20): Played[] {
  const calls: Played[] = [];
  let lastOpenedAt: number | null = null;
  for (let t = 1; t <= replayEnd(full); t++) {
    const g = gameAt(full, t);
    for (const c of calls) {
      if (c.status === "open" && t >= c.lockAt) Object.assign(c, { status: "locked", closedAt: t });
      if (c.status !== "open" && c.status !== "locked") continue;
      if (decidedInWindow(c.draft.rule, g, c.openedAt, c.status === "open" ? t : c.lockAt)) {
        Object.assign(c, { status: "cancelled", closedAt: c.closedAt ?? t });
        continue;
      }
      const correct = c.status === "locked" ? resolve(c.draft.rule, g, c.lockAt) : null;
      if (correct) Object.assign(c, { status: "resolved", correct });
    }
    const draft = nextCall(g, { lastOpenedAt, hasOpenCall: calls.some((c) => c.status === "open"), used: new Set(calls.map((c) => c.draft.trigger)) });
    if (draft) {
      calls.push({ draft, openedAt: t, lockAt: t + answerSeconds, status: "open", correct: null, closedAt: null });
      lastOpenedAt = t;
    }
  }
  return calls;
}

const DIR = new URL("../../liiga/snapshots/", import.meta.url);
const finished = readdirSync(DIR)
  .filter((f) => /^games_\d+_\d+\.json$/.test(f))
  .map((f) => normalizeGame((JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { game: GameDTO }).game))
  .filter((g) => g.status === "final");

describe("calls over the recorded games", () => {
  const played = finished.map((g) => ({ g, calls: playThrough(g) }));

  it.each(played.map((p) => [p.g.id, p] as const))("%s: every call ends resolved or cancelled, one at a time", (_id, { g, calls }) => {
    expect(calls.length).toBeGreaterThan(2);
    for (const c of calls) {
      expect(["resolved", "cancelled"]).toContain(c.status);
      if (c.correct) expect(c.draft.options.map((o) => o.id)).toContain(c.correct);
    }
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].openedAt - calls[i - 1].openedAt).toBeGreaterThanOrEqual(MIN_GAP_SECONDS);
      expect(calls[i].openedAt).toBeGreaterThanOrEqual(calls[i - 1].closedAt ?? Infinity);
    }
    const whoWins = calls.find((c) => c.draft.kind === "who_wins");
    const home = g.home.goals > g.away.goals;
    const expected = g.decidedIn !== "regulation" ? (home ? "home_ot" : "away_ot") : home ? "home_win" : "away_win";
    expect(whoWins?.correct).toBe(expected);
  });

  it("few calls are cancelled, and a resolved answer never depends on the answer window", () => {
    const all = played.flatMap((p) => p.calls.map((c) => ({ ...c, g: p.g })));
    const cancelled = all.filter((c) => c.status === "cancelled").length;
    expect(cancelled / all.length).toBeLessThan(0.25);
    // flip every goal scored while answers were open: resolved calls keep their answer
    for (const c of all.filter((x) => x.status === "resolved" && x.draft.kind !== "who_wins")) {
      const flipped: LiigaGame = {
        ...c.g,
        goals: c.g.goals.map((x) => (x.gameTime > c.openedAt && x.gameTime <= c.lockAt ? { ...x, side: x.side === "home" ? ("away" as const) : ("home" as const) } : x)),
      };
      const final = gameAt(flipped, replayEnd(flipped));
      const decided = decidedInWindow(c.draft.rule, final, c.openedAt, c.lockAt);
      if (!decided) expect(resolve(c.draft.rule, final, c.lockAt)).toBe(c.correct);
    }
  });
});
