# live

The live engine for Kaleva Sports matches (Your Call! on real and replayed Liiga games), plus the older watch party room: replay clock, live calls, joining, answers, scoring, and the phone and host screens.

## Public API

Browser-safe, `@/features/live` (watch party):

- `stateAt(events, t, game)`, `scheduleCalls(events, t, game)`, `resolveCall(call, events)`, `isLate(call, t)`, `isOpen(call, t)`, `toPublicCall(call)`
- `formatGameClock`, `periodAt`, `gameTimeAt`, `CALL_POINTS`
- `useRoomState(code, playerId?)` (polls every second) and `useJoinUrl(code)`, also used by the big screen

Server only, `@/features/live/server`:

- watch party: `getRoomState(code, playerId?)`, `store`
- engine: `startEngine(renderer)`, `engineMatch(id)`, `ensureLiveLoop(id, game)`, `activeReplays()`, `matchSince(id)`, `controlReplay(id, action)`
- `answerCall(callId, userId, optionId)`, `publish(matchId, messages)`, `recentBroadcasts`, `phraseProblem`, `PHRASE_VARS`, `BUILT_IN`
- leadership: `startLeadership()`, `stopLeadership()`, `isLeader()`, `leaderInfo()`, `onLeadership(fn)`, `INSTANCE`
- the party: `roomScope(matchId)` (key, cycle, since), `refreshRoom(matchId)`, `TRIVIA_POINTS`, the renderer's `leaderboard`, `goalLine`, `post` and `trivia`

Route handlers (`server/routes/`): the watch party's create, join, control, state, answers, wired up in `server/api.ts`. The engine's routes are in `features/site/server/routes/site.ts`.

## Layout

- `engine/`: pure. `replay.ts` (a finished game as it stood at game time t, the replay clock), `rules.ts` (when a call opens, how it resolves, when it is cancelled), `phrases.ts` (call wordings)
- `server/engine.ts`: one `MatchLoop` per match. A live game ticks every 5 s on the cached api, a replay every 1 s, the rotation every 0.5 s. On the leader, each tick locks, cancels or resolves calls, pays points, maybe opens the next call or a trivia question (a play gap: no call open, 90 s since the last question, at most one per 2 minutes), posts goal and result lines to the party feed, re-reads the party every second, re-renders on change and broadcasts. On a follower the same loops are mirrors: they read the leader's calls from the database for their pages and never open, settle, pay or broadcast; a promoted follower adopts the calls it mirrored. The site injects the renderer, so this feature never imports site
- `server/leader.ts`: the engine leader lease (`claim_engine_leader` in Postgres, renew 5 s, TTL 15 s, followers try every 2 s; memory db: always the leader)
- `server/realtime.ts`: Supabase Realtime broadcast over REST on private `match:{id}` channels
- `server/calls.ts`: answering a call
- `replay/`, `calls/`, `components/`, `screens/`, `server/store.ts`: the watch party (in memory)
- `scripts/fake-players.ts`: fans over http only, each with its own cookie
- `scripts/demo-tunnel.ts`: `npm run demo:tunnel`, a cloudflare quick tunnel to the local server; tells the server its public address

## Rules that must hold

- Nothing after the replay clock reaches a fan: no future goals, no final totals, no video (`tests/replay.test.ts`, on every recorded game).
- An open call never carries its answer or the split (`tests/server.test.ts` checks every broadcast).
- Only events after the lock decide a call; one that decides it while answers are open cancels it (`tests/rules.test.ts`).
- One answer per fan per call, none after the lock, 20 points once per correct call (`tests/ledger.test.ts`).
- A replay runs at 1x while a call takes answers, so the window is as long in game time as in a live game.

## Test alone

- `npm test -- features/live`
- `DEMO_REPLAY_MATCH_ID=2027-2701404 HOST_TOKEN=x npm run dev`, then `HOST_TOKEN=x npm run fake-players -- 2027-2701404 30`
- `/match/2027-2701404?host=1` to drive the replay by hand
- watch party: `/dev/live`, `/room/TEST/host` with `/room/TEST` on your phone

## Todo

- Intermissions in the replay (it runs straight through).
- Speeds above about 60x skip call windows (the engine samples once a second).
