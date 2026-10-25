// the visual upgrade's data, in-process on the snapshots and the memory db: the finished page's
// insights (impact, the game chart, periods, player of the game, next time), what if?'s table,
// the result cards' chance swings, the plans' price preview rules and the partner offers. every
// number comes from the data, and the new copy passes the guardrails
import { beforeAll, describe, expect, it } from "vitest";
import { checkText } from "@/shared/guardrails";
import { clampPoints, defaultPoints, FEATURES, halfPriceInPoints, PLANS, pointsCap, quote } from "@/shared/config/plans";
import type { FinishedMatchDetail, HomePage } from "@/shared/types";

Object.assign(process.env, { USE_SNAPSHOT: "true", DB_MODE: "memory", SIM_RUNS: "300", LLM_ENABLED: "false" });
for (const k of ["LIIGA_API_URL", "LIIGA_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DEMO_MODE", "DEMO_REPLAY_MATCH_ID"]) delete process.env[k];

const FINAL = "2027-2701398"; // KooKoo 3-2 Tappara after a shootout
let detail: FinishedMatchDetail;
let home: HomePage;
let site: typeof import("@/features/site/server/match");

beforeAll(async () => {
  site = await import("@/features/site/server/match");
  const { homePage } = await import("@/features/site/server/home");
  detail = (await site.matchDetail(FINAL, { user: null, anonId: "test" } as never)) as FinishedMatchDetail;
  home = await homePage({ user: null, anonId: "test" } as never);
}, 120_000);

describe("the finished page's insights", () => {
  it("season impact: the chance and the place before and after, the whole table both ways", () => {
    const i = detail.insights!;
    expect(detail.status).toBe("final");
    expect(i).toBeTruthy();
    expect(i.impact.chanceBefore).toBe(detail.whatItMeant.chanceBefore);
    expect(i.impact.chanceAfter).toBe(detail.whatItMeant.chanceAfter);
    expect(i.impact.rankAfter).toBe(detail.whatItMeant.positionAfter);
    expect(i.impact.table).toHaveLength(17);
    expect(new Set(i.impact.table.map((r) => r.rankBefore)).size).toBe(17);
    // only the two teams of the game gain points
    const gained = i.impact.table.filter((r) => r.points !== r.pointsBefore).map((r) => r.team.id).sort();
    expect(gained).toEqual([detail.match.home.id, detail.match.away.id].sort());
  });

  it("the game in one chart: every goal of regulation and overtime on one axis, the chance steps after each", () => {
    const g = detail.insights!.game;
    expect(g.endSeconds).toBe(3900);
    const scored = detail.events.filter((e) => e.kind === "goal");
    expect(g.goals.length).toBeGreaterThan(0);
    expect(g.goals.length).toBeLessThanOrEqual(scored.length);
    for (const m of g.goals) {
      expect(m.seconds).toBeGreaterThan(0);
      expect(m.seconds).toBeLessThanOrEqual(g.endSeconds);
      expect(m.chanceAfter).not.toBeNull();
      expect(m.score).toMatch(/^\d+–\d+$/);
      // a photo, when there is one, is the api's pictureUrl
      if (m.photo) expect(m.photo).toMatch(/^https:\/\/liiga-backend/);
    }
    expect(g.steps[0]).toEqual({ seconds: 0, chance: detail.insights!.impact.chanceBefore });
    expect(g.steps.at(-1)!.chance).toBe(detail.insights!.impact.chanceAfter);
  });

  it("periods: shots add up to the game's total; puck control shares add to 100", () => {
    const p = detail.insights!.periods;
    expect(p.length).toBeGreaterThanOrEqual(3);
    const shots = detail.stats.find((s) => s.id === "shots")!;
    const withShots = p.filter((x) => x.shots);
    if (shots.home !== null) {
      expect(withShots.reduce((n, x) => n + x.shots!.home, 0)).toBe(shots.home);
      expect(withShots.reduce((n, x) => n + x.shots!.away, 0)).toBe(shots.away);
    }
    for (const x of p.filter((y) => y.control)) expect(Math.abs(x.control!.home + x.control!.away - 100)).toBeLessThanOrEqual(1);
  });

  it("the player of the game has the most points tonight, with the season including tonight", () => {
    const pog = detail.insights!.playerOfGame!;
    expect(pog.goals + pog.assists).toBeGreaterThan(0);
    expect(pog.season!.goals).toBeGreaterThanOrEqual(pog.goals);
    if (pog.note) expect(checkText(pog.note)).toEqual([]);
  });

  it("next time: the next opponent, what it's worth, head-to-head and both teams' last 5", () => {
    const n = detail.insights!.nextTime!;
    expect(n).toBeTruthy();
    expect(n.matchId).toMatch(/^2027-\d+$/);
    // a win can't hurt: a higher playoff or top-4 chance, a lower relegation chance
    if (n.worth) {
      if (/^relegation/i.test(n.worth.label)) expect(n.worth.win).toBeLessThanOrEqual(n.worth.loss);
      else expect(n.worth.win).toBeGreaterThanOrEqual(n.worth.loss);
    }
    expect(n.form).toHaveLength(2);
    for (const f of n.form) expect(f.results.length).toBeLessThanOrEqual(5);
    // tonight's game is the focus team's latest result
    expect(n.form[0].results.at(-1)!.result).toMatch(/^(W|OTW|OTL|L)$/);
    if (n.playerToWatch) expect(checkText(n.playerToWatch.note)).toEqual([]);
    expect(n.followTeamId).toBe(detail.insights!.focus.team.id);
  });
});

describe("the results list", () => {
  it("each result card has both teams' chance after the game and a next-game teaser", () => {
    expect(home.recent.length).toBeGreaterThan(3);
    for (const r of home.recent) {
      expect(r.status).toBe("final");
      expect(r.swing).toBeTruthy();
      for (const s of [r.swing!.home, r.swing!.away]) {
        expect(s.now).toBeGreaterThanOrEqual(0);
        expect(s.now).toBeLessThanOrEqual(100);
      }
      // the winner's chance can't get worse from a win, the loser's can't get better from a loss
      // (each side's own chance: a relegation chance getting better means going down)
      const homeWon = r.score!.home > r.score!.away;
      const better = (s: { change: number; label?: string }) => (/^relegation/i.test(s.label ?? "") ? -s.change : s.change);
      expect(better(homeWon ? r.swing!.home : r.swing!.away)).toBeGreaterThanOrEqual(0);
      expect(better(homeWon ? r.swing!.away : r.swing!.home)).toBeLessThanOrEqual(0);
      if (r.teaser) expect(r.teaser.href).toMatch(/^\/match\/2027-\d+$/);
    }
  });
});

describe("what if?'s table", () => {
  it("sets results into tonight's table: points added, everyone re-ranked", async () => {
    const { whatIf, whatIfOptions } = await import("@/features/site/server/whatif");
    const { getSeasonContext } = await import("@/features/stakes/server");
    const ctx = await getSeasonContext();
    const open = ctx.schedule.find((f) => f.status === "scheduled")!;
    const opts = await whatIfOptions(ctx, open.id);
    const none = await whatIf(open.id, []);
    expect(none.table.every((r) => r.rank === r.rankBefore && r.points === r.pointsBefore)).toBe(true);
    const set = await whatIf(open.id, [{ gameId: open.id, outcome: "regulationWin" }]);
    const winner = set.table.find((r) => r.team.id === opts!.games[0].home.id)!;
    expect(winner.points - winner.pointsBefore).toBe(3);
    expect(set.table.map((r) => r.rank)).toEqual([...Array(set.table.length)].map((_, i) => i + 1));
    expect(set.table.reduce((n, r) => n + r.points - r.pointsBefore, 0)).toBe(3);
  });
});

describe("plans and partner offers", () => {
  it("the price preview keeps the checkout's rules: the cap, half the price, the balance", () => {
    for (const p of PLANS) {
      for (const balance of [0, 120, 1250, 10_000]) {
        const cap = pointsCap(p, balance);
        expect(cap).toBeLessThanOrEqual(Math.min(p.maxPointsUsable, halfPriceInPoints(p.priceCents), balance));
        expect(defaultPoints(p, balance)).toBe(cap);
        // whatever the slider sends is clamped, and money is always left to pay
        for (const v of [-50, 0, 33, cap, cap + 999]) expect(quote(p, clampPoints(p, balance, v)).payCents).toBeGreaterThan(0);
      }
    }
    expect(PLANS.filter((p) => p.popular).map((p) => p.id)).toEqual(["sports-pass"]);
    for (const p of PLANS) expect(p.features.every((f) => FEATURES.some((x) => x.id === f))).toBe(true);
  });

  it("partners are fictional (no real brand names), each with a category, and the copy passes the guardrails", async () => {
    const { rewardsConfig } = await import("@/features/site/server/config");
    const offers = rewardsConfig.offers;
    expect(offers.length).toBeGreaterThanOrEqual(6);
    expect(offers.length).toBeLessThanOrEqual(8);
    const real = /k-?market|prisma|s-market|nordea|fazer|finnair|marimekko|kärpät|karpat|lidl|alepa|\bop\b/i;
    for (const o of offers) {
      expect(o.partner, o.id).toBeTruthy();
      expect(o.partner!.name, o.id).not.toMatch(real);
      expect(o.title + o.description, o.id).not.toMatch(real);
      expect(o.partnerUrl, o.id).toBeNull();
      expect(["food", "sports", "travel", "shopping"]).toContain(o.category);
      for (const t of [o.title, o.description, o.partner!.name, o.tag]) expect(checkText(t), t).toEqual([]);
    }
    expect(new Set(offers.map((o) => o.partner!.monogram)).size).toBe(offers.length);
    for (const f of FEATURES) expect(checkText(f.label)).toEqual([]);
  });
});
