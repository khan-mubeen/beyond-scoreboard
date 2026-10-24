import { useState } from "react";
import type { Achievement, AchievementIcon, PurchaseRecord, RewardOffer, Subscription } from "@/shared/types";
import { fmtInt } from "../format";
import { cancelPlan, redeemOfferApi } from "../data";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";
import { Pill } from "./SectionCard";
import { toast } from "./Toast";

const card = "flex flex-col rounded-card border bg-surface p-5 shadow-card";
export const OFFER_NOTE = "Demo offer — code not valid at the partner.";
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(iso));

/** a plan: its price, the points it takes, and the fan's running period with "Cancel" */
export function SubscriptionCard({ sub, onSubscribe }: { sub: Subscription; onSubscribe: () => void }) {
  const [busy, setBusy] = useState(false);
  const active = sub.active ?? null;
  async function cancel() {
    setBusy(true);
    const res = await cancelPlan(sub.id);
    setBusy(false);
    if (!res.ok) return toast(res.error, { tone: "bad" });
    toast(`${sub.title} cancelled — it stays active until ${res.data.until ? day(res.data.until) : "it ends"}`);
  }
  return (
    <article className={`${card} ${active ? "border-2 border-accent bg-gradient-to-b from-accent-soft/60 to-surface" : "border-line"}`}>
      <Pill tone={active ? "accent" : "neutral"} className="self-start rounded-md">
        {active ? (active.cancelled ? "Cancelled" : "Active") : sub.tag}
      </Pill>
      <h3 className="mt-3 text-lg font-bold">{sub.title}</h3>
      <p className="mt-2 text-sm text-muted">{sub.description}</p>
      <p className="mt-3 text-xl font-bold tabular-nums">{sub.priceLabel}</p>
      <ul className="mt-2 mb-4 flex flex-col gap-1 text-sm text-muted">
        {sub.includesLiveStream && (
          <li className="flex items-center gap-1.5 font-semibold text-ink">
            <Icon name="play" className="size-3.5 text-accent" /> Live match stream
          </li>
        )}
        {sub.maxPointsUsable !== undefined && <li>Use up to {fmtInt(sub.maxPointsUsable)} points</li>}
        {active && <li className="font-semibold text-ink">{active.cancelled ? `Access until ${day(active.until)}` : `Active until ${day(active.until)}`}</li>}
      </ul>
      <div className="mt-auto flex gap-2">
        <button type="button" onClick={onSubscribe} className="h-10 flex-1 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110">
          {active ? "Extend" : "Subscribe"}
        </button>
        {active && !active.cancelled && (
          <button type="button" disabled={busy} onClick={() => void cancel()} className="h-10 rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
        )}
      </div>
    </article>
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

/** a demo code, "Copy code" and the partner's site */
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
    <div className="flex flex-col gap-2">
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
    <article className={`${card} border-line p-4`}>
      <Pill className="self-start rounded-md">{offer.tag}</Pill>
      <h3 className="mt-3 font-bold">{offer.title}</h3>
      <p className="mt-1 mb-4 text-sm text-muted">{offer.description}</p>
      <div className="mt-auto flex flex-col gap-2">
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
    </article>
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
