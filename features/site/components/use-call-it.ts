import { useEffect, useState } from "react";
import type { CallItState } from "@/shared/types";

export type CallPhase = "open" | "locked" | "revealed" | "cancelled";

/** what the call it! card renders. the mock countdown and the live server both produce it */
export interface CallItView {
  /** the call (for "report a mistake"); absent on the design's mock */
  id?: string;
  /** ai: the wording came from the ai phrase bank; auto: the built-in wording */
  wording?: "ai" | "auto";
  question: string;
  subtitle: string;
  options: { id: string; label: string }[];
  points: number;
  stakesLine: string | null;
  secondsLeft: number;
  totalSeconds: number;
  phase: CallPhase;
  picked: string | null;
  /** known only once revealed */
  correctOptionId: string | null;
  /** crowd split in %, once locked */
  split: Record<string, number> | null;
  lastCall: { text: string; correct: boolean } | null;
  /** why a call was cancelled */
  reason: string | null;
  /** an answer the server refused */
  error: string | null;
  pick: (optionId: string) => void;
}

/**
 * the design's local demo: pick locks the answer, the countdown reveals the result at 0.
 * one hook per page so the side card, the tab and the mobile sheet stay in sync
 */
export function useCallIt(data: CallItState | null): CallItView | null {
  const [secondsLeft, setSecondsLeft] = useState(data?.secondsLeft ?? 0);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [data]);

  if (!data) return null;
  const phase: CallPhase = secondsLeft === 0 ? "revealed" : picked ? "locked" : "open";
  return {
    question: data.call.question,
    subtitle: data.subtitle,
    options: data.call.options,
    points: data.points,
    stakesLine: data.call.stakesLine ?? null,
    secondsLeft,
    totalSeconds: data.secondsLeft,
    phase,
    picked,
    correctOptionId: phase === "revealed" ? data.result.correctOptionId : null,
    split: phase === "revealed" ? data.result.split : null,
    lastCall: data.lastCall,
    reason: null,
    error: null,
    pick: (optionId) => {
      if (phase === "open") setPicked(optionId);
    },
  };
}
