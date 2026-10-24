// subscriptions paid with (demo) money plus some points, and partner offer codes. the server
// re-checks everything the checkout sends (the plan, the points cap, the 50% rule, the balance)
// and spends through the db's atomic wallet (one transaction behind a per-fan lock), so the
// balance never goes below zero and a repeated idempotency key gives the first result again
import { randomBytes } from "node:crypto";
import { checkPlans, fmtEur, halfPriceInPoints, LIVE_STREAM_PLAN, type Plan, PLANS, planById, priceLabel, quote } from "@/shared/config/plans";
import { checkText } from "@/shared/guardrails";
import { getDb, type DbSubscription, type DbUser } from "@/shared/db";
import type { LiveMatchDetail, MeResponse, OfferResult, PurchaseRecord, RewardOffer, Subscription, SubscriptionResult } from "@/shared/types";
import { rewardsConfig } from "./config";
import { ensureUser, welcomePoints, type Viewer } from "./identity";
import { shortDate } from "./labels";

/** startup: every plan keeps money required (points cover at most half), or the server stops */
export function assertPlans() {
  const problems = checkPlans();
  for (const p of PLANS) for (const t of [p.name, p.description, ...p.includes]) if (checkText(t).length) problems.push(`${p.id}: "${t}" fails the copy guardrails`);
  if (problems.length) throw new Error(`plans: ${problems.join("; ")}`);
}

export class WalletError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/**
 * the database stamps a new plan with its own clock, which can run a little ahead of this
 * server's: without some slack, a plan bought a second ago would read as "not started yet" and the
 * live stream wouldn't unlock until the next load. queued extensions start days later, so 2 min
 * opens nothing early
 */
const CLOCK_SLACK_MS = 120_000;
/** running now (a cancelled plan runs until it expires; an extension that hasn't started yet doesn't count) */
const running = (s: DbSubscription, now = Date.now()) => s.status !== "expired" && Date.parse(s.startedAt) <= now + CLOCK_SLACK_MS && Date.parse(s.expiresAt) > now;
/** running now or queued after a running one */
const current = (s: DbSubscription, now = Date.now()) => s.status !== "expired" && Date.parse(s.expiresAt) > now;

const record = (s: DbSubscription): PurchaseRecord => {
  const plan = planById(s.planId);
  return {
    id: s.id,
    planId: s.planId,
    planName: plan?.name ?? s.planId,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    pointsUsed: s.pointsUsed,
    amountLabel: fmtEur(Math.round(s.demoAmountEur * 100)),
    status: s.status,
    includesLiveStream: !!plan?.includesLiveStream,
  };
};

export async function subscriptionsOf(user: DbUser | null): Promise<DbSubscription[]> {
  return user ? getDb().wallet.subscriptions(user.id) : [];
}

/** one entry per plan the fan has now: valid until the last queued period ends */
export function activePlans(subs: DbSubscription[]): MeResponse["plans"] {
  const byPlan = new Map<string, DbSubscription[]>();
  for (const s of subs.filter((x) => current(x))) byPlan.set(s.planId, [...(byPlan.get(s.planId) ?? []), s]);
  return [...byPlan.entries()]
    .filter(([, list]) => list.some((s) => running(s)))
    .map(([planId, list]) => {
      const plan = planById(planId);
      return {
        planId,
        name: plan?.name ?? planId,
        until: list.map((s) => s.expiresAt).sort().at(-1)!,
        cancelled: list.every((s) => s.status === "cancelled"),
        includesLiveStream: !!plan?.includesLiveStream,
      };
    });
}

/** the live stream: a running plan that includes it */
export async function hasLiveStream(user: DbUser | null): Promise<boolean> {
  return (await subscriptionsOf(user)).some((s) => running(s) && !!planById(s.planId)?.includesLiveStream);
}

const hasAnyPlan = async (user: DbUser | null) => (await subscriptionsOf(user)).some((s) => running(s));

/** what /me says about money: the balance (a guest's is the welcome balance they get) and the plans */
export async function walletOf(user: DbUser | null): Promise<Pick<MeResponse, "wallet" | "plans">> {
  if (!user) return { wallet: { balance: welcomePoints() }, plans: [] };
  const [balance, subs] = await Promise.all([getDb().wallet.balance(user.id), subscriptionsOf(user)]);
  return { wallet: { balance }, plans: activePlans(subs) };
}

/** the poster and the plan to offer when the fan can't watch the live stream */
export function streamLockFor(poster: string | null): NonNullable<LiveMatchDetail["streamLock"]> {
  const plan = planById(LIVE_STREAM_PLAN)!;
  return { planId: plan.id, planName: plan.name, priceLabel: priceLabel(plan), poster };
}

/** POST /api/site/subscriptions */
export async function purchase(viewer: Viewer, body: { planId: string; pointsToUse: number; idempotencyKey: string }): Promise<SubscriptionResult> {
  const plan = planById(body.planId);
  if (!plan) throw new WalletError(404, "unknown plan");
  const points = body.pointsToUse;
  if (!Number.isInteger(points) || points < 0) throw new WalletError(400, "points must be a whole number, 0 or more");
  // the cap and the 50% rule, whatever the client sent
  if (points > plan.maxPointsUsable) throw new WalletError(400, `at most ${plan.maxPointsUsable} points for ${plan.name}`);
  if (points > halfPriceInPoints(plan.priceCents)) throw new WalletError(400, "points can cover at most half of the price");
  const { payCents } = quote(plan, points);
  if (payCents <= 0) throw new WalletError(400, "part of the price must be paid in money");

  const user = await ensureUser(viewer);
  const db = getDb();
  const res = await db.wallet.purchase({ userId: user.id, planId: plan.id, points, amountEur: payCents / 100, days: plan.durationDays, idempotencyKey: body.idempotencyKey });
  if (res.status === "insufficient") throw new WalletError(409, `not enough points: you have ${res.balance}`);
  if (res.status !== "ok") throw res.status === "conflict" ? new WalletError(409, "this purchase key belongs to someone else") : new WalletError(400, "invalid purchase");

  const subs = await subscriptionsOf(user);
  const until = subs.filter((s) => s.planId === plan.id && current(s)).map((s) => s.expiresAt).sort().at(-1) ?? res.row.expiresAt;
  if (!res.replayed) {
    await db.notifications.create([
      {
        userId: user.id,
        type: "subscription",
        title: `${plan.name} is on`,
        body: `Valid until ${shortDate(new Date(until))} · ${res.row.pointsUsed} points used · ${fmtEur(payCents)} paid (demo)`,
        link: plan.includesLiveStream ? "/sports?show=live" : "/rewards",
        dedupeKey: `subscription:${res.row.id}`,
      },
    ]);
  }
  return { purchase: record(res.row), until, balance: res.balance, replayed: res.replayed, asOf: new Date().toISOString(), source: "db" };
}

/** stops renewal; the plan stays valid until it expires */
export async function cancel(viewer: Viewer, planId: string): Promise<{ cancelled: number; until: string | null }> {
  if (!planById(planId)) throw new WalletError(404, "unknown plan");
  if (!viewer.user) throw new WalletError(404, "no plan to cancel");
  const n = await getDb().wallet.cancel(viewer.user.id, planId);
  const until = (await subscriptionsOf(viewer.user)).filter((s) => s.planId === planId && current(s)).map((s) => s.expiresAt).sort().at(-1) ?? null;
  return { cancelled: n, until };
}

/** "KALEVA-DEMO-7F3K9Q": demo codes, never valid anywhere */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const demoCode = () => `KALEVA-DEMO-${[...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;

/** POST /api/site/offers/:id/redeem: once per fan; a second call shows the same code */
export async function redeemOffer(viewer: Viewer, offerId: string): Promise<OfferResult> {
  const offer = rewardsConfig.offers.find((o) => o.id === offerId);
  if (!offer) throw new WalletError(404, "unknown offer");
  const user = await ensureUser(viewer);
  const db = getDb();
  if (offer.costPoints === null) {
    // members only: a code for anyone with a running plan (and whoever already has one)
    const had = (await db.wallet.redemptions(user.id)).some((r) => r.offerId === offerId);
    if (!had && !(await hasAnyPlan(user))) throw new WalletError(403, "Included with a Kaleva subscription");
  }
  const res = await db.wallet.redeem({ userId: user.id, offerId, points: offer.costPoints ?? 0, code: demoCode() });
  if (res.status === "insufficient") throw new WalletError(409, `not enough points: you have ${res.balance}`);
  if (res.status !== "ok") throw new WalletError(400, "invalid redemption");
  return {
    offerId,
    code: res.row.code,
    pointsUsed: res.row.pointsUsed,
    partnerUrl: offer.partnerUrl ?? null,
    balance: res.balance,
    replayed: res.replayed,
    asOf: new Date().toISOString(),
    source: "db",
  };
}

const TAGS: Record<string, string> = { digital: "News + journalism", "sports-pass": "Live sport", weekend: "Flexible access" };

/** the plans, offers and purchase history as this fan sees them */
export async function rewardsState(user: DbUser | null): Promise<{ subscriptions: Subscription[]; offers: RewardOffer[]; history: PurchaseRecord[] }> {
  const [subs, redemptions] = await Promise.all([subscriptionsOf(user), user ? getDb().wallet.redemptions(user.id) : []]);
  const active = activePlans(subs);
  const anyPlan = active.length > 0;
  const subscriptions = PLANS.map((p: Plan): Subscription => {
    const mine = active.find((a) => a.planId === p.id);
    return {
      id: p.id,
      tag: TAGS[p.id] ?? "Kaleva",
      title: p.name,
      description: p.description,
      priceLabel: priceLabel(p),
      included: !!mine,
      includes: p.includes,
      priceCents: p.priceCents,
      maxPointsUsable: p.maxPointsUsable,
      includesLiveStream: p.includesLiveStream,
      active: mine ? { until: mine.until, cancelled: mine.cancelled } : null,
    };
  });
  const offers = rewardsConfig.offers.map((o): RewardOffer => {
    const r = redemptions.find((x) => x.offerId === o.id);
    return { ...o, redemption: r ? { code: r.code, at: r.createdAt } : null, eligible: o.costPoints === null ? anyPlan : true };
  });
  return { subscriptions, offers, history: subs.map(record) };
}
