import { useEffect, useState } from "react";
import type { CallItState } from "@/shared/types";

export type CallPhase = "open" | "locked" | "revealed";

export interface CallItView {
  data: CallItState;
  secondsLeft: number;
  phase: CallPhase;
  picked: string | null;
  pick: (optionId: string) => void;
}

/**
 * local call it! state: pick locks the answer, the countdown reveals the result at 0.
 * one hook per page so the side card, the tab and the mobile sheet stay in sync
 */
export function useCallIt(data: CallItState): CallItView {
  const [secondsLeft, setSecondsLeft] = useState(data.secondsLeft);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const phase: CallPhase = secondsLeft === 0 ? "revealed" : picked ? "locked" : "open";
  return {
    data,
    secondsLeft,
    phase,
    picked,
    pick: (optionId) => {
      if (phase === "open") setPicked(optionId);
    },
  };
}
