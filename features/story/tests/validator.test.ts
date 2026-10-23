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

  it("catches an uncited sentence", () => {
    expect(firstClaim({ text: "Kärpät looked sharp.", factIds: [] }).errorType).toBe("uncited_sentence");
  });

  it("catches a citation that is not in the ledger", () => {
    expect(firstClaim({ text: "Kärpät sit 13th.", factIds: ["F99"] }).errorType).toBe("uncited_sentence");
  });

  it.todo('catches a model-typed number ("5th straight home win" citing the form fact)');
  it.todo("catches an unknown name (a player not in the cited facts)");
  it.todo('catches a quote ("we wanted it more," said the coach)');
  it.todo("catches an injury or other off-ice claim");

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
