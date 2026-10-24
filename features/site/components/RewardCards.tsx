import type { Achievement, AchievementIcon, RewardOffer, Subscription } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon, type IconName } from "./Icon";
import { Pill } from "./SectionCard";

const card = "flex flex-col rounded-card border bg-surface p-5 shadow-card";

/** a pass the fan can subscribe to. included is the highlighted "you have this" state */
export function SubscriptionCard({ sub, onSubscribe }: { sub: Subscription; onSubscribe: () => void }) {
  return (
    <article
      className={`${card} ${sub.included ? "border-2 border-accent bg-gradient-to-b from-accent-soft/60 to-surface" : "border-line"}`}
    >
      <Pill tone={sub.included ? "accent" : "neutral"} className="self-start rounded-md">
        {sub.tag}
      </Pill>
      <h3 className="mt-3 text-lg font-bold">{sub.title}</h3>
      <p className="mt-2 text-sm text-muted">{sub.description}</p>
      <p className="mt-3 mb-4 text-base text-muted">{sub.priceLabel}</p>
      {sub.included ? (
        <button
          type="button"
          disabled
          className="mt-auto h-10 rounded-lg border border-accent/40 bg-surface text-sm font-semibold text-accent"
        >
          Included
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubscribe}
          className="mt-auto h-10 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110"
        >
          Subscribe
        </button>
      )}
    </article>
  );
}

/** a partner offer, unlocked with points or for members */
export function OfferCard({ offer, onAction }: { offer: RewardOffer; onAction: () => void }) {
  const unlock = offer.costPoints !== null;
  return (
    <article className={`${card} border-line p-4`}>
      <Pill className="self-start rounded-md">{offer.tag}</Pill>
      <h3 className="mt-3 font-bold">{offer.title}</h3>
      <p className="mt-1 mb-4 text-sm text-muted">{offer.description}</p>
      <button
        type="button"
        onClick={onAction}
        className={`mt-auto h-10 rounded-lg border text-sm font-semibold transition-colors ${
          unlock ? "border-accent/40 text-accent hover:bg-accent-soft" : "border-line text-ink hover:bg-surface-2"
        }`}
      >
        {unlock ? `Unlock with ${fmtInt(offer.costPoints ?? 0)} pts` : "Members only"}
      </button>
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
