import type { Content, Fact } from "@/shared/types";
import { FactChip } from "./FactChip";
import { VerifiedBadge } from "./VerifiedBadge";

export function StorySection({ content, ledger }: { content: Content; ledger: Fact[] }) {
  return (
    <article className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{content.kind === "brief" ? "Pre-game brief" : "Post-game story"}</h2>
        <VerifiedBadge status={content.status} />
      </header>
      <p className="leading-relaxed">
        {content.sentences.map((s, i) => (
          <span key={i}>
            {s.text}
            {s.factIds.map((id) => (
              <FactChip key={id} id={id} fact={ledger.find((f) => f.id === id)} />
            ))}{" "}
          </span>
        ))}
      </p>
    </article>
  );
}
