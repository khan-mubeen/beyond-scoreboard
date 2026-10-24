import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHome, mockMatchLive } from "@/shared/mock/site";
import { load, readCache } from "../data";
import { fmtChange, ordinal, periodScoresText, teamHref } from "../format";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("site data cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a failed first request is an error state, never mock data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await load("/api/site/home?t=1");
    expect(readCache("/api/site/home?t=1")).toEqual({ data: null, status: "error", source: null });
  });

  it("keeps the last good data when a refresh fails (stale while revalidate)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ hero: "ok", source: "live", asOf: "x" })));
    await load("/api/site/home?t=2");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await load("/api/site/home?t=2");
    expect(readCache("/api/site/home?t=2")).toMatchObject({ status: "ready", data: { hero: "ok" } });
  });

  it("a 404 is not found, and one request runs at a time per url", async () => {
    const fetch = vi.fn(async () => json({ error: "match not found" }, 404));
    vi.stubGlobal("fetch", fetch);
    await Promise.all([load("/api/site/matches/2027-1"), load("/api/site/matches/2027-1")]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readCache("/api/site/matches/2027-1")?.status).toBe("notfound");
  });
});

describe("site mocks (VITE_USE_MOCKS=true only)", () => {
  it("never send the call answer inside the public call", () => {
    expect(mockMatchLive.callIt && "correctOptionId" in mockMatchLive.callIt.call).toBe(false);
  });

  it("only use placeholder images", () => {
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
  it("formats changes, ordinals, period scores and team links", () => {
    expect(fmtChange(12)).toBe("+12");
    expect(fmtChange(-9)).toBe("−9");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(22)).toBe("22nd");
    expect(periodScoresText([{ home: 1, away: 0 }, { home: 1, away: 1 }, null])).toBe("(1–0, 1–1, –)");
    expect(teamHref("495643563:kärpät")).toBe("/teams/k%C3%A4rp%C3%A4t");
  });
});
