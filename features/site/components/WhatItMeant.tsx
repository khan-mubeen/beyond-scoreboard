import type { FinishedMatchDetail } from "@/shared/types";
import { ordinal } from "../format";
import { Icon } from "./Icon";
import { Pill, SectionCard } from "./SectionCard";
import { ChangeTag } from "./StakesChip";

/** before → after for the playoff chance and the table, plus the verified match story */
export function WhatItMeant({ data }: { data: FinishedMatchDetail["whatItMeant"] }) {
  const change = data.chanceAfter - data.chanceBefore;
  return (
    <SectionCard
      title="What it meant"
      action={
        <Pill tone="outline">
          <Icon name="check" className="size-3.5" />
          {data.badge}
        </Pill>
      }
      className="h-full"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Playoff chance</h3>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[28px] leading-none font-bold tabular-nums">
            {data.chanceBefore}% <Icon name="arrowRight" className="size-6" label="to" /> {data.chanceAfter}%
            <ChangeTag change={change} className="text-sm" />
          </p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">League position</h3>
          <p className="mt-2 flex items-center gap-2 text-[28px] leading-none font-bold tabular-nums">
            {ordinal(data.positionBefore)} <Icon name="arrowRight" className="size-6" label="to" />{" "}
            {ordinal(data.positionAfter)}
          </p>
          <p className="mt-1.5 text-xs font-medium text-good">{data.positionNote}</p>
        </div>
      </div>

      <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted uppercase">Match story</h3>
      <p className="mt-2 text-sm leading-relaxed">{data.story.sentences.map((s) => s.text).join(" ")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line px-4 py-3">
        <span className="mr-2 text-sm font-semibold">Before vs. after</span>
        {data.chips.map((c) => (
          <Pill key={c.label} tone={c.tone === "good" ? "good" : "neutral"} className="text-ink">
            {c.label}
          </Pill>
        ))}
      </div>
    </SectionCard>
  );
}
