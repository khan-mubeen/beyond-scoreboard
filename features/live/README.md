# live

The room: replay clock, live calls, joining, answers, scoring, and the phone and host screens.

## Public API

Browser-safe, `@/features/live`:

- `stateAt(events, t, game)`, `scheduleCalls(events, t, game)`, `resolveCall(call, events)`, `isLate(call, t)`, `isOpen(call, t)`, `toPublicCall(call)`
- `formatGameClock`, `periodAt`, `gameTimeAt`, `CALL_POINTS`
- `useRoomState(code, playerId?)` (polls every second) and `useJoinUrl(code)`, also used by the big screen

Server only, `@/features/live/server`:

- `getRoomState(code, playerId?)`, `store`

Route handlers (`server/routes/`): create, join, control, state, answers. They are wired up in `server/api.ts`.

## Layout

- `replay/`: pure. `state-at.ts`, `clock.ts` (stub: 1 game second per second), `control.ts` (what host actions do)
- `calls/`: pure. `templates.ts`, `schedule.ts`, `resolve.ts`, `scoring.ts`, `lock.ts`, `public.ts`
- `components/`: `CallCard`, `Countdown`, `JoinForm`, `FinalCard`, `HostControls`, plus the polling and session hooks
- `screens/`: `PhoneRoom.tsx`, `HostRoom.tsx`, `DevLive.tsx`, `Landing.tsx`
- `server/`: `index.ts`, `store.ts` (in memory, lost on restart), `routes/`
- `scripts/fake-players.ts`: talks to a running server over http only

## Rules that must hold

- Nothing after the current game time ever reaches a phone (`tests/no-leak.test.ts`).
- `correctOptionId` never leaves the server before resolution. Clients only get `PublicCall`.
- Answers at or after `locksAt` get a 409.

## Test alone

- `npm run dev`, then open `/dev/live` and step through all 13 mock states.
- `/room/TEST/host` to drive the TEST room, with `/room/TEST` on your phone.
- `npm run fake-players -- TEST 30` while the dev server runs.
- `npm test -- features/live`

## Done when

- [ ] the no-leak test passes
- [ ] late answers are rejected
- [ ] 30 fake players complete a full replay

## Todo

- resolve `none` / `no` / regulation results after `resolvesAt` (`calls/resolve.ts`)
- real replay speed and intermission gaps (`replay/clock.ts`)
- host auth on the control route
