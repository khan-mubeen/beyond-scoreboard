import { motion } from "motion/react";
import { useState } from "react";
import { clampPoints, defaultPoints, FEATURES, fmtEur, planById, pointsCap, quote } from "@/shared/config/plans";
import type { Achievement, AchievementIcon, PurchaseRecord, RewardOffer, Subscription } from "@/shared/types";
import { fmtInt } from "../format";
import { cancelPlan, redeemOfferApi } from "../data";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";
import { Pill } from "./SectionCard";
import { toast } from "./Toast";

const card = "flex flex-col rounded-card border bg-surface p-5 shadow-card";
export const OFFER_NOTE = "Demo offer — fictional partner, code not valid anywhere.";
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(iso));

/**
 * a plan: the price, the checklist, and a live price preview: a points slider with the same rules
 * as the checkout (the plan's cap, at most half of the price, the balance), "You pay €4.40" as it
 * moves. Subscribe opens the checkout with the slider's value
 */
export function SubscriptionCard({ sub, balance, onSubscribe }: { sub: Subscription; balance: number; onSubscribe: (points: number) => void }) {
  const plan = planById(sub.id);
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState<number | null>(null);
  const active = sub.active ?? null;
  if (!plan) return null;
  const cap = pointsCap(plan, balance);
  const points = edited === null ? defaultPoints(plan, balance) : clampPoints(plan, balance, edited);
  const q = quote(plan, points);
  const popular = !!plan.popular;

  async function cancel() {
    setBusy(true);
    const res = await cancelPlan(sub.id);
    setBusy(false);
    if (!res.ok) return toast(res.error, { tone: "bad" });
    toast(`${sub.title} cancelled — it stays active until ${res.data.until ? day(res.data.until) : "it ends"}`);
  }
  return (
    <motion.article
      layout
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`${card} relative ${popular ? "border-2 border-accent shadow-lg" : active ? "border-2 border-good" : "border-line"}`}
      data-testid={`plan-${sub.id}`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-wide whitespace-nowrap text-accent-ink uppercase shadow">
          ★ Most popular
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <Pill tone={active ? "good" : "neutral"} className="rounded-md">
          {active ? (active.cancelled ? "Cancelled" : "Active") : sub.tag}
        </Pill>
        {plan.includesLiveStream && (
          <span className="flex items-center gap-1 text-xs font-bold text-live">
            <Icon name="play" className="size-3.5" /> Live
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold">{sub.title}</h3>
      <p className="mt-1 text-sm text-muted">{sub.description}</p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-black tabular-nums">{fmtEur(plan.priceCents)}</span>
        <span className="text-sm text-muted">/ {plan.durationLabel}</span>
      </p>

      <ul className="mt-3 flex flex-col gap-1.5 text-sm" aria-label={`${sub.title} includes`}>
        {FEATURES.map((f) => {
          const has = plan.features.includes(f.id);
          return (
            <li key={f.id} className={`flex items-center gap-2 ${has ? "" : "text-muted line-through decoration-muted/50"}`}>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full ${has ? "bg-good-soft text-good" : "bg-surface-2 text-muted"}`}>
                <Icon name={has ? "check" : "close"} className="size-3" />
              </span>
              <span>
                {f.label}
                <span className="sr-only">{has ? " (included)" : " (not included)"}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* the price preview: the checkout's rules, before opening it */}
      <div className="mt-4 rounded-lg bg-surface-2 p-3">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <label htmlFor={`preview-${sub.id}`} className="font-semibold">
            Use points
          </label>
          <span className="text-muted tabular-nums">up to {fmtInt(plan.maxPointsUsable)}</span>
        </div>
        <input
          id={`preview-${sub.id}`}
          type="range"
          min={0}
          max={cap}
          step={10}
          value={points}
          disabled={cap === 0}
          onChange={(e) => setEdited(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer accent-[var(--pp-accent)]"
          aria-valuetext={`${points} points, you pay ${fmtEur(q.payCents)}`}
        />
        <div className="mt-1 flex items-baseline justify-between gap-2 tabular-nums" aria-live="polite" data-testid={`preview-${sub.id}`}>
          <span className="text-xs text-muted">
            {fmtInt(points)} pts = −{fmtEur(q.discountCents)}
          </span>
          <motion.span key={q.payCents} initial={{ scale: 1.15, color: "var(--pp-accent)" }} animate={{ scale: 1, color: "var(--pp-ink)" }} className="text-base font-black">
            You pay {fmtEur(q.payCents)}
          </motion.span>
        </div>
        {cap < plan.maxPointsUsable && <p className="mt-1 text-[11px] text-muted">Your balance allows {fmtInt(cap)} points.</p>}
      </div>

      {active && <p className="mt-3 text-sm font-semibold">{active.cancelled ? `Access until ${day(active.until)}` : `Active until ${day(active.until)}`}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onSubscribe(points)}
          className={`h-11 flex-1 rounded-lg text-sm font-semibold transition hover:brightness-110 ${popular ? "bg-accent text-accent-ink" : "border border-accent bg-surface text-accent hover:bg-surface-2"}`}
        >
          {active ? "Extend" : "Subscribe"}
        </button>
        {active && !active.cancelled && (
          <button type="button" disabled={busy} onClick={() => void cancel()} className="h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
        )}
      </div>
    </motion.article>
  );
}

/** the fan's purchases, newest first */
export function PurchaseHistory({ items }: { items: PurchaseRecord[] }) {
  if (!items.length) return <p className="text-sm text-muted">No purchases yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface text-sm shadow-card">
      {items.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <span className="font-semibold">{p.planName}</span>
          <span className="text-muted">
            {day(p.startedAt)} – {day(p.expiresAt)}
          </span>
          <span className="tabular-nums">
            {fmtInt(p.pointsUsed)} pts + {p.amountLabel} <span className="text-muted">(demo)</span>
          </span>
          <Pill tone={p.status === "active" ? "good" : "neutral"}>{p.status === "active" ? "Active" : p.status === "cancelled" ? "Cancelled" : "Expired"}</Pill>
        </li>
      ))}
    </ul>
  );
}

/** a demo code, "Copy code" and the partner's site (none for the fictional partners) */
function CodeBox({ code, partnerUrl }: { code: string; partnerUrl: string | null | undefined }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copied");
    } catch {
      toast(`Your code: ${code}`);
    }
  }
  return (
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col gap-2">
      <p className="rounded-lg border border-dashed border-accent bg-accent-soft px-3 py-2 text-center font-mono text-lg font-bold tracking-wider text-accent" data-testid="offer-code">
        {code}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className="h-10 flex-1 rounded-lg border border-line text-sm font-semibold hover:bg-surface-2">
          Copy code
        </button>
        {partnerUrl && (
          <a href={partnerUrl} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110">
            Go to partner site <Icon name="arrowUpRight" className="size-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

/** the partner's coloured header: an invented monogram on its palette, with a simple pattern */
function PartnerHeader({ offer }: { offer: RewardOffer }) {
  const p = offer.partner;
  if (!p) return null;
  const pattern =
    p.pattern === "stripes"
      ? `repeating-linear-gradient(135deg, ${p.accent}33 0 10px, transparent 10px 22px)`
      : p.pattern === "dots"
        ? `radial-gradient(${p.accent}55 1.5px, transparent 1.5px) 0 0 / 12px 12px`
        : "none";
  return (
    <div className="relative -mx-5 -mt-5 mb-3 flex items-center gap-3 rounded-t-card px-4 py-4" style={{ background: p.bg, color: p.fg }}>
      <span aria-hidden className="absolute inset-0 rounded-t-card" style={{ background: pattern }} />
      <span aria-hidden className="relative grid size-11 shrink-0 place-items-center rounded-xl border-2 text-base font-black tracking-tight" style={{ borderColor: p.accent, color: p.fg }}>
        {p.monogram}
      </span>
      <span className="relative min-w-0">
        <span className="block truncate font-bold">{p.name}</span>
        <span className="text-xs opacity-80">{offer.tag}</span>
      </span>
    </div>
  );
}

/**
 * a partner offer. points: "Unlock with N pts" → confirm → the code. members only: the code with
 * any plan, else "Included with a Kaleva subscription". once per fan: the code stays
 */
export function OfferCard({ offer }: { offer: RewardOffer }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const shown = code ?? offer.redemption?.code ?? null;
  const points = offer.costPoints;

  async function redeem() {
    setBusy(true);
    const res = await redeemOfferApi(offer.id);
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return toast(res.error, { tone: "bad" });
    setCode(res.data.code);
    toast(res.data.replayed ? "Here's your code again" : points ? `Unlocked: ${fmtInt(res.data.pointsUsed)} points used` : "Your member code");
  }

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`${card} overflow-hidden border-line`} data-testid={`offer-${offer.id}`}>
      {offer.partner ? <PartnerHeader offer={offer} /> : <Pill className="self-start rounded-md">{offer.tag}</Pill>}
      <h3 className="font-bold">{offer.title}</h3>
      <p className="mt-1 mb-3 text-sm text-muted">{offer.description}</p>
      <div className="mt-auto flex flex-col gap-2">
        <p className="text-xs font-bold tracking-wider uppercase">{points !== null ? <span className="text-accent">{fmtInt(points)} pts</span> : <span className="text-good">Members only</span>}</p>
        {shown ? (
          <CodeBox code={shown} partnerUrl={offer.partnerUrl} />
        ) : points !== null ? (
          <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-lg border border-accent/40 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft">
            Unlock with {fmtInt(points)} pts
          </button>
        ) : offer.eligible ? (
          <button type="button" disabled={busy} onClick={() => void redeem()} className="h-10 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
            Members only · Get your code
          </button>
        ) : (
          <>
            <p className="text-sm font-semibold">Included with a Kaleva subscription</p>
            <a href="#plans" className="flex h-10 items-center justify-center rounded-lg border border-line text-sm font-semibold hover:bg-surface-2">
              See plans
            </a>
          </>
        )}
        <p className="text-[11px] text-muted">{OFFER_NOTE}</p>
      </div>
      <Modal open={confirming} onClose={() => setConfirming(false)} title="Unlock this offer?">
        <p className="font-semibold">{offer.title}</p>
        <p className="mt-1 text-sm text-muted">
          {fmtInt(points ?? 0)} points leave your balance and you get a code. One per fan.
        </p>
        <p className="mt-2 text-xs text-muted">{OFFER_NOTE}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void redeem()} className="h-11 flex-1 rounded-lg bg-accent font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
            {busy ? "Unlocking…" : `Unlock with ${fmtInt(points ?? 0)} pts`}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-lg border border-line px-4 font-semibold">
            Not now
          </button>
        </div>
      </Modal>
    </motion.article>
  );
}

const BADGE_ICON: Record<AchievementIcon, IconName> = { star: "star", bolt: "bolt", rook: "rook" };

export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <article className={`${card} flex-row items-center gap-3 border-line p-4`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={BADGE_ICON[achievement.icon]} className="size-5" />
      </span>
      <div>
        <h3 className="font-semibold">{achievement.title}</h3>
        <p className="text-xs text-muted">{achievement.subtitle}</p>
      </div>
    </article>
  );
}
