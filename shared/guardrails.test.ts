import { describe, expect, it } from "vitest";
import { checkText, isClean } from "./guardrails";
import { mockContent, mockRoomStates } from "./mock";

describe("guardrails", () => {
  it.each([
    "Place your bet now",
    "Betting closes soon",
    "Win a prize tonight",
    "The odds are good",
    "Ask the bookie",
    "Big payout",
    "Vedonlyönti alkaa",
    "Kertoimet nousevat",
    "Voita palkinto",
    "Panostus on pieni",
  ])("flags banned words: %s", (text) => {
    expect(checkText(text).some((m) => m.kind === "banned_word")).toBe(true);
  });

  it.each(["Kärpät @2.35", "Tappara 2.35x", "kerroin 2,35", "1.85 / 3.40 / 4.10"])("flags odds formats: %s", (text) => {
    expect(isClean(text)).toBe(false);
  });

  it.each([
    "Kärpät score 2.35 goals per game",
    "Playoff chance 64%",
    "Their playoff chance is 52%, up from 41%.",
    "A better night for Kärpät",
    "The alphabet of hockey",
    "Kärpät vetoavat yleisöön",
  ])("lets normal copy through: %s", (text) => {
    expect(checkText(text)).toEqual([]);
  });

  it("finds every match with its position", () => {
    expect(checkText("no odds, no bets")).toEqual([
      { kind: "banned_word", match: "odds", index: 3 },
      { kind: "banned_word", match: "bets", index: 12 },
    ]);
  });

  it("keeps the mock copy clean", () => {
    const copy = [
      ...mockContent.story.sentences.map((s) => s.text),
      ...mockRoomStates.flatMap((s) => [
        s.stakes.headline,
        ...(s.activeCall ? [s.activeCall.question, ...s.activeCall.options.map((o) => o.label)] : []),
      ]),
    ];
    for (const text of copy) expect(checkText(text), text).toEqual([]);
  });
});
