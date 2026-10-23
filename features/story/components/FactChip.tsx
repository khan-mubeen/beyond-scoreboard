import type { Fact } from "@/shared/types";

/** a tiny citation after a sentence. hover shows the fact and where it came from */
export function FactChip({ id, fact }: { id: string; fact?: Fact }) {
  if (!fact) {
    return (
      <span
        title="not in the ledger"
        className="ml-1 rounded bg-bad/20 px-1 align-super font-mono text-[10px] text-bad"
      >
        {id}?
      </span>
    );
  }
  const unit = fact.unit === "%" ? "%" : fact.unit ? ` ${fact.unit}` : "";
  return (
    <span
      title={`${fact.label}: ${fact.value}${unit} · from ${fact.sourceGameIds.length} game${fact.sourceGameIds.length === 1 ? "" : "s"}`}
      className="ml-1 cursor-help rounded bg-accent/15 px-1 align-super font-mono text-[10px] text-accent"
    >
      {id}
    </span>
  );
}
