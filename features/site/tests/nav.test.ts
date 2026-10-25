// the sidebar's active link: the page's own link, else the longest whole-segment prefix
import { describe, expect, it } from "vitest";
import { activeLinkFor, QUICK_LINKS } from "../chrome";

describe("activeLinkFor", () => {
  it.each([
    ["/friends", "friends"],
    ["/profile", "profile"],
    ["/calls", "calls"],
    ["/calls/history", "history"],
    ["/teams/kärpät", "teams"],
    ["/sports", "home"],
    ["/leaderboard/", "leaderboard"],
    ["/rewards", "rewards"],
    ["/match/2027-2701379", null],
    ["/profiles", null],
  ])("%s -> %s", (path, id) => {
    expect(activeLinkFor(path, QUICK_LINKS)).toBe(id);
  });
});
