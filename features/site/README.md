# site

The Kaleva Sports pages from `docs/design/`: Sports home, the live and finished match pages, and Kaleva Rewards, on real Liiga data, and their api (`/api/site/*`, see `docs/contract.md`).

## How it fits

- **Data:** `data.ts` is the only place screens get data from (`useSiteChrome`, `useHomePage`, `useMatchDetail`, `useRewardsPage`, …). It fetches `/api/site/*` and falls back to `shared/mock/site/` when `VITE_USE_MOCKS=true` or a request fails. Live matches add `components/use-live-match.ts` (realtime, then polling).
- **Server:** `server/` builds each page from liiga, stakes, story and the db (`home.ts`, `match.ts`, `rewards.ts`, `state.ts`), and `live-render.ts` is the renderer the live engine uses, so a broadcast and a page load always agree. `routes/site.ts` validates with zod and refuses any response with a betting field.
- **Theme:** site routes set `data-theme="site"` on `<html>` (see `app/main.tsx`). That theme redefines the shared tokens in `shared/styles/tokens.css` to white, black and Kaleva red (`#d80016`, sampled from the designs). Room and dev pages keep the dark theme. Components use token classes only, never raw colours.
- **Layout:** full width, like YouTube. `SiteLayout` owns the sidebar. Home, rewards and the placeholder pages dock it at the far left on screens of 1024px and up, and the hamburger hides or shows it (the choice is remembered). Match pages, and every page below 1024px, open it as a drawer from the left over a 50% black layer. Esc, the layer or the menu button closes it.
- **Fonts:** Playfair Display for editorial headlines, Inter for the UI; the kaleva.fi front page uses free stand-ins for its fonts: Source Serif 4, Barlow and Zilla Slab for the wordmark (Google Fonts, linked in `index.html`).
- **Images:** placeholders in `public/placeholders/` (team circles, initials, rink gradients). Every path lives in the mock data, so real images are a data change.
- **Reuse:** `zoneLabel` comes from `@/features/stakes`, and the match story is a story `Content`.

## Routes

| route                                                    | screen                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                                                      | `KalevaHome`: the kaleva.fi front page rebuilt (`kaleva.ts`, `kaleva-front.json`, `components/kaleva/KalevaChrome.tsx`) |
| `/sports`                                                | `SportsHome`                                                                           |
| `/match/:id`                                             | `MatchPage`: `LiveMatch` or `FinishedMatch` by status, `Placeholder` for an unknown id |
| `/rewards`                                               | `Rewards`                                                                              |
| `/calls`, `/calls/history`, `/achievements`, `/settings`, `/teams`, `/profile` | the fan's pages (see the root README) |

Match ids are `{season}-{gameId}` (`2027-2701404`). The design's mock pages stay at `karpat-assat-live` and `karpat-assat-final`.

## Behaviour

- **Your Call!:** the server opens, locks and resolves calls; the card counts down against server time and shows the split once locked, the answer once resolved, or "cancelled, no points" (`components/use-live-match.ts`, `use-call-it.ts`).
- **Names:** feature names (Your Call!, Watch Party) come from `shared/copy/names.ts`; the Your Call! icon is the bullseye (`target`).
- **Preview:** a match that hasn't started (a rotation match starts at its lobby) is a preview page: when, what it is worth, head-to-head, reminder and follow. State, join, presence and answers are 409 until it starts.
- **Video:** only clips we host play (the rotation highlights). Everything else links to the match on liiga.fi (`liigaGameUrl`, verified against liiga.fi); we never play liiga's own streams.
- **Watching:** match pages send a heartbeat every 30 s while visible (`useMatchChannel` with `presence`); the server counts viewers seen in the last 90 s and broadcasts `room` on every change.
- **Joining:** opening a started match joins its party (a guest row with the welcome balance, shown as "Guest"). The first party action (an answer, a message, a reaction, an invite) asks for a nickname (`NicknamePrompt`, prefilled "Kiekko-fan 482") and then runs. The cookie `ks_anon` is the fan. An old `?room=CODE` link lands in the same public party.
- **Watch Party** (`components/WatchParty.tsx`): the box under Your Call! in the right column of a live match (Your Call! is its own card on top, with "+20 pts if right" and "8 of 12 have answered"). Header: "Watch Party · N watching", the avatar stack, "N friends here", Invite. Tabs: Chat (messages with names, initial avatars and emoji; system lines for goals and results; fact cards; trivia cards; reaction bursts 🔥 👏 😱 🏒 that float on everyone's screen, `BurstLayer`; quick-ask chips), Party (here now and the board with every participant, 0 points too, Friends filter). Desktop: the video is at most ~60% wide and 45vh tall and Your Call! and the party sit beside it. Tablet: under the video, Your Call! first. Phone: Your Call! stays the bottom sheet.
- **Ask the match** (`ask/parse.ts` pure, `server/ask.ts`): a deterministic parser (English or simple Finnish) finds a player (name, surname with Finnish endings, or jersey) or one of the two teams and the question; the answer comes from the game's rosters, the season so far (counted from every game before the league clock), tonight's goals, the table, form or head-to-head. Not in the data: "That's not in the Liiga data — try age, birthplace or goals this season." (to the asker only). One ask every 5 s.
- **Trivia** (`ask/trivia.ts` pure): the leader posts a question in a play gap (live, no Your Call! open, 90 s since the last question or trivia, at most one per 2 minutes), built deterministically from rosters and season goals with the answer checked against the data. 15 s, +10 pts fixed, the result in chat.
- **Friends and invites** (`server/friends.ts`, `screens/FriendsPage.tsx`): friend codes, requests (accept or decline on `/friends`), invite links `/i/<code>` (used once, at most 10 open per fan), friends watching now. A member's invite gives the new fan one guest pass: the live stream of one match, bound to that match and cycle when first played (`POST /matches/:id/pass`), checked with the live lock.
- **Debug:** `?debug=1` on a match page shows your user id, the party and cycle, the channel status, the last event, the watching count and its source, and whether the server is the engine leader.
- **Discussion, likes, reminders:** stored in the db; new comments arrive over realtime.
- **Host:** `?host=1` shows the replay controls; the server checks `HOST_TOKEN`.
- **Charts** (`components/charts.tsx`, our own svg like `StepChart`): `ArcGauge`, `MovingTable` (rows slide, zone lines stay), `MirroredBars`, `FormStrip`, `StackedBar`. Team colours come from `team-colors.ts`.
- **Finished match** (`server/insights.ts`, `components/FinishedGraphics.tsx`): season impact (gauge, the table moving), next time (what it's worth, head-to-head, last 5, a player on a hot streak, reminder and follow), the game in one chart (tap a goal), shots and puck control per period, the player of the game.
- **What if?** (`components/WhatIfPanel.tsx`): result cards, gauges, the table tonight, the other games as chips, and the fan's one match prediction (`server/prediction.ts`).
- **Leaderboards:** every row is a bar that opens the fan's breakdown (`server/breakdown.ts`): by source, per match, right answers, the best call.
- **Rewards:** plan cards with a live price preview (the checkout's rules), a prefilled checkout, fictional partner offers with a category filter. No payments.

## Test alone

- `npm run dev`, then open the routes above at 1440, 768 and 390 px.
- `npm test -- features/site`: copy guardrails over the mock text, the whole api in-process on snapshots (no betting fields, host token, a replay end to end), and the bundle scan for server secrets.

## Todo

- Real images for posters and the featured match. "View all" and "Full table" links.
- The date selector is static.
