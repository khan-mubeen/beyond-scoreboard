// the kaleva.fi spotlight's show rule (demo or ?tour=1: every load; otherwise once per visitor)
// and the line under a your call! question (the most relevant chance; no line when nothing moves)
import { afterEach, describe, expect, it } from "vitest";
import type { GameOutcome } from "@/shared/types";
import { markSpotlightSeen, shouldShowSpotlight, spotlightSeen } from "../components/spotlight-rule";
import type { GameStakes } from "../server/game-stakes";
import { stakesLineFor } from "../server/stakes-line";

describe("spotlight: when it shows", () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  afterEach(() => store.clear());

  it("demo mode or ?tour=1: every time, seen or not", () => {
    for (const seen of [false, true]) {
      expect(shouldShowSpotlight({ demo: true, tour: false, seen })).toBe(true);
      expect(shouldShowSpotlight({ demo: false, tour: true, seen })).toBe(true);
    }
  });

  it("otherwise once per visitor", () => {
    expect(shouldShowSpotlight({ demo: false, tour: false, seen: spotlightSeen() })).toBe(true);
    markSpotlightSeen();
    expect(shouldShowSpotlight({ demo: false, tour: false, seen: spotlightSeen() })).toBe(false);
  });

  it("blocked storage: shown, never throws", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(spotlightSeen()).toBe(false);
    expect(() => markSpotlightSeen()).not.toThrow();
  });
});

type C = { playoffs: number; top4: number; relegation: number };
const ch = (c: C) => ({ ...c, positions: [] });
function stakes(home: Record<GameOutcome, C>, away: Record<GameOutcome, C>): GameStakes {
  const map = (w: Record<GameOutcome, C>) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, ch(v)])) as unknown as GameStakes["worth"]["home"];
  return { baseline: { home: ch(home.regulationWin), away: ch(away.regulationWin) }, worth: { home: map(home), away: map(away) }, otRate: { home: 0.5, away: 0.5 }, table: [] };
}
const flat = (c: C): Record<GameOutcome, C> => ({ regulationWin: c, overtimeWin: c, overtimeLoss: c, regulationLoss: c });
const game = (home: number, away: number) =>
  ({ status: "live", decidedIn: null, home: { name: "Ilves", goals: home, teamId: "h" }, away: { name: "HIFK", goals: away, teamId: "a" } }) as never;

describe("your call!: the stakes line", () => {
  // Ilves are sure of the playoffs (99% whatever happens); their top-4 chance is what moves
  const sure = { regulationWin: { playoffs: 0.99, top4: 0.62, relegation: 0 }, overtimeWin: { playoffs: 0.99, top4: 0.55, relegation: 0 }, overtimeLoss: { playoffs: 0.99, top4: 0.5, relegation: 0 }, regulationLoss: { playoffs: 0.99, top4: 0.41, relegation: 0 } };
  const calm = flat({ playoffs: 0.5, top4: 0.1, relegation: 0.02 });

  it("uses the most relevant chance, not a playoff chance stuck at 99%", () => {
    const line = stakesLineFor(stakes(sure, calm), game(1, 1), { kind: "answer_back", side: "home", window: 300 }, "home");
    expect(line).toBe("An Ilves goal now would lift Ilves's top-4 chance to 62%.");
    expect(line).not.toContain("keep");
    expect(stakesLineFor(stakes(sure, calm), game(0, 0), { kind: "who_wins" }, "home")).toBe("A regulation win would take Ilves to a 62% top-4 chance (41% with a loss).");
  });

  it("no line when no chance moves by at least 1 percentage point", () => {
    const still = stakes(flat({ playoffs: 0.99, top4: 0.7, relegation: 0 }), flat({ playoffs: 0.4, top4: 0.05, relegation: 0.1 }));
    expect(stakesLineFor(still, game(2, 0), { kind: "power_play", side: "home", until: 120 }, "home")).toBeNull();
    expect(stakesLineFor(still, game(1, 1), { kind: "who_wins" }, "home")).toBeNull();
    expect(stakesLineFor(still, game(1, 1), { kind: "overtime" }, "home")).toBeNull();
    // already 2-0 up: one more goal changes nothing that's shown
    expect(stakesLineFor(stakes(sure, calm), game(2, 0), { kind: "power_play", side: "home", until: 120 }, "home")).toBeNull();
  });

  it("a relegation fight speaks of the relegation chance", () => {
    const low = { regulationWin: { playoffs: 0, top4: 0, relegation: 0.2 }, overtimeWin: { playoffs: 0, top4: 0, relegation: 0.25 }, overtimeLoss: { playoffs: 0, top4: 0, relegation: 0.3 }, regulationLoss: { playoffs: 0, top4: 0, relegation: 0.38 } };
    expect(stakesLineFor(stakes(calm, low), game(0, 0), { kind: "who_wins" }, "away")).toBe("A regulation loss would leave HIFK with a 38% relegation chance (20% with a win).");
    expect(stakesLineFor(stakes(calm, low), game(1, 1), { kind: "power_play", side: "away", until: 120 }, "away")).toBe("An HIFK goal now would cut HIFK's relegation chance to 20%.");
  });
});
