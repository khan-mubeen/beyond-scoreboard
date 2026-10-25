import type { FinishedMatchDetail } from "@/shared/types";
import { AiLabel } from "./AiLabel";
import { Pill, SectionCard } from "./SectionCard";

/**
 * the verified match story and one line of before/after chips (the big chance and position
 * numbers are in season impact above), with the story's honest label and "report a mistake"
 */
export function WhatItMeant({ data, matchId }: { data: FinishedMatchDetail["whatItMeant"]; matchId?: string }) {
  const origin = data.story.origin ?? null;
  return (
    <SectionCard title="What it meant" className="h-full">
      <p className="text-[15px] leading-relaxed">{data.story.sentences.map((s) => s.text).join(" ")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {data.chips.map((c) => (
          <Pill key={c.label} tone={c.tone === "good" ? "good" : "neutral"} className="text-ink">
            {c.label}
          </Pill>
        ))}
      </div>
      <AiLabel className="mt-4 border-t border-line pt-3" label={{ kind: "text", origin }} report={{ refKind: "text", refKey: origin?.key ?? null, matchId }} />
    </SectionCard>
  );
}
