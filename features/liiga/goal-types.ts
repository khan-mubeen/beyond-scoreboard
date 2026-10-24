// goalTypes codes we could confirm against the data (docs/api/goal-types.md).
// anything else is shown as-is and reported so it can be added once confirmed

export const GOAL_TYPE_LABELS: Record<string, string> = {
  YV: "power play",
  YV2: "5-on-3 power play",
  AV: "shorthanded",
  TM: "empty net",
  VL: "shootout goal",
  IM: "extra attacker",
  RL: "penalty shot",
  // VT0, a goal disallowed on video review, never becomes a goal (normalize.ts drops it)
};

export function describeGoalTypes(codes: string[]): { labels: string[]; unknown: string[] } {
  const labels: string[] = [];
  const unknown: string[] = [];
  for (const c of codes) {
    if (GOAL_TYPE_LABELS[c]) labels.push(GOAL_TYPE_LABELS[c]);
    else {
      labels.push(c);
      unknown.push(c);
    }
  }
  return { labels, unknown };
}

export const isPowerPlayGoal = (codes: string[]) => codes.includes("YV") || codes.includes("YV2");
export const isEmptyNetGoal = (codes: string[]) => codes.includes("TM");
export const isShootoutGoal = (codes: string[]) => codes.includes("VL");
