// the one "most relevant chance" rule: playoff, relegation or top 4, whichever this game moves most
import { describe, expect, it } from "vitest";
import { relevantMetric, type Chances } from "../engine/metric";

const c = (playoffs: number, relegation: number, top4: number): Chances => ({ playoffs, relegation, top4 });
const worth = (win: Chances, loss: Chances) => ({ regulationWin: win, overtimeWin: win, overtimeLoss: loss, regulationLoss: loss });

describe("relevantMetric", () => {
  it("a team with no playoff chance: relegation", () => {
    expect(relevantMetric({ worth: worth(c(0, 0.18, 0), c(0, 0.31, 0)), before: c(0, 0.24, 0) }).metric).toBe("relegation");
  });
  it("a team sure of the playoffs: top 4", () => {
    expect(relevantMetric({ worth: worth(c(0.99, 0, 0.62), c(0.99, 0, 0.41)), before: c(0.99, 0, 0.5) })).toEqual({ metric: "top4", label: "Top-4 chance" });
  });
  it("a team in the race: playoffs", () => {
    expect(relevantMetric({ worth: worth(c(0.72, 0.01, 0.1), c(0.51, 0.02, 0.05)) })).toEqual({ metric: "playoffs", label: "Playoff chance" });
  });
  it("a finished game: the chance that moved most before → after", () => {
    expect(relevantMetric({ worth: worth(c(0.7, 0, 0.3), c(0.5, 0, 0.1)), before: c(0.99, 0.0, 0.4), after: c(0.99, 0, 0.55) }).metric).toBe("top4");
  });
  it("nothing moves: the level decides, also on a 0-100 scale", () => {
    expect(relevantMetric({ before: c(0, 0, 0) }).metric).toBe("relegation");
    expect(relevantMetric({ before: c(100, 0, 100) }).metric).toBe("top4");
    expect(relevantMetric({ before: c(55, 3, 10) }).metric).toBe("playoffs");
  });
});
