// the points ledger's meaning. the balance is the sum of every row: earned points are positive,
// spending (a subscription, an offer) is a negative row. leaderboards, levels and achievements
// count earned points only, so spending never drops a fan down a board
export const POINT_REASONS = {
  /** the demo's starting balance for a new fan (not earned: no board counts it) */
  welcome: "welcome",
  subscription: "subscription",
  offer: "offer",
} as const;

/** a new fan's starting balance in the demo (WELCOME_POINTS overrides, 0 turns it off) */
export const WELCOME_POINTS_DEFAULT = 1250;

export const balanceOf = (rows: { points: number }[]) => rows.reduce((sum, r) => sum + r.points, 0);

/** points that count for boards, levels and achievements: earned, not given or spent */
export const isEarned = (r: { points: number; reason: string }) => r.points > 0 && r.reason !== POINT_REASONS.welcome;
