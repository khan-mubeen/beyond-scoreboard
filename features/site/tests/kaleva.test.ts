// the kaleva.fi front page and the sports section: the menu is the original's with Kaleva Sports in
// place of Urheilu, every link is a page of the app or the real kaleva.fi, headlines link to real
// articles, old deep links into the sports home redirect
import { describe, expect, it } from "vitest";
import { isRoute, redirectFor } from "@/app/routes";
import { checkText } from "@/shared/guardrails";
import { readFileSync } from "node:fs";
import { QUICK_LINKS } from "../chrome";
import { KF_DRAWER, KF_EVENTS, KF_FOOTER, KF_FRONT, KF_NAV, KF_TOP, SPORTS_ENTRY } from "../kaleva";

const KALEVA = /^https:\/\/(www\.|asiakaspalvelu\.|tapahtumat\.|itsepalvelu\.|sivustot\.)?(kaleva\.fi|kalevamedia\.fi|radiokaleva\.fi)\//;

describe("kaleva.fi front page", () => {
  const menu = KF_DRAWER.flatMap((g) => [g.title, ...g.items]).filter((l) => l.label);
  const links = [...KF_TOP, ...KF_NAV, ...menu, ...KF_FOOTER.buttons, ...KF_FOOTER.links];

  it("the drawer is the original's, with Kaleva Sports (NEW) where Urheilu was", () => {
    const news = KF_DRAWER[0].items.map((l) => l.label);
    expect(news.slice(0, 7)).toEqual(["Etusivu", "Oulun seutu", "Pohjois-Suomi", "Forum24", "Kotimaa", "Kaleva Sports", "Kiekko-Kaleva"]);
    expect(news).not.toContain("Urheilu");
    expect(menu.filter((l) => l.sports)).toEqual([SPORTS_ENTRY]);
    expect(SPORTS_ENTRY.href).toBe("/sports");
  });

  it("every link is the app's sports page or a real kaleva page", () => {
    for (const l of links) {
      if (l.sports) expect(isRoute(l.href), l.label).toBe(true);
      else expect(l.href, l.label).toMatch(KALEVA);
    }
  });

  it("headlines link to real kaleva.fi articles, none twice in one list, no invented ones", () => {
    const articles = KF_FRONT.blocks.flatMap((b) =>
      b.kind === "lead" ? [b.item] : b.kind === "pair" ? b.items : b.kind === "lift" ? [b.lead, ...b.items] : b.kind === "podcasts" ? b.items : [],
    );
    expect(articles.length).toBeGreaterThan(25);
    for (const a of [...articles, ...KF_FRONT.latest, ...KF_FRONT.mostRead, ...KF_FRONT.games, ...KF_FRONT.rightNow]) {
      expect(a.href, a.title).toMatch(/^https:\/\/www\.kaleva\.fi\/.+\/\d{6,}$/);
      expect(a.title.length, a.href).toBeGreaterThan(3);
    }
    for (const e of KF_EVENTS) expect(e.href).toMatch(/^https:\/\/tapahtumat\.kaleva\.fi\//);
    for (const list of [KF_FRONT.latest, KF_FRONT.mostRead]) expect(new Set(list.map((a) => a.href)).size).toBe(list.length);
  });

  it("our own texts pass the guardrails", () => {
    for (const l of links) expect(checkText(l.label), l.label).toEqual([]);
  });

  it("the kalevamedia.fi recreation is gone", () => {
    expect(isRoute("/media/tietoa-meista")).toBe(false);
    expect(isRoute("/")).toBe(true);
  });
});

describe("kaleva sports section", () => {
  it("the sidebar's quick links are the navigation: every one a real page, the old header sections all there", () => {
    for (const l of QUICK_LINKS) expect(isRoute(l.href.split("?")[0]), l.href).toBe(true);
    const hrefs = QUICK_LINKS.map((l) => l.href);
    for (const page of ["/sports", "/teams", "/leaderboard", "/calls", "/rewards"]) expect(hrefs, page).toContain(page);
  });

  it("the header has no section links any more; live and results are the home page's filter pills", () => {
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
    expect(src("../components/TopNav.tsx")).not.toMatch(/Sports sections/);
    expect(src("../components/SidebarDrawer.tsx")).not.toMatch(/Sports sections/);
    const home = src("../screens/SportsHome.tsx");
    for (const f of ['id: "live"', 'id: "results"']) expect(home).toContain(f);
    // the old header links (?show=live|results) still open those filters
    expect(home).toMatch(/show === "live" \|\| show === "results"/);
  });

  it("old deep links into the sports home (it was /) redirect to /sports, the rest stays", () => {
    expect(redirectFor("/", "?show=live")).toBe("/sports?show=live");
    expect(redirectFor("/", "", "#liiga-table")).toBe("/sports#liiga-table");
    expect(redirectFor("/", "?team=karpat&date=2026-10-20")).toBe("/sports?team=karpat&date=2026-10-20");
    expect(redirectFor("/sport")).toBe("/sports");
    expect(redirectFor("/")).toBeNull();
    expect(redirectFor("/match/2027-2701400", "?room=ABCD")).toBeNull();
    expect(isRoute("/sports") && isRoute("/") && isRoute("/dev/brand")).toBe(true);
  });
});
