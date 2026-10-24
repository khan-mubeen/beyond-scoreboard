// the kaleva media front page and the sports section: every new link is a page of the app, the
// placeholders know their real page, old deep links into the sports home redirect
import { describe, expect, it } from "vitest";
import { isRoute, redirectFor } from "@/app/routes";
import { checkText } from "@/shared/guardrails";
import { SPORTS_NAV, sportsNav, sportsSection } from "../chrome";
import { MEDIA_LOOKING_FOR, MEDIA_NAV, MEDIA_NEWS, MEDIA_PAGES, MEDIA_SOCIAL, MEDIA_SOCKET, MEDIA_TITLES, mediaHref } from "../media";

describe("kaleva media front page", () => {
  const links = [...MEDIA_TITLES, ...MEDIA_LOOKING_FOR.flat(), ...MEDIA_SOCKET, ...MEDIA_SOCIAL, ...MEDIA_NEWS, ...MEDIA_NAV.flatMap((i) => i.sub ?? [])];

  it("the menu is the original's, plus Sports with a New tag", () => {
    expect(MEDIA_NAV.map((i) => i.label)).toEqual(["Etusivu", "Sports", "Tietoa meistä", "Kuluttajille", "Yrityksille", "Avoimet työpaikat", "Yhteystiedot", "Tietosuoja"]);
    expect(MEDIA_NAV.filter((i) => i.isNew).map((i) => i.href)).toEqual(["/sports"]);
  });

  it("every link is a page of the app; every placeholder knows the real kalevamedia page", () => {
    for (const item of MEDIA_NAV) expect(isRoute(item.href.split("?")[0]), item.href).toBe(true);
    for (const l of links) {
      expect(isRoute(mediaHref(l)), l.label).toBe(true);
      expect(MEDIA_PAGES[l.slug]?.real, l.label).toMatch(/^https:\/\//);
    }
    expect(isRoute("/media/not-a-page")).toBe(true); // shown as a plain kaleva media page
  });

  it("texts pass the guardrails", () => {
    for (const l of links) expect(checkText(l.label), l.label).toEqual([]);
  });
});

describe("kaleva sports section", () => {
  it("the sub-navigation: Home, Live, Results, Teams, Leaderboard, Your Call!, Rewards, all real pages", () => {
    expect(SPORTS_NAV.map((l) => l.label)).toEqual(["Home", "Live", "Results", "Teams", "Leaderboard", "Your Call!", "Rewards"]);
    for (const l of SPORTS_NAV) expect(isRoute(l.href.split("?")[0]), l.href).toBe(true);
  });

  it("marks the current section", () => {
    expect(sportsSection("/sports")).toBe("home");
    expect(sportsSection("/sports", "?show=live")).toBe("live");
    expect(sportsSection("/teams/kärpät")).toBe("teams");
    expect(sportsSection("/calls/history")).toBe("calls");
    expect(sportsSection("/match/2027-2701400")).toBeNull();
    expect(sportsNav("/rewards").filter((l) => l.active).map((l) => l.label)).toEqual(["Rewards"]);
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
