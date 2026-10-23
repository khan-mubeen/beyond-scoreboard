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
- `ValidationErrorType`: `uncited_sentence | model_typed_number | unknown_name | quote | off_ice_claim`
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

### story: `@/features/story` (browser-safe)

- `buildLedger(inputs): Fact[]`, same inputs give the same ids · `FACT_LABELS`
- `verify(content, ledger): VerificationReport`, deterministic, the only judge
- `contentId(meta)`, `parseContentId(id)`
- `FactChip`, `VerifiedBadge`, `StorySection`, `VerificationPanel`

### story: `@/features/story/server`

- `generateBrief(teamId, gameId, language): Promise<Content>`, from the cache, else the template
- `generateStory(teamId, gameId, language): Promise<Content>`, same
- `getVerification(contentId): Promise<VerificationReport | null>`

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

## Mock data (`shared/mock/`)

`teams.json` (17 teams), `games.json` (seasons of the two demo teams), `stakes-card.json`, `fact-inputs.json`, `content.json` (verified story + ledger + report with one blocked claim), `room-states.json` (13 states, a full game). Load them through `shared/mock/index.ts`.
