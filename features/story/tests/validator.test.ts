import { describe, expect, it } from "vitest";
import { mockContent, mockFactInputs } from "@/shared/mock";
import type { Content, ContentSentence } from "@/shared/types";
import { buildLedger } from "../ledger/build-ledger";
import { fallbackContent } from "../templates/fallback";
import { verify } from "../validator/validator";
import { fill } from "../writer/fill";

const ledger = mockContent.ledger;
const withSentences = (sentences: ContentSentence[]): Content => ({ ...mockContent.story, sentences });
const firstClaim = (s: ContentSentence) => verify(withSentences([s]), ledger).claims[0];

describe("validator", () => {
  it("passes the verified mock story", () => {
    expect(verify(mockContent.story, ledger).blockedCount).toBe(0);
  });

  it("blocks the planted claim in the mock report the same way", () => {
    const planted = mockContent.report.claims.find((c) => !c.passed)!;
    expect(firstClaim({ text: planted.text, factIds: planted.factIds }).errorType).toBe(planted.errorType);
  });

  describe("uncited sentence", () => {
    it("catches a sentence with no facts", () => {
      expect(firstClaim({ text: "Kärpät looked sharp.", factIds: [] }).errorType).toBe("uncited_sentence");
    });
    it("catches a citation that is not in the ledger", () => {
      expect(firstClaim({ text: "Kärpät sit 13th.", factIds: ["F99"] }).errorType).toBe("uncited_sentence");
    });
  });

  describe("model-typed number", () => {
    it("catches a number no cited fact backs", () => {
      const c = firstClaim({ text: "It was Kärpät's 5th straight home win.", factIds: ["F10"] });
      expect(c.errorType).toBe("model_typed_number");
      expect(c.reason).toContain('"5"');
    });
    it("catches a spelled-out number", () => {
      expect(firstClaim({ text: "Kärpät have won three in a row.", factIds: ["F1"] }).errorType).toBe("model_typed_number");
    });
    it("lets cited numbers, ordinals and clock times through", () => {
      expect(firstClaim({ text: "The win lifts Kärpät from 13th to 12th, winner at 58:51.", factIds: ["F1", "F17", "F15"] }).passed).toBe(true);
    });
  });

  describe("unknown name", () => {
    it("catches a player who is not in the ledger", () => {
      const c = firstClaim({ text: "Kärpät scored 2 goals in the third, both by Teemu Selänne.", factIds: ["F16"] });
      expect(c.errorType).toBe("unknown_name");
      expect(c.reason).toContain("Teemu");
    });
    it("knows team names and calendar words", () => {
      expect(firstClaim({ text: "On Saturday Kärpät beat Tappara 3–2.", factIds: ["F13", "F14"] }).passed).toBe(true);
    });
  });

  describe("quote", () => {
    it("catches quotation marks", () => {
      expect(firstClaim({ text: '"We wanted it more," Kärpät scored 2.', factIds: ["F16"] }).errorType).toBe("quote");
    });
    it("catches a said-attribution", () => {
      expect(firstClaim({ text: "The coach said Kärpät scored 2 in the third.", factIds: ["F16"] }).errorType).toBe("quote");
    });
  });

  describe("off-ice claim", () => {
    it("catches an injury claim", () => {
      expect(firstClaim({ text: "Kärpät scored 2 goals despite an injury.", factIds: ["F16"] }).errorType).toBe("off_ice_claim");
    });
    it("catches a contract claim, in finnish too", () => {
      expect(firstClaim({ text: "Kärpät scored 2 after the contract news.", factIds: ["F16"] }).errorType).toBe("off_ice_claim");
      expect(firstClaim({ text: "Kärpät teki 2 maalia, vaikka pelaaja loukkaantui.", factIds: ["F16"] }).errorType).toBe("off_ice_claim");
    });
  });

  it("catches betting language through the shared guardrails", () => {
    expect(firstClaim({ text: "Kärpät scored 2, the odds were long.", factIds: ["F16"] }).errorType).toBe("betting_language");
  });

  it("the template fallback passes with the llm off", () => {
    const facts = buildLedger(mockFactInputs);
    const brief = fallbackContent({ kind: "brief", teamId: "karpat", gameId: "game-1042", language: "en" }, facts);
    expect(brief.sentences.length).toBeGreaterThan(0);
    expect(verify(brief, facts).blockedCount).toBe(0);
  });

  it("fill turns placeholders into values and citations", () => {
    expect(fill("Kärpät sit {F1:ord} with {F2} points.", ledger)).toEqual({
      text: "Kärpät sit 13th with 17 points.",
      factIds: ["F1", "F2"],
    });
  });
});
