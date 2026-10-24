# beyond-scoreboard

An AI-powered sports experience featuring live match insights, personalized content, interactive predictions, fan rewards, and verified AI-generated analysis. Built for JunctionX Oulu 2026, Kaleva Media Challenge.

## PowerPlay (working name)

A watch party for Liiga, played on a replayed real game.
**Big screen:** each team's playoff and relegation chance moves with the score, and the projected table re-sorts when a goal goes in.
**Phones:** fans join by QR code and make live calls for points. **AI story:** a pre-game brief and a post-game story where every number comes from a verified fact ledger.

User-facing text always says "chance" ("playoff chance 64%"), never "odds". No prizes, no betting.

## Architecture

```
  Kaleva Sports pages (/, /match/:id, /rewards)          watch party (/room/CODE, host, screen)
     │ GET /api/site/*  POST join / answer / comment          │ poll /api/rooms/* every 1s
     │ ◄── Supabase Realtime "match:{id}" (receive only)      │
     └─────────────────────────┬──────────────────────────────┘
                               ▼
                one node process: server/main.ts (express)
        /api/* ──► server/api.ts ──► features/<part>/server/routes/*
        everything else ──► the react app (vite in dev, dist/ in prod)

  features/liiga/server  ──► Liiga API (x-api-key, cached, betting fields stripped), else snapshots
  features/stakes/server ──► Monte Carlo season forecast on the Liiga schedule (chances, worth, table)
  features/story/server  ──► fact ledger, templates, optional LLM, validator, content_cache
  features/live/server   ──► live engine: one loop per match, calls, points, Realtime broadcasts
  features/site/server   ──► the /api/site routes, built from the four above
  shared/db              ──► Supabase Postgres (RLS on, server key only), or memory

  all of them speak shared/types.ts
```

Stack: Vite + React + TypeScript (strict) + Tailwind, a small Express server, npm, Supabase (Postgres and Realtime broadcast). Without Supabase everything runs on an in-memory store and the pages poll. The older watch party rooms still live in memory.

The server is the only authority: it runs the clock, opens and locks calls, judges answers against server time, and pays points into an idempotent ledger. Browsers only receive broadcasts on private channels (RLS has no insert policy), and every response and broadcast is checked for betting fields before it leaves.

## Who owns what

| Part   | Folder             | Responsibility                                                                  |
| ------ | ------------------ | ------------------------------------------------------------------------------- |
| liiga  | `features/liiga/`  | Liiga API client, cache, normalisers, snapshots                                 |
| stakes | `features/stakes/` | standings, simulation, stakes visuals, big screen                               |
| live   | `features/live/`   | live engine, replay, Your Call! rules, answers, realtime, rooms, phone and host |
| story  | `features/story/`  | fact ledger, templates, LLM writer, validator, trust components                 |
| site   | `features/site/`   | Kaleva Sports pages and their api: home, match pages, rewards                   |
| shared | `shared/`          | contract types, db, mock data, UI primitives, tokens. tell the team before changing |

`app/` (pages) and `server/` (api wiring) are thin tables that only point at feature code.

## Quick start

```sh
npm install
npm run dev          # http://localhost:3000, api and app on one port
```

Other scripts:

| script                   | what it does                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `npm run build`          | builds the client into `dist/`                                                      |
| `npm start`              | serves `dist/` and the api (run `build` first)                                      |
| `npm test`               | vitest: engine and rules, the whole server in-process on snapshots, the bundle scan |
| `npm run lint`           | eslint, including the import rules below                                            |
| `npm run typecheck`      | `tsc --noEmit`                                                                      |
| `npm run format`         | prettier                                                                            |
| `npm run snapshot`       | record Liiga responses into `features/liiga/snapshots/` (needs the api key); `-- --games 2701379,2701398` adds only those games |
| `npm run db:migrate`     | apply `supabase/migrations/` (needs `SUPABASE_DB_URL`)                              |
| `npm run db:seed`        | demo fans, points and comments (idempotent)                                         |
| `npm run fake-players`   | `-- <matchId> [count]`, fans that join and answer every call on a running server   |
| `npm run pregen`         | `-- --match <id>`, LLM match stories into `content_cache`, validated               |
| `npm run pregen:phrases` | LLM wordings for each Your Call! question into `phrase_bank`, validated              |
| `npm run pregen:demo`    | the rotation's stories and 60-second summaries, en + fi                             |
| `npm run audio:generate` | Azure neural voice MP3s of the summaries into `match-audio` (needs `AZURE_SPEECH_KEY`) |
| `npm run audio:import`   | `-- --match <id> --lang en\|fi --file x.mp3`, a recorded summary instead           |
| `npm run demo:pick`      | picks the demo night and its 3 matches → `demo/rotation.json`, `demo/DOWNLOADS.md`  |
| `npm run demo:videos`    | builds and uploads the 3 highlight MP4s + posters (`highlights` bucket)              |
| `npm run demo:cues`      | finds each goal in the highlights → cues in `demo/rotation.json`                    |
| `npm run demo:reset`     | removes bots, answers, points, notifications and comments; restarts the rotation    |

Copy `.env.example` to `.env` to change anything; it says which variables are browser-safe (only `VITE_*`). Defaults work offline: `USE_SNAPSHOT=true` serves the recorded snapshots, no Supabase means an in-memory store, and `LLM_ENABLED=false` uses templates. The running app never waits on the LLM: texts come from `content_cache` (re-verified against the current facts) or templates, and only the deterministic validator decides what passes.

### Demo replay

A finished game replayed as live, with Your Call! running on it.

```sh
# .env: DEMO_REPLAY_MATCH_ID=2027-2701404  HOST_TOKEN=<anything>  (DEMO_REPLAY_SPEED=15)
npm run dev
# host: open http://localhost:3000/match/2027-2701404?host=1, enter the token, press Start
# or let 30 fans play it, start included:
HOST_TOKEN=<same> npm run fake-players -- 2027-2701404 30
```

The replay only shows what had happened by its clock (no final stats, no future goals). It runs at 1x while a call takes answers, so 20 s to answer is 20 s of game, as in a live game; at 15x the power play would be over before the lock. Host buttons: Start, Pause, Resume, Skip to next call, Reset (a reset starts a fresh room leaderboard; season points stay). Real live games are picked up on their own and ticked every 5 s.

### Demo night (`DEMO_MODE=true`)

The league clock is pinned at `demoNow` in `demo/rotation.json` (an hour before a real night's first game), so every page shows the season as it stood then and nothing after it leaks. Three highlight matches of that night play in a loop: lobby (60 s, "Who wins?") → live (the highlight video drives the game clock, goals land with the video, Your Call! questions between goals) → summary (600 s: final, 60-second audio summary, "Next match starts in …"). Everyone watching is in one shared Watch Together board per cycle.

```sh
npm run demo:pick && npm run demo:videos && npm run demo:cues   # once: picks, builds and cues the videos
npm run pregen:demo && npm run audio:generate                    # once: texts (and voices with an Azure key)
npm run demo:reset                                               # before showing it: clean slate, rotation from match 1
# .env: DEMO_MODE=true  HOST_TOKEN=<anything>
npm run build && npm start                                       # or npm run dev
```

- [`/demo/control`](http://localhost:3000/demo/control) host controls (token): restart, skip, pause, resume; shows the phase and what's next.
- [`/tv`](http://localhost:3000/tv) the big screen: follows the rotation, video + scoreboard + Your Call! + the board, and a QR code for phones. `/match/<id>?tv=1` is one match in TV mode.
- Phones scan the QR (same wifi, `http://<laptop-ip>:3000/match/<id>`), pick a nickname and play along; desktop/TV autoplays muted, phones show the poster until tapped.

### Pages

- [`/`](http://localhost:3000/) the Kaleva Media front page (kalevamedia.fi rebuilt; the menu adds Sports). Its other links open `/media/<page>`: "This page is part of kalevamedia.fi", with a link to the real page
- [`/sports`](http://localhost:3000/sports) Kaleva Sports home (`?show=live|results`). Old links to the sports home at `/` (`/?show=…`, `/#liiga-table`) redirect here; `/dev/brand` shows the wordmark options
- [`/match/2027-2701404`](http://localhost:3000/match/2027-2701404) a real match (`{season}-{gameId}`): live while it's played or replayed, the finished page after. `?host=1` shows the host bar, `?realtime=off` forces polling, `?room=CODE` joins a friend's room
- [`/match/karpat-assat-live`](http://localhost:3000/match/karpat-assat-live) and [`/match/karpat-assat-final`](http://localhost:3000/match/karpat-assat-final), the design's mock pages, kept working without a backend
- [`/rewards`](http://localhost:3000/rewards) Kaleva Rewards, [`/leaderboard`](http://localhost:3000/leaderboard) weekly / season / Watch Together
- [`/teams`](http://localhost:3000/teams) all 17 teams (follow with the star), [`/teams/kärpät`](http://localhost:3000/teams/k%C3%A4rp%C3%A4t) one team: chances, last 5, next 3
- [`/profile`](http://localhost:3000/profile), [`/calls`](http://localhost:3000/calls), [`/calls/history`](http://localhost:3000/calls/history), [`/achievements`](http://localhost:3000/achievements), [`/settings`](http://localhost:3000/settings) (nickname, language, notifications, reset), [`/guidelines`](http://localhost:3000/guidelines)
- On a match page, Season stakes has "What if?": set this match and up to 3 other games that night, see the playoff race change ([docs/what-if.md](docs/what-if.md))
- [`/watch`](http://localhost:3000/watch) create or join a watch party room
- [`/dev`](http://localhost:3000/dev) links to everything below
- [`/dev/stakes`](http://localhost:3000/dev/stakes) meter, season strip and projected table on mock data
- [`/dev/live`](http://localhost:3000/dev/live) step through a full game, phone and host side by side
- [`/dev/story`](http://localhost:3000/dev/story) ledger, brief and story, verification panel with a blocked claim
- [`/room/TEST`](http://localhost:3000/room/TEST), [`/room/TEST/host`](http://localhost:3000/room/TEST/host), [`/room/TEST/screen`](http://localhost:3000/room/TEST/screen) the always-on TEST room

Phones on the same wifi open `http://<your-laptop-ip>:3000`. The QR code is built in the browser from `window.location.origin`.

## Two entry points per feature

- `features/<part>/index.ts` is **browser-safe**: components, pure functions, re-exported types. It never imports node built-ins, env secrets or anything under `server/`.
- `features/<part>/server/index.ts` is **server only**: data loading, cache, store.
- Route handlers live in `features/<part>/server/routes/` and only `server/api.ts` imports them.

Logic that tests or scripts need lives outside `server/` as pure functions where it can. Node scripts and tests may use server entries and the db; the browser bundle never does (lint enforces it, and a test scans the built bundle for server secrets).

## Import rules (enforced by `npm run lint`)

- `app/` imports only `@/features/<part>/screens/*` and `@/shared/*`.
- `server/` imports only `@/features/<part>/server/routes/*`.
- A feature may import `@/shared/*`, another feature's `@/features/<part>`, and another feature's `@/features/<part>/server` (only from inside its own `server/` folder).
- Every other cross-feature path is blocked, e.g. `@/features/stakes/engine/simulation` or `../../stakes/engine/zones`.
- `components/`, `screens/` and `index.ts` never import a `server/` path or node built-ins. Nothing outside `server/` imports `server/`.
- `shared/` never imports a feature.

See [docs/contract.md](docs/contract.md) for every shared type and public function, [docs/gates.md](docs/gates.md) for gate 0, and [CONTRIBUTING.md](CONTRIBUTING.md) for how we work.

## Deploy

One long-running Node server (Render or Railway): build with `npm install && npm run build`, start with `npm start`. Set `PORT` if the host needs it, and the server-only variables from `.env.example` as secrets. Run one instance: the live engine's loops and the watch party store live in that process. Serverless won't work for the same reason. API docs: [docs/api/mapping.md](docs/api/mapping.md) (Liiga fields), [docs/api/goal-types.md](docs/api/goal-types.md).
