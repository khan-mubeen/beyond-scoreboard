import { motion } from "motion/react";
import { useState } from "react";
import { clampPoints, defaultPoints, planById, pointsCap, priceLabel, summaryText, type Plan } from "@/shared/config/plans";
import type { SubscriptionResult } from "@/shared/types";
import { fmtInt } from "../format";
import { buyPlan, useMe } from "../data";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export const DEMO_PAYMENT_NOTE = "Demo — no real payment is made";

const untilLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(iso));
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * the form: what's included, the price, how many points to use (slider + number, 0 to the cap,
 * starting at the most allowed), and the live summary. one idempotency key per checkout, so a
 * double click (or a retry) buys once
 */
export function CheckoutForm({ plan, balance, onDone }: { plan: Plan; balance: number; onDone: (r: SubscriptionResult) => void }) {
  const [edited, setEdited] = useState<number | null>(null);
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cap = pointsCap(plan, balance);
  const points = edited === null ? defaultPoints(plan, balance) : clampPoints(plan, balance, edited);
  const set = (v: number) => setEdited(clampPoints(plan, balance, v));

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await buyPlan(plan.id, points, key);
    setBusy(false);
    if (res.ok) onDone(res.data);
    else setError(res.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-lg font-bold">{plan.name}</p>
        <p className="text-sm text-muted">{plan.description}</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {plan.includes.map((i) => (
            <li key={i} className="flex items-center gap-2">
              <Icon name="check" className="size-4 text-good" />
              {i}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-2xl font-bold tabular-nums">{priceLabel(plan)}</p>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="checkout-points" className="font-semibold">
            Use up to {fmtInt(cap)} points
          </label>
          <span className="text-xs text-muted tabular-nums">Your balance: {fmtInt(balance)} pts</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={cap}
            step={1}
            value={points}
            onChange={(e) => set(Number(e.target.value))}
            aria-label="Points to use"
            disabled={cap === 0}
            className="h-2 flex-1 cursor-pointer accent-[var(--pp-accent)]"
          />
          <input
            id="checkout-points"
            type="number"
            inputMode="numeric"
            min={0}
            max={cap}
            value={points}
            onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-right font-semibold tabular-nums"
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          100 points = €1. Points can cover at most half of the price ({fmtInt(plan.maxPointsUsable)} points on this plan).
        </p>
      </div>

      <p className="rounded-lg bg-accent-soft px-4 py-3 text-center font-semibold text-accent tabular-nums" aria-live="polite" data-testid="checkout-summary">
        {summaryText(plan, points)}
      </p>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void confirm()} className="h-12 rounded-lg bg-accent text-base font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
        {busy ? "Confirming…" : "Confirm purchase"}
      </button>
      <p className="-mt-2 text-center text-xs text-muted">{DEMO_PAYMENT_NOTE}</p>
    </div>
  );
}

/** the moment after: a short burst (still with reduced motion), what was bought, until when */
export function PurchaseSuccess({ result, liveHref, onClose }: { result: SubscriptionResult; liveHref?: string; onClose: () => void }) {
  const p = result.purchase;
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative grid size-24 place-items-center">
        {[...Array(10)].map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className={`absolute size-2 rounded-full ${i % 2 ? "bg-accent" : "bg-gold"}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos((i / 10) * Math.PI * 2) * 52, y: Math.sin((i / 10) * Math.PI * 2) * 52, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          />
        ))}
        <motion.span
          className="grid size-20 place-items-center rounded-full bg-good text-white"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 16 }}
        >
          <Icon name="check" className="size-10" />
        </motion.span>
      </div>
      <div>
        <p className="text-xl font-bold">{p.planName} is on</p>
        <p className="text-sm text-muted">Valid until {untilLabel(result.until)}</p>
      </div>
      <dl className="grid w-full grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-muted">Points used</dt>
          <dd className="text-lg font-bold tabular-nums">{fmtInt(p.pointsUsed)}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <dt className="text-muted">Paid (demo)</dt>
          <dd className="text-lg font-bold tabular-nums">{p.amountLabel}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">Your balance: {fmtInt(result.balance)} pts · {DEMO_PAYMENT_NOTE}</p>
      <div className="flex w-full flex-col gap-2">
        {p.includesLiveStream && (
          <a href={liveHref ?? "/sports?show=live"} onClick={onClose} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-accent-ink hover:brightness-110">
            <Icon name="play" className="size-4" /> Start watching live
          </a>
        )}
        <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line font-semibold hover:bg-surface-2">
          Done
        </button>
      </div>
    </div>
  );
}

/** the checkout for one plan, as a modal: the form, then the success screen */
export function CheckoutModal({ planId, open, onClose, liveHref }: { planId: string | null; open: boolean; onClose: () => void; liveHref?: string }) {
  const plan = planId ? planById(planId) : undefined;
  const balance = useMe().data?.wallet.balance ?? 0;
  const [done, setDone] = useState<SubscriptionResult | null>(null);
  const close = () => {
    setDone(null);
    onClose();
  };
  return (
    <Modal open={open && !!plan} onClose={close} title={done ? "You're in" : "Checkout"}>
      {/* a fresh form (and idempotency key) every time the checkout opens */}
      {plan && !done && <CheckoutForm key={String(open)} plan={plan} balance={balance} onDone={setDone} />}
      {plan && done && <PurchaseSuccess result={done} liveHref={liveHref} onClose={close} />}
    </Modal>
  );
}

