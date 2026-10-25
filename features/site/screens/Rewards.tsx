import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { MAX_POINTS_SHARE, POINTS_PER_EURO } from "@/shared/config/plans";
import type { RewardOffer, RewardsPage, UserSummary } from "@/shared/types";
import { fmtInt } from "../format";
import { Icon } from "../components/Icon";
import { PointsBalanceCard } from "../components/PointsCard";
import { CheckoutModal } from "../components/Checkout";
import { AchievementBadge, OfferCard, PurchaseHistory, SubscriptionCard } from "../components/RewardCards";
import { ActionLink } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { Bone, DataUnavailable, PageSkeleton } from "../components/Skeleton";
import { useMe, useRewardsPage } from "../data";
import { NAMES } from "@/shared/copy/names";

function Section({ title, link, children, id, aside }: { title: string; link?: { label: string; href: string }; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="mt-8 scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold">{title}</h2>
        {aside}
        {link && (
          <ActionLink href={link.href}>
            {link.label} <Icon name="arrowRight" className="size-4" />
          </ActionLink>
        )}
      </div>
      {children}
    </section>
  );
}

const EARN = [
  [NAMES.call, "20 points for every call you get right during a live match, 10 for party trivia."],
  ["Match prediction", "30 points when your one prediction per match (who wins, made before the game) is right."],
  [NAMES.watchTogether, "Join a match's party from its page and climb the party board."],
  ["Every week", "The Weekly Leaderboard runs Monday to Sunday; season points never reset."],
];

/** "How points work": earning, spending, and what points are not */
function HowPointsWork() {
  const [open, setOpen] = useState(false);
  return (
    <section id="how-to-earn" aria-label="How points work" className="mt-8 scroll-mt-20 rounded-card border border-line bg-surface shadow-card">
      <button type="button" aria-expanded={open} aria-controls="how-points-body" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <span className="font-serif text-2xl font-bold">How points work</span>
        <Icon name="chevronDown" className={`size-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="how-points-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Earn</h3>
                <ul className="grid gap-2">
                  {EARN.map(([title, text]) => (
                    <li key={title} className="rounded-lg bg-surface-2 p-3 text-sm">
                      <p className="font-semibold">{title}</p>
                      <p className="mt-0.5 text-muted">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Spend</h3>
                <ul className="grid gap-2 text-sm">
                  <li className="rounded-lg bg-surface-2 p-3">
                    <p className="font-semibold">On a plan</p>
                    <p className="mt-0.5 text-muted">
                      {POINTS_PER_EURO} points = €1. Points can cover at most {Math.round(MAX_POINTS_SHARE * 100)}% of a price, so part of it is always paid (demo money only).
                    </p>
                  </li>
                  <li className="rounded-lg bg-surface-2 p-3">
                    <p className="font-semibold">On partner offers</p>
                    <p className="mt-0.5 text-muted">Unlock a demo code with points, or get members-only codes with any plan. One code per fan and offer.</p>
                  </li>
                  <li className="rounded-lg bg-surface-2 p-3">
                    <p className="font-semibold">What points are not</p>
                    <p className="mt-0.5 text-muted">Points have no cash value. Spending never moves you down a leaderboard: boards count earned points only.</p>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const CATEGORIES: { id: "all" | NonNullable<RewardOffer["category"]>; label: string }[] = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "sports", label: "Sports" },
  { id: "travel", label: "Travel" },
  { id: "shopping", label: "Shopping" },
];

function RewardsBody({ page, user, balance }: { page: RewardsPage; user: UserSummary | null; balance: number }) {
  const [checkout, setCheckout] = useState<{ planId: string; points: number } | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const offers = page.offers.filter((o) => category === "all" || o.category === category);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pb-12 md:px-6">
      <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: `${page.titleLead} ${page.titleAccent}` }]} />
      <main className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[40px] leading-tight font-bold">
              {page.titleLead} <span className="text-accent">{page.titleAccent}</span>
            </h1>
            <p className="mt-1 text-[15px] text-muted">{page.subtitle}</p>
          </div>
          <span className="mt-4">
            <ActionLink href="#how-to-earn">
              How points work <Icon name="arrowRight" className="size-4" />
            </ActionLink>
          </span>
        </div>

        <div className="mt-5">{user ? <PointsBalanceCard user={user} earnChips={page.earnChips} /> : <Bone className="h-36 rounded-card" />}</div>

        <Section
          title="Subscriptions"
          id="plans"
          aside={
            <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-bold text-accent tabular-nums" data-testid="balance-chip">
              <Icon name="star" className="size-4" /> {fmtInt(balance)} pts to use
            </span>
          }
        >
          <p className="-mt-2 mb-6 text-sm text-muted">Pay part of a plan with your points: move the slider to see the price. 100 points = €1, up to half of the price.</p>
          <div className="grid items-start gap-6 md:grid-cols-3">
            {page.subscriptions.map((s) => (
              <SubscriptionCard key={s.id} sub={s} balance={balance} onSubscribe={(points) => setCheckout({ planId: s.id, points })} />
            ))}
          </div>
          {page.history && page.history.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 font-semibold">Your purchases</h3>
              <PurchaseHistory items={page.history} />
            </div>
          )}
        </Section>

        <Section
          title="Partner offers"
          aside={
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter offers">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={`h-8 rounded-full px-3 text-sm font-semibold transition-colors ${category === c.id ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-surface-2"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          }
        >
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </AnimatePresence>
          </motion.div>
          {!offers.length && <p className="text-sm text-muted">No offers in this category yet.</p>}
          <p className="mt-3 text-xs text-muted">The partners here are fictional, made up for this demo.</p>
        </Section>
        <CheckoutModal planId={checkout?.planId ?? null} initialPoints={checkout?.points ?? null} open={checkout !== null} onClose={() => setCheckout(null)} />

        <Section title="Your achievements" link={{ label: "View all", href: "/achievements" }}>
          <div className="grid gap-4 md:grid-cols-3">
            {page.achievements.map((a) => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        </Section>

        <HowPointsWork />

        <p className="mt-8 text-xs text-muted">{page.footnote}</p>
      </main>
    </div>
  );
}

/** kaleva rewards (docs/design/04-rewards.png). the balance comes from /me, like the sidebar */
export function Rewards() {
  const { data: page, status, source, refresh } = useRewardsPage();
  const me = useMe();
  return (
    <SiteLayout sidebar={{ activeLinkId: "rewards", variant: "compact", docked: true }} source={source === "mock" ? source : null}>
      {page ? (
        <RewardsBody page={page} user={me.data?.user ?? null} balance={me.data?.wallet.balance ?? 0} />
      ) : status === "error" ? (
        <DataUnavailable what="your rewards" onRetry={refresh} />
      ) : (
        <PageSkeleton />
      )}
    </SiteLayout>
  );
}
