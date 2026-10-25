# Rewards: points, plans and partner offers

Everything here is a demo: prices are in euros, but no payment is ever made and no card or payment details are asked for. Codes are demo codes, not valid at the partner.

## The points economy

- Fans earn points with Your Call! (20 for a correct call). In the demo, every new fan also starts with a one-time welcome balance (1,250 points, `WELCOME_POINTS`, 0 turns it off). The seeded demo profile has 1,250 points too.
- The points ledger (`points_ledger`) is the only source of truth. Earned points are positive rows; spending is a negative row with the reason `subscription` or `offer` and a `ref` to what it paid for. The balance is always the sum of the fan's ledger.
- Boards, levels and achievements count earned points only (`isEarned` in `shared/points.ts`): the welcome balance and spending never move a fan up or down a leaderboard.
- 100 points = €1 (`POINTS_PER_EURO` in `shared/config/plans.ts`). Points have no cash value.

## Plans and the 50% rule

| Plan | Demo price | Points usable | Live stream |
| --- | --- | --- | --- |
| Kaleva Digital | €12.90 / month | up to 600 | no |
| Kaleva Sports Pass | €7.90 / month | up to 350 | yes |
| Weekend Pass | €3.90 / 3 days | up to 150 | yes |

Money is always required. A plan's `maxPointsUsable` must be at most half of its price in points: 600 of 1,290, 350 of 790, 150 of 390. `checkPlans()` checks this. The server runs it at startup and refuses to start if any plan breaks it (`assertPlans`), and a test runs it too. Even a fan with 10,000 points pays the rest in (demo) money. The database adds its own check: a purchase with no money in it is refused (`demo_amount_eur > 0`).

## The plan cards

Each plan card on Rewards has the checklist (live stream, Your Call! and predictions, season stakes and What if?, audio summaries, stories, the news), "Most popular" on Kaleva Sports Pass, and a price preview: a points slider with the checkout's own rules from `shared/config/plans.ts` (`pointsCap`, `clampPoints`, `quote`: the plan's cap, at most half of the price, the balance), "You pay €4.40" as it moves. Subscribe opens the checkout prefilled with the slider's value; the server re-checks everything as below. A balance chip sits by the plans, and "How points work" opens at the bottom.

## Checkout

`POST /api/site/subscriptions` `{ planId, pointsToUse, idempotencyKey }`. The server re-checks everything the client sends:
- the plan exists (404);
- the points are a whole number from 0 up to the plan's cap and within half of the price (400);
- the balance covers them (409).

An active plan of the same kind is extended: the new period starts when the current one ends, so the fan never has the same plan twice at once. The same idempotency key returns the first result again (`replayed: true`), with one subscription and one debit. The checkout makes one key per opening, so a double click buys once.

`POST /api/site/subscriptions/cancel` `{ planId }` stops renewal; the plan stays active until it expires.

## Atomic spending

Each spend is one Postgres transaction, in `purchase_subscription(user, plan, points, amount_eur, days, key)` and `redeem_offer(user, offer, points, code)`. Both are called through Supabase RPC and are executable by the service role only. Each one:
1. takes a per-fan lock with `pg_advisory_xact_lock(hashtextextended('spend:' || user, 0))`, so parallel clicks queue;
2. returns the earlier result if this idempotency key (or this offer for this fan) was already handled;
3. sums the ledger and refuses if it doesn't cover the points;
4. inserts the subscription (or the redemption) and the negative ledger row;
5. returns the result and the new balance.

The memory database (tests, `DB_MODE=memory`) does the same behind a per-fan mutex. The balance can't go below zero and parallel clicks can't overspend; tests cover this on both paths. With 10 purchases at once and points for one, exactly one succeeds: `features/site/tests/wallet.test.ts` covers memory, and `shared/db/tests/wallet.pg.test.ts` covers Postgres (run with `RUN_PG_TESTS=true`).

## Live stream lock

On a live match the live stream is our hosted video (the demo rotation's highlight). It plays only for a fan with a running plan that includes the live stream. Everyone else gets the poster with "Watch the game live with Kaleva Sports Pass" and a Subscribe button.

This is enforced on the server: for a fan without the plan, the match payload carries no video URL at all (`highlight: null`, `streamLock` instead), and goal clips link to liiga.fi. Rendered events are broadcast to everyone, so while the match is on they never carry the hosted URL.

The host's TV (`?tv=1` with the host token) is never locked. A finished match's highlights are free for everyone. Your Call!, season stakes, events, stats, the Watch Party (chat, trivia, ask the match) and earning points are always free.

## The guest pass: a first live match free

When a fan with a plan that includes the live stream invites someone (`/i/<code>`), the new fan gets one guest pass (`guest_passes`, one per fan, ever). It is checked in the same place as the live lock:

- unused: the lock says "1 free live match from <inviter>" with "Watch free" (`POST /api/site/matches/:id/pass`), and still carries no video url;
- used here: bound to that match and rotation cycle when first played, the stream plays until that match's summary ends;
- used elsewhere (another match, or the same match in a later cycle): the lock says "Your free match is used — get Kaleva Sports Pass".

A fan's invite without such a plan gives no pass. The inviter sees "Your friend gets their first live match free" on the invite. Trivia pays a fixed 10 points into the same ledger (reason `trivia: …`, once per fan per question).

## Partner offers

The partners are fictional, made up for the demo (their names were checked against Finnish company listings): Kiekkokori Market, Lehvälaakso Market, Sokerisilta Confectionery (food), Kaukalokamari Sport (sports), Tähtisiipi Air (travel), Syvänsini Electronics and Raitarumba Design (shopping). Their colours are only inspired by well-known Finnish brands (an orange-red grocer, a green grocer, a deep-blue, a confectionery blue, an airline blue and white, a bold striped design house); no real names, logos or look-alike marks, and an invented two-letter monogram each. No partner has a website, so "Go to partner site" never shows. A filter picks Food, Sports, Travel or Shopping.


`POST /api/site/offers/:id/redeem`.

- "Unlock with N pts" spends the points atomically and returns a demo code (`KALEVA-DEMO-XXXXXX`, unique per fan).
- "Members only" gives a code to any fan with a running plan. Without one, the fan sees "Included with a Kaleva subscription".
- Once per fan per offer (`offer_redemptions` is unique on fan and offer): a second click shows the same code.
- "Go to partner site" shows only for a partner with a site (`partnerUrl`); the demo's fictional partners have none.
