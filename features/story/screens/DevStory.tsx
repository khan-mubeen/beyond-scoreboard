import { useMemo, useState } from "react";
import { DEMO_GAME_ID, DEMO_TEAM_ID, mockContent } from "@/shared/mock";
import type { Content, ContentKind, Fact, VerificationReport } from "@/shared/types";
import { Button, Card } from "@/shared/ui";
import { StorySection } from "../components/StorySection";
import { VerificationPanel } from "../components/VerificationPanel";
import { verify } from "../validator/validator";

function parseLedger(text: string): Fact[] | string {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Fact[]) : "the ledger must be a json array of facts";
  } catch (e) {
    return (e as Error).message;
  }
}

/** edit the ledger, load content from the api, and see what the validator blocks */
export function DevStory() {
  const [ledgerText, setLedgerText] = useState(() => JSON.stringify(mockContent.ledger, null, 2));
  const [content, setContent] = useState<Content>(mockContent.story);
  const [report, setReport] = useState<VerificationReport>(mockContent.report);
  const [error, setError] = useState<string | null>(null);
  const ledger = useMemo(() => parseLedger(ledgerText), [ledgerText]);

  async function load(kind: ContentKind) {
    setError(null);
    try {
      const q = new URLSearchParams({ teamId: DEMO_TEAM_ID, gameId: DEMO_GAME_ID, language: "en" });
      const res = await fetch(`/api/content/${kind}?${q}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `error ${res.status}`);
      const next = (await res.json()) as Content;
      const rep = await fetch(`/api/content/${encodeURIComponent(next.id)}/verification`);
      setContent(next);
      if (rep.ok) setReport((await rep.json()) as VerificationReport);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">/dev/story</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <label htmlFor="ledger" className="text-sm text-muted">
            Fact ledger (edit it, then re-check)
          </label>
          <textarea
            id="ledger"
            className="h-[28rem] rounded-md border border-line bg-surface-2 p-2 font-mono text-xs"
            value={ledgerText}
            onChange={(e) => setLedgerText(e.target.value)}
            spellCheck={false}
          />
          {typeof ledger === "string" && <p className="text-sm text-bad">{ledger}</p>}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-wrap gap-2">
            <Button onClick={() => load("brief")}>Load brief</Button>
            <Button onClick={() => load("story")}>Load story</Button>
            <Button
              variant="ghost"
              disabled={typeof ledger === "string"}
              onClick={() => typeof ledger !== "string" && setReport(verify(content, ledger))}
            >
              Re-check with this ledger
            </Button>
            {error && <p className="w-full text-sm text-bad">{error}</p>}
          </Card>
          <Card>
            <StorySection content={content} ledger={typeof ledger === "string" ? [] : ledger} />
          </Card>
          <Card>
            <VerificationPanel report={report} />
          </Card>
        </div>
      </div>
    </main>
  );
}
