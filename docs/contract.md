# Contract

Everything one part can rely on from another. Types live in `shared/types.ts`. Tell the team before changing any of it.

## Types (`shared/types.ts`)

### Liiga

- `Team`: id, name, shortName, city, colours `{ primary, secondary }`
- `Score`: `{ home, away }` goals
- `Game`: id, date (iso), homeTeamId, awayTeamId, status `scheduled | live | final`, score, decidedIn `regulation | overtime | shootout | null`
- `GameTeams`: `Pick<Game, "id" | "homeTeamId" | "awayTeamId">`, what the replay and screens need
- `GoalEvent`: id, gameId, teamId, gameTimeSeconds, period, optional scorer, assists, strength `even | powerplay | shorthanded | empty_net`

### Stakes

- `Zone`: `top4 | playoffs | safe | relegated`
- `ZoneChances`: `Record<Zone, number>`, each 0-1
- `GameOutcome`: `regulationWin | overtimeWin | overtimeLoss | regulationLoss`
- `StakesCard`: teamId, gameId, currentPosition, currentZone, zoneOddsByOutcome `Record<GameOutcome, ZoneChances>`, positionOdds `number[]` (index 0 = 1st), headline
- `ProjectedRow`: teamId, points, rank, zone (the table if the game ended now)
- `FormResult`: `W | OTW | OTL | L`
- `FactInputs`: teamId, opponentId, gameId, form, headToHead, standings, chances. Every block has `sourceGameIds`

### Story

- `Fact`: id (`F17`), label, value `number | string`, unit `string | null`, sourceGameIds
- `ContentSentence`: text, factIds
- `Content`: id (`<kind>.<teamId>.<gameId>.<language>`), kind `brief | story`, gameId, teamId, language `en | fi`, sentences, status `verified | fallback`, generatedAt
- `ValidationErrorType`: `uncited_sentence | model_typed_number | unknown_name | quote | off_ice_claim | betting_language`
- `VerifiedClaim`: text, factIds, passed, errorType, reason
- `VerificationReport`: contentId, claims, blockedCount

### Live

- `CallType`: `next_goal | goal_in_5 | regulation_result | overtime`
- `CallOption`: id, label
- `Call`: id, type, question, options, opensAt, locksAt, resolvesAt (game seconds), optional stakesLine, correctOptionId (**server only**, null until resolved)
- `PublicCall`: `Call` without `correctOptionId`, the only call shape sent to clients
- `ReplayPhase`: `pregame | live | final`
- `ReplaySnapshot`: gameTimeSeconds, phase, score, events (only events at or before gameTimeSeconds)
- `RoomPhase`: `lobby | live | intermission | final`
- `Player`: id, roomCode, nickname, joinedAt
- `Answer`: playerId, callId, optionId, answeredAt, gameTimeSeconds. Unique per (playerId, callId)
- `LeaderboardEntry`: playerId, nickname, score, rank (equal scores share a rank)
- `RoomState`: code, serverNow, phase, game, gameTimeSeconds, score, events, activeCall `PublicCall | null`, lastResolved `{ callId, correctOptionId, youWereRight? } | null`, leaderboard, me `{ playerId, score, rank } | null`, stakes, projectedTable

### API bodies

- `CreateRoomResponse` `{ code }` · `JoinRequest` `{ nickname }` · `JoinResponse` `{ code, playerId }`
- `ControlAction`: `start | pause | resume | seek | intermission | finish | reset` · `ControlRequest` `{ action, seconds? }`
- `AnswerRequest` `{ playerId, callId, optionId }` · `ApiError` `{ error }`

### Site (kaleva sports pages)

Percentages are whole numbers 0-100. Changes are percentage points.

- `TeamRef`: id, name, city?, logo (image path, a placeholder today)
- `NavLink`: label, href, active?, hasMenu? · `QuickLink`: id, label, href, icon `QuickLinkIcon`
- `UserSummary`: id, name, role, avatar, points, pointsThisWeek, level, pointsToNextLevel, levelProgress (0-1)
- `FavoriteTeam`: team, league, starred, comingSoon
- `SiteChrome`: nav, searchPlaceholder, hasNotifications, user, favorites, quickLinks (same on every page)
- `StakesChipData`: team, label, chance, change
- `MatchSummary`: id, league, status `GameStatus`, home, away, score `Score | null`, periodScores, periodLabel?, clock?, whenLabel, note?, href
- `ComingSoonCard`: id, title, league · `FeaturedMatch`: match, background, whatItMeans, stakes, openCalls
- `StakesStripItem`: id, home, away, line, href
- `SiteLeaderboardEntry`: `LeaderboardEntry` + avatar, isYou?
- `LiigaTableRow`: `ProjectedRow` + team, gamesPlayed, goalDifference · `LiigaTableData`: rows, highlightTeamId, highlightNote, fullTableHref
- `HeroData`: kicker, titleLead, titleAccent, subtitle, body, tagline, image
- `HomePage`: hero, dateLabel, featured, seasonStakesToday, live, upcoming, recent, comingSoon, leaderboard, table
- `Breadcrumb`: label, href? · `VideoInfo`: poster, title
- `MatchEvent`: id, time, period, title, detail, effect `number | null`, video
- `MatchStat`: id, label, home, away (`null` shows "Data pending"), unit?
- `StakesStep`: label, chance · `StakesTableRow`: rank, label, zone, highlight?
- `SeasonStakes`: teamName, source, chance, change, before, now, nowLabel, steps, tableTitle, tableBadge, rows, worth `Record<GameOutcome, number>`
- `Comment`: id, author, text
- `CallItState`: call `PublicCall`, points, subtitle, secondsLeft, result `{ correctOptionId, split }`, lastCall (mock only: the real api sends result after the call locks)
- `RoomLeaderboardRow`: userId?, rank, name, score, isYou? · `RoomSummary`: code, watching, subtitle, avatars, extraCount, leaderboardTitle, leaderboardNote, leaderboard (every participant, 0 points too), members?, footnote?
- `Comment` (a party feed item): id, author, text, likes?, createdAt?, kind? `chat | system | fact | trivia`, userId?, reactions? (emoji → count), fact? `FactCard`, trivia? `{ callId, points }`
- `FactCard`: question, answer, subject `{ name, photo, initials, team } | null`, source `"Liiga data"` · `Burst`: id, emoji, name, at · `PartyMember`: userId, name, active
- `GuestPassInfo`: from, status `unused | active | used`, matchId · `FriendsPageData`: friendCode, friends, incoming, outgoing (`FriendItem`: userId, name, watching) · `InviteInfo`: code, inviter, match, freeMatch, used, yours · `InviteCreated`: code, url, freeMatch
- `LiveMatchDetail` / `FinishedMatchDetail`, joined as `MatchDetail` by `status`. Shared fields: breadcrumbs, match, venue, dateLabel, spectators, stakesSummary, video, seasonStakes, events, eventsNote, stats, statsSource, statsNote. Live adds whatItMeans, discussion, guidelinesHref, callIt, room. Final adds whatItMeant (story is a `Content`), goalOfTheGame, yourNight, room, discussionHighlights, nextUp
- `Subscription`: id, tag, title, description, priceLabel, included
- `RewardOffer`: id, tag, title, description, costPoints (`null` = members only)
- `Achievement`: id, title, subtitle, icon `AchievementIcon`
- `RewardsPage`: titleLead, titleAccent, subtitle, howToEarnHref, earnChips, subscriptions, offers, achievements, footnote, user
- `DataSource`: `live | snapshot | mock | config | db` · `ApiMeta`: `{ asOf, source }`, on every `/api/site` response
- Real data made some fields nullable: `HomePage.featured`, `highlightNote`, `MatchEvent.video`, `spectators`, `callIt`, `goalOfTheGame`, `yourNight`, `nextUp`. Added: `HomePage.user / favorites`, `VideoInfo.src`, `MatchEvent.kind`, `MatchStat.display`, `Comment.likes / createdAt`, `lineups`, `isReplay`, `nextUp.matchId`. `LiveMatchDetail.status` is `live | scheduled`

### Live state (`GET /api/site/matches/:id/state` and realtime `match:{id}`)

- `LiveCallStatus`: `open | locked | resolved | cancelled`
- `LiveCall`: id, type, question, options, stakesLine, points (20), status, openedAt, locksAt (ms, server time), split (`%` per option, from the lock), correctOptionId (**only once resolved**), reason (why cancelled)
- `LiveStakes`: chips, seasonStakes, whatItMeans
- `LiveState`: matchId, serverNow, isReplay, status, clock `{ period, gameTime, label, clock }`, score, periodScores, events (newest first), stakes, call (open or locked), lastCall (resolved or cancelled), leaderboard (the party: every participant), watching, members, party `{ key, cycle }`, answered `{ callId, count }` (the open call's answer count, never a split before the lock), trivia (a `LiveCall` of type `trivia`, 10 points), feed and bursts (the polling fallback carries the party feed), server `{ role, instance }` (leader or follower), me `{ userId, nickname, matchPoints, answers, rank, of }` (from the cookie, null without a fan row), rotation (demo mode: phase, phaseEndsAt, liveStartedAt, videoSec, durationSec, paused, next)
- `MeResponse` adds publicUrl, friendCode, friends (accepted ids), friendRequests, guestPass; `streamLock` adds guestPass `{ from }` and passUsed

## Call it! rules (`features/live/engine/rules.ts`)

- Opens: who wins (first 2 minutes), who scores first (first 3 minutes of a period without a goal), power play (within a minute of a real 2- or 5-minute penalty, not offsetting), answer back (within 90 s of a goal, not in the last 2 minutes), overtime (tied, 5 to ½ minute left). One open call at a time, 60 s of game time apart, each trigger once per match (stored, so a restart doesn't repeat one).
- Answers: 20 s (`CALL_ANSWER_SECONDS`) of server time, one per fan. Late, locked, cancelled or repeated answers get 409.
- Fairness: only events after the lock decide a call. An event that would decide it while answers were open cancels it: no points either way.
- Points: 20 per correct call into `points_ledger`, unique per (user, call), so resolving twice never pays twice.

## Public functions

### stakes: `@/features/stakes` (browser-safe)

- `StakesMeter({ card, compact? })`: playoff chance, zone bar, what each result would do
- `SeasonStrip({ teamId, games, currentGameId? })`: results so far and remaining fixtures
- `ProjectedTable({ rows, highlightTeamIds? })`: the table if it ended now, animates on re-sort
- `zoneForRank(rank)`, `zoneLabel(zone)`, `zoneChancesFromPositions(positionOdds)`, `playoffChance(zoneChances)`

### stakes: `@/features/stakes/server`

- `getStakes(teamId, gameId): Promise<StakesCard>`
- `oddsByScoreState(gameId): Promise<Record<string, StakesCard>>`, keys `"home-away"` like `"2-1"`
- `getFactInputs(teamId, gameId): Promise<FactInputs>`

### live: `@/features/live` (browser-safe)

- `stateAt(events, t, game): ReplaySnapshot`, never reads events after t
- `scheduleCalls(events, t, game): Call[]`, calls opened by t, correctOptionId always null
- `resolveCall(call, events): string | null`, the correct option or null if it can't be told yet
- `isLate(call, gameTimeSeconds): boolean`, true at or after locksAt · `isOpen(call, gameTimeSeconds)`
- `toPublicCall(call): PublicCall`
- `formatGameClock(t)`, `periodAt(t)`, `gameTimeAt(clock, nowMs)`, `CALL_POINTS`
- `useRoomState(code, playerId?)`: polls `/api/rooms/:code/state` every second · `useJoinUrl(code)`

### live: `@/features/live/server`

- `getRoomState(code, playerId?): Promise<RoomState | null>`, null when the room doesn't exist
- `store`: the `RoomStore` (createRoom, getRoom, updateRoom, addPlayer, listPlayers, saveAnswer, listAnswers)
- `startEngine(renderer)`: the demo replay (`DEMO_REPLAY_*`) and every live game; the site passes its `MatchRenderer`, so live never imports site
- `engineMatch(id)`: `{ state, visible, isReplay, names } | null` · `ensureLiveLoop(id, game)` · `activeReplays()` · `matchSince(id)` (a replay's room leaderboard counts from its last reset)
- `controlReplay(id, start | pause | resume | skip | reset): Promise<string | null>`, null when done
- `answerCall(callId, userId, optionId, now?)`: 201, or 400 / 404 / 409 with an error
- `publish(matchId, messages)`: realtime broadcast over REST with the secret key; throws on betting fields · `recentBroadcasts`
- `phraseProblem(kind, template)`, `PHRASE_VARS`, `BUILT_IN`: the rules a stored call wording must pass

### liiga: `@/features/liiga` (browser-safe) and `@/features/liiga/server`

- Model and pure normalisers (`normalizeGame`, `normalizeFixture`, …), `matchIdOf` / `parseMatchId`, `describeGoalTypes`, `stripGambling` / `findGamblingFields`
- Server: `getGame(season, gameId)` `{ game, names }`, `getGamesOn(date)`, `getSchedule`, `getStandings(season, live)`, `getTeams`, `getGameStats`, `getLineups`, `getPastAndFuture`, `liigaNow()` (the snapshot's time in snapshot mode). Every getter returns `{ data, asOf, source }`. Field by field: [api/mapping.md](api/mapping.md)

### stakes: `@/features/stakes/server` (season forecast)

- `getSeasonContext()`: schedule, table, strengths · `forecastNow(ctx, targets)` · `forecastBefore(ctx, game)`: a finished game judged as the season stood before it (also used for replays) · `checkRulesAgainstApi()`
- Engine helpers: `worthFor`, `ifEndsNow`, `chanceTimeline`, `goalOfTheGame`, `tableIfEndsNow`, `rankOf`

### site: `@/features/site/server`

- `homePage(viewer)`, `matchDetail(id, viewer)`, `rewardsPage(viewer)`, `matchFactsFor(id)` (for `npm run pregen`)

### story: `@/features/story` (browser-safe)

- `buildLedger(inputs): Fact[]`, same inputs give the same ids · `FACT_LABELS`
- `verify(content, ledger): VerificationReport`, deterministic, the only judge
- `contentId(meta)`, `parseContentId(id)`
- `FactChip`, `VerifiedBadge`, `StorySection`, `VerificationPanel`

### story: `@/features/story/server`

- `generateBrief(teamId, gameId, language): Promise<Content>`, from the cache, else the template
- `generateStory(teamId, gameId, language): Promise<Content>`, same
- `getVerification(contentId): Promise<VerificationReport | null>`

### site: `@/features/site` (browser-safe, front-end only)

- `SiteLayout({ chrome, sidebar: { activeLinkId?, variant?, docked }, children })`: the full-width page shell (top nav, toasts, reduced motion) · `Breadcrumbs({ items })`. The hamburger hides or shows the docked sidebar on large screens (remembered in localStorage). On match pages (`docked: false`) and below 1024px it opens a drawer over a 50% black layer
- `SectionCard`, `Pill`, `ToastProvider`, `useToast()`
- `LiigaTable({ table })`, `ZoneLegend`, `StakesChip({ chip, dark? })`, `ChangeTag({ change })`, `StepChart({ steps })`, `CountdownRing({ seconds, total })`
- `findMatch(id): Promise<MatchDetail | null>`
- data seam: `features/site/data.ts` (`useSiteChrome`, `useHomePage`, `useMatchDetail`, `useRewardsPage`, `useMe`, `joinMatchApi`, `answerCallApi`, `postCommentApi`, `setReminderApi`). Screens get data only from here: `/api/site/*`, with `shared/mock/site/` as the fallback (`VITE_USE_MOCKS=true`, a failed request, or the two design pages)
- `useLiveMatch(detail, me)`: realtime `match:{id}` (receive only), `GET /state` on subscribe and reconnect, polling every 3 s when not subscribed within 5 s or `?realtime=off`

## HTTP API

| route                           | method | body / query                       | returns                                     |
| ------------------------------- | ------ | ---------------------------------- | ------------------------------------------- |
| `/api/rooms`                    | POST   | `{ gameId? }`                      | 201 `CreateRoomResponse`                    |
| `/api/rooms/:code/join`         | POST   | `JoinRequest`                      | 201 `JoinResponse`, 400, 404                |
| `/api/rooms/:code/control`      | POST   | `ControlRequest`                   | 200 `{ phase }`, 400, 404                   |
| `/api/rooms/:code/state`        | GET    | `?playerId=`                       | 200 `RoomState`, 404                        |
| `/api/rooms/:code/answers`      | POST   | `AnswerRequest`                    | 201, 400, 404, 409 late or already answered |
| `/api/content/brief`            | GET    | `?teamId=&gameId=&language=en\|fi` | 200 `Content`, 400                          |
| `/api/content/story`            | GET    | same                               | 200 `Content`, 400                          |
| `/api/content/:id/verification` | GET    |                                    | 200 `VerificationReport`, 404               |

### Kaleva Sports (`/api/site`)

Every request is validated with zod (400 with the reason). Every response has `asOf` and `source`, and is refused if it holds a betting field. The fan is the httpOnly `ks_anon` cookie; a users row exists from the first join.

| route                              | method | body / query                       | returns                                                        |
| ---------------------------------- | ------ | ---------------------------------- | -------------------------------------------------------------- |
| `/api/site/home`                   | GET    | `?team=&date=YYYY-MM-DD`           | 200 `HomePage`                                                 |
| `/api/site/me`                     | GET    |                                    | 200 `MeResponse` (user, follows, language, notification prefs, unread count, open call answers, demo chip, `wallet.balance`, running `plans`) |
| `/api/site/settings`               | POST   | `{ nickname?, language?: en\|fi, notificationPrefs? }` | 200 `MeResponse`, 400                       |
| `/api/site/me/reset`               | POST   |                                    | 200, removes the fan and everything of theirs, clears the cookie |
| `/api/site/notifications`          | GET    |                                    | 200 `NotificationsResponse` (made lazily: favourites, reminders, call results) |
| `/api/site/notifications/read`     | POST   | `{ ids? }` (none = all)            | 200                                                            |
| `/api/site/leaderboard`            | GET    | `?scope=weekly\|season\|room`      | 200 `LeaderboardPageData` (top 20 + your row, bots excluded)   |
| `/api/site/teams`                  | GET    |                                    | 200 `TeamsPageData` (17 teams, demo-clock table)               |
| `/api/site/teams/:slug`            | GET    | slug `kärpät`                      | 200 `TeamPageData`, 404                                        |
| `/api/site/favorites`              | POST   | `{ teamId: "123:kärpät", on }`     | 200 `{ follows }`, 400                                         |
| `/api/site/profile`                | GET    |                                    | 200 `ProfileData` (call stats, achievements)                   |
| `/api/site/calls`                  | GET    | `?view=recent\|history&match=`     | 200 `MyCallsData`                                              |
| `/api/site/whatif`                 | POST   | `{ matchId, overrides: [{ gameId, outcome }] }` (≤ 4, home view) | 200 `WhatIfResult`, 400 played / unknown / repeat, 429 > 30/min ([what-if.md](what-if.md)) |
| `/api/site/matches/:id/presence`   | POST   | `{ leave? }` (every 30 s while the page is visible) | 200 `{ watching, userId, party }`, 409 not started. Joins the match's party (a guest fan row on first visit); upserts `party_presence`; joins and leaves broadcast `room` |
| `/api/site/rotation`               | GET    |                                    | 200 `RotationInfo` (phase, ends at, current, next), 404 when `DEMO_MODE` is off |
| `/api/site/rotation/control`       | POST   | `{ action: restart\|skip\|pause\|resume }`, header `x-host-token` | 200, 403, 503                      |
| `/api/site/matches/:id`            | GET    | id `2027-2701404`                  | 200 `MatchDetail` (`status: "preview"` before the game or its rotation lobby starts), 400, 404 |
| `/api/site/matches/:id/state`      | GET    |                                    | 200 `LiveState`, 404, 409 not started                          |
| `/api/site/matches/:id/join`       | POST   | `{ nickname?, roomCode?, bot? }` (`bot` needs `x-host-token`) | 200 `{ user, nickname, room }`. Every fan is in the match's one public party; an old room code lands there too |
| `/api/site/matches/:id/control`    | POST   | `{ action }`, header `x-host-token`| 200, 400, 403 wrong token, 409 no replay, 503 no `HOST_TOKEN`  |
| `/api/site/calls/:callId/answer`   | POST   | `{ optionId }`                     | 201, 400, 404, 409 locked / cancelled / already answered       |
| `/api/site/matches/:id/comments`   | GET    |                                    | 200 `{ comments }`                                             |
| `/api/site/matches/:id/comments`   | POST   | `{ text }`, 1–280 characters       | 201 `{ comment }`, 401 no nickname, 422 too long or guardrails, 429 within 5 s. A text starting with "?" goes to `/ask` |
| `/api/site/matches/:id/bursts`     | POST   | `{ emoji }` (🔥 👏 😱 🏒)            | 201 `{ burst }`, 401 no nickname, 422 unknown, 429 within 2 s; broadcasts `burst` |
| `/api/site/matches/:id/ask`        | POST   | `{ text }` (English or simple Finnish) | 201 `{ card, comment, posted: true }` (a fact card for the party), 200 `{ card, posted: false }` (not in the data, only to the asker), 401, 429 within 5 s |
| `/api/site/matches/:id/pass`       | POST   |                                    | 200 (the guest pass is bound to this match and cycle), 404 no pass, 409 used elsewhere or not live |
| `/api/site/comments/:id/react`     | POST   | `{ emoji }`                        | 201 `{ reactions }`, 401, 404, 409 already, 422; broadcasts `reaction` |
| `/api/site/friends`                | GET    |                                    | 200 `FriendsPageData` |
| `/api/site/friends/watching`       | GET    | `?match=`                          | 200 `{ friends: [{ userId, name, matchId, title }] }` (in a party now) |
| `/api/site/friends/add`            | POST   | `{ code }`                         | 200 `{ status: requested \| friends }`, 400 own code, 401, 404 |
| `/api/site/friends/:userId/accept` | POST   |                                    | 200, 404 no request |
| `/api/site/friends/:userId/remove` | POST   |                                    | 200 (declines, cancels or unfriends) |
| `/api/site/invites`                | POST   | `{ matchId? }`                     | 201 `InviteCreated` (`PUBLIC_BASE_URL/i/<code>`), 401, 409 ten open, 429 within 3 s |
| `/api/site/invites/:code`          | GET    |                                    | 200 `InviteInfo`, 404 |
| `/api/site/invites/:code/accept`   | POST   | `{ nickname? }`                    | 200 `{ matchId, friend, pass }` (friends, the party, a guest pass from a member), 401 no nickname, 404, 409 used |
| `/api/site/public-url`             | POST   | `{ url }`, header `x-host-token`   | 200 (npm run demo:tunnel), 403, 503 |
| `/healthz`                         | GET    |                                    | 200 `{ ok, role: leader \| follower, instance, db, uptimeSec }` |
| `/api/site/comments/:id/like`      | POST   |                                    | 201, 404, 409 already liked                                    |
| `/api/site/reminders`              | GET    |                                    | 200 `{ reminders }`                                            |
| `/api/site/reminders`              | POST   | `{ matchId, on }`                  | 200 `{ matchId, on, reminders }`                               |
| `/api/site/standings`              | GET    | `?live=true\|false`                | 200 standings                                                  |
| `/api/site/rewards`                | GET    |                                    | 200 `RewardsPage` (the plans with the fan's running ones, offers with the fan's codes, purchase history) |
| `/api/site/subscriptions`          | POST   | `{ planId, pointsToUse, idempotencyKey }` | 200 `SubscriptionResult` (demo money + points, atomic), 400 cap / 50% rule, 404 plan, 409 not enough points ([rewards.md](rewards.md)) |
| `/api/site/subscriptions/cancel`   | POST   | `{ planId }`                       | 200 `{ cancelled, until }` (stays active until it ends)        |
| `/api/site/offers/:id/redeem`      | POST   |                                    | 200 `OfferResult` (a demo code, once per fan), 403 members only without a plan, 404, 409 |

## Realtime (`match:{id}`, private, broadcast)

Sent by the server only (REST, secret key). Browsers subscribe with the publishable key; the RLS policy on `realtime.messages` lets them read `match:%` broadcasts and has no insert policy, so they can't send.

| event            | payload                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `state`          | serverNow, isReplay, status, clock, score, periodScores, events (new ones only) |
| `stakes`         | chips, seasonStakes, whatItMeans, serverNow (after a goal or status change) |
| `call_open`      | call (`LiveCall`, no answer, no split), serverNow                       |
| `call_locked`    | callId, split, serverNow                                                |
| `call_resolved`  | callId, correctOptionId, split, serverNow                               |
| `call_cancelled` | callId, reason, serverNow                                               |
| `leaderboard`    | leaderboard, watching, members, at                                      |
| `room`           | leaderboard (every participant), watching (active: a heartbeat in the last 90 s, bots excluded), members, at (when it was read: pages keep the newest), on every join, leave and timeout |
| `comment`        | comment (chat, a goal or result line, a fact card, a trivia card)        |
| `game_end`       | score, decidedIn, serverNow                                             |
| `call_count`     | callId, answered (counts only; pages keep the highest)                  |
| `trivia`         | trivia (`LiveCall`; the answer only once resolved), serverNow           |
| `burst`          | burst `{ id, emoji, name, at }`                                         |
| `reaction`       | commentId, reactions (emoji → count)                                    |

Engine events (`state`, `stakes`, `call_*`, `trivia`, timeouts) come from the engine leader only. Request events (`comment`, `burst`, `reaction`, a join's `room`, an answer's `call_count`) come from the server that took the request; they are read from the database and stamped or monotonic, so two servers never conflict.

## Database (`supabase/migrations/`)

`users` (+ `is_bot`, `language`, `notification_prefs`, `friend_code` unique), `match_rooms`, `room_members`, `calls` (+ `i18n`: the Finnish wording; type `trivia` for party trivia, its answer in `resolves_rule` until the lock), `answers` (unique per call and user), `points_ledger` (unique per user and call), `comments` (the party feed: + `kind` chat / system / fact / trivia / burst, `cycle`, `data`, `dedupe_key` unique; `user_id` null for a system line), `comment_likes`, `comment_reactions` (one per fan, item and emoji), `reminders`, `content_cache`, `phrase_bank`, `notifications` (unique `dedupe_key`), `settings` (key → jsonb: the rotation clock, `engine_leader`, `public_base_url`), `user_favorites`, `user_subscriptions` (demo money + points; unique `idempotency_key`), `offer_redemptions` (unique per fan and offer), `party_presence` (match, cycle, user → joined_at, last_seen), `friendships` (user_a < user_b, pending / accepted, requested_by), `invites` (code, inviter, match, used_by once), `guest_passes` (one per fan: granted_by, used_at, consumed match and cycle). `points_ledger` has a `ref` and negative rows for spending (reasons `subscription`, `offer`). Functions: `purchase_subscription` and `redeem_offer`, one transaction each behind `pg_advisory_xact_lock` per fan; `claim_engine_leader(instance, ttl)` (one compare-and-set on the lease row) and `release_engine_leader(instance)`; all executable by the service role only. Storage: public buckets `highlights` (rotation videos and posters) and `match-audio` (summary MP3s). RLS is on for every table with no policies: only the server's secret key reads or writes. Repositories: `shared/db` (`Db` interface, Supabase and memory implementations).

## Mock data (`shared/mock/`)

`teams.json` (17 teams), `games.json` (seasons of the two demo teams), `stakes-card.json`, `fact-inputs.json`, `content.json` (verified story + ledger + report with one blocked claim), `room-states.json` (13 states, a full game). Load them through `shared/mock/index.ts`.

`shared/mock/site/`: `chrome.json` (nav, user, sidebar), `home.json`, `match-live.json`, `match-final.json`, `rewards.json`. Text and numbers come from `docs/design/`, the people are fictional, and every image is a `/placeholders/...` path. Load them through `shared/mock/site/index.ts`.
