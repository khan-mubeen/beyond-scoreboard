import { describe, expect, it } from "vitest";
import { mockHome } from "@/shared/mock/site";
import { findMatch } from "../data";
import { fmtChange, ordinal, periodScoresText } from "../format";

describe("site data", () => {
  it("serves the live and the finished match by id", () => {
    expect(findMatch("karpat-assat-live")?.status).toBe("live");
    expect(findMatch("karpat-assat-final")?.status).toBe("final");
    expect(findMatch("nope")).toBeNull();
  });

  it("never sends the call answer inside the public call", () => {
    const live = findMatch("karpat-assat-live");
    expect(live?.status === "live" && "correctOptionId" in live.callIt.call).toBe(false);
  });

  it("only uses placeholder images", () => {
    const paths = JSON.stringify(mockHome).match(/"\/[^"]+\.(svg|png|jpe?g|webp)"/g) ?? [];
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(p).toMatch(/^"\/placeholders\//);
  });

  it("the liiga table has every zone and a highlighted team", () => {
    const zones = new Set(mockHome.table.rows.map((r) => r.zone));
    expect([...zones]).toEqual(["top4", "playoffs", "safe", "relegated"]);
    expect(mockHome.table.rows.some((r) => r.teamId === mockHome.table.highlightTeamId)).toBe(true);
  });
});

describe("site format", () => {
  it("formats changes, ordinals and period scores", () => {
    expect(fmtChange(12)).toBe("+12");
    expect(fmtChange(-9)).toBe("−9");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(22)).toBe("22nd");
    expect(periodScoresText([{ home: 1, away: 0 }, { home: 1, away: 1 }, null])).toBe("(1–0, 1–1, –)");
  });
});
