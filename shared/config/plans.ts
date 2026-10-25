// the kaleva subscriptions, paid in (demo) euros with some points. one place for the prices, the
// points cap per plan and the rule that money is always required: points can cover at most half
// of a price. 100 points = €1, so a point is worth one euro cent. browser-safe: the checkout uses
// the same maths as the server, and the server re-checks everything
export const POINTS_PER_EURO = 100;
/** points can pay at most this share of a price */
export const MAX_POINTS_SHARE = 0.5;

export type PlanId = "digital" | "sports-pass" | "weekend";

/** the plan cards' checklist, in this order */
export const FEATURES = [
  { id: "stream", label: "Live match stream" },
  { id: "calls", label: "Your Call!, predictions and trivia" },
  { id: "stakes", label: "Season stakes and What if?" },
  { id: "audio", label: "60-second audio summaries" },
  { id: "stories", label: "Verified match stories" },
  { id: "news", label: "All Kaleva news and the digital paper" },
] as const;
export type FeatureId = (typeof FEATURES)[number]["id"];

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  /** what's included, for the checkout */
  includes: string[];
  /** demo price in euro cents */
  priceCents: number;
  durationDays: number;
  /** "month", "3 days" */
  durationLabel: string;
  includesLiveStream: boolean;
  maxPointsUsable: number;
  /** what the plan's checklist ticks */
  features: FeatureId[];
  /** the card marked "Most popular" */
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "digital",
    name: "Kaleva Digital",
    description: "Local news, sport and trusted stories from Northern Finland.",
    includes: ["All Kaleva news and stories", "The digital paper", "Match stories and analysis"],
    priceCents: 1290,
    durationDays: 30,
    durationLabel: "month",
    includesLiveStream: false,
    maxPointsUsable: 600,
    features: ["calls", "stakes", "stories", "news"],
  },
  {
    id: "sports-pass",
    name: "Kaleva Sports Pass",
    description: "Watch the games live, with deeper season stakes and match audio.",
    includes: ["Live match stream", "Season stakes and what-if", "Match stories and audio summaries"],
    priceCents: 790,
    durationDays: 30,
    durationLabel: "month",
    includesLiveStream: true,
    maxPointsUsable: 350,
    features: ["stream", "calls", "stakes", "audio", "stories"],
    popular: true,
  },
  {
    id: "weekend",
    name: "Weekend Pass",
    description: "Every game of a match-filled weekend, live.",
    includes: ["Live match stream for 3 days", "Season stakes", "Match stories"],
    priceCents: 390,
    durationDays: 3,
    durationLabel: "3 days",
    includesLiveStream: true,
    maxPointsUsable: 150,
    features: ["stream", "calls", "stakes", "stories"],
  },
];

export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);
/** the plan the live-stream lock sells */
export const LIVE_STREAM_PLAN: PlanId = "sports-pass";

/** points in euro cents (1 point = 1 cent with 100 points = €1) */
export const pointsToCents = (points: number) => Math.round((points * 100) / POINTS_PER_EURO);
/** the most points a price allows under the 50% rule */
export const halfPriceInPoints = (priceCents: number) => Math.floor((priceCents * MAX_POINTS_SHARE * POINTS_PER_EURO) / 100);

/** every plan keeps money required: problems found, empty when fine (checked at startup and in tests) */
export function checkPlans(plans: Plan[] = PLANS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of plans) {
    if (ids.has(p.id)) problems.push(`${p.id}: duplicate id`);
    ids.add(p.id);
    if (!(p.priceCents > 0)) problems.push(`${p.id}: the price must be above zero`);
    if (!Number.isInteger(p.maxPointsUsable) || p.maxPointsUsable < 0) problems.push(`${p.id}: maxPointsUsable must be a whole number of points`);
    if (p.maxPointsUsable > halfPriceInPoints(p.priceCents)) problems.push(`${p.id}: ${p.maxPointsUsable} points is more than half of the price (${halfPriceInPoints(p.priceCents)} max)`);
    if (!(p.durationDays > 0)) problems.push(`${p.id}: the duration must be above zero`);
  }
  return problems;
}

/** the most points this fan can use on this plan right now */
export const pointsCap = (plan: Plan, balance: number) => Math.max(0, Math.min(plan.maxPointsUsable, Math.floor(balance)));
/** the checkout's starting value: as many points as allowed */
export const defaultPoints = (plan: Plan, balance: number) => pointsCap(plan, balance);
/** whatever was typed, as a valid amount (0 to the cap) */
export const clampPoints = (plan: Plan, balance: number, value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(pointsCap(plan, balance), Math.floor(value))) : 0);

/** points used and what's left to pay, in cents */
export function quote(plan: Plan, points: number) {
  const discountCents = pointsToCents(points);
  return { points, discountCents, payCents: plan.priceCents - discountCents };
}

/** "€4.40" */
export const fmtEur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
/** "€7.90 / month" */
export const priceLabel = (p: Plan) => `${fmtEur(p.priceCents)} / ${p.durationLabel}`;

/** the checkout's live summary: "Points used: 350 (−€3.50) · You pay: €4.40" */
export function summaryText(plan: Plan, points: number) {
  const q = quote(plan, points);
  return `Points used: ${q.points} (−${fmtEur(q.discountCents)}) · You pay: ${fmtEur(q.payCents)}`;
}
