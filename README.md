# beyond-scoreboard

An AI-powered sports experience featuring live match insights, personalized content, interactive predictions, fan rewards, and verified AI-generated analysis. Built for JunctionX Oulu 2026, Kaleva Media Challenge.

## PowerPlay (working name)

A watch party for Liiga, played on a replayed real game.
**Big screen:** each team's playoff and relegation chance moves with the score, and the projected table re-sorts when a goal goes in.
**Phones:** fans type the short address the TV shows ("Join at …"), land in the match's Watch Party, make live calls for points, chat, react, ask the match about any player, answer trivia and invite friends. **AI story:** a pre-game brief and a post-game story where every number comes from a verified fact ledger.

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
  features/live/server   ──► live engine: one loop per match, calls, trivia, points, Realtime broadcasts.
                             one server holds the engine leader lease; others mirror it (follower mode)
  features/site/server   ──► the /api/site routes, built from the four above
  shared/db              ──► Supabase Postgres (RLS on, server key only), or memory

  all of them speak shared/types.ts
```

Stack: Vite + React + TypeScript (strict) + Tailwind, a small Express server, npm, Supabase (Postgres and Realtime broadcast). Without Supabase everything runs on an in-memory store and the pages poll. The older `/room` watch party pages still live in memory.

The server is the only authority: it runs the clock, opens and locks calls, judges answers against server time, and pays points into an idempotent ledger. Browsers only receive broadcasts on private channels (RLS has no insert policy), and every response and broadcast is checked for betting fields before it leaves.

**One engine, many servers.** Exactly one process runs the live engine: the leader holds a lease in `settings` (`engine_leader`), renewed every 5 s through the Postgres function `claim_engine_leader` (an atomic compare-and-set, 15 s TTL). Other processes log "follower mode", serve HTTP and mirror the leader's calls from the database. A clean stop hands over at once; a crash within ~15 s. **Presence lives in the database** (`party_presence`), so every server agrees on who is watching. Details: [docs/deploy.md](docs/deploy.md).

**The Watch Party.** Each match and rotation cycle has one public party: everyone who opens the match is in it. The right column of a live match is the party: Your Call! (first) · Chat · Party. Chat carries messages with emoji, floating reaction bursts, goal and result lines, "ask the match" fact cards (answers from Liiga data only, English or simple Finnish) and party trivia (+10 pts). Party lists everyone here and a board with every participant, 0 points too, with a Friends filter. Friends come from a friend code or an invite link (`/i/<code>`), and a member's invite gives the new fan one free live match. Realtime is the fast path; when it can't connect the page polls every second and gets everything the channel would send.

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
| `npm run demo:reset`     | removes bots and non-seeded fans (with their friends, invites, passes), clears party presence; restarts the rotation |
| `npm run demo:tunnel`    | a public https address for the local server (cloudflare quick tunnel, no account); tells the server, prints `PUBLIC_BASE_URL` |

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

The league clock is pinned at `demoNow` in `demo/rotation.json` (an hour before a real night's first game), so every page shows the season as it stood then and nothing after it leaks. Three highlight matches of that night play in a loop: lobby (60 s, "Who wins?") → live (the highlight video drives the game clock, goals land with the video, Your Call! questions between goals) → summary (600 s: final, 60-second audio summary, "Next match starts in …"). Everyone on a match is in its one Watch Party per cycle (presence, chat, board), and trivia fills the gaps between questions (`TRIVIA_GAP_SECONDS`, `TRIVIA_EVERY_SECONDS` shorten them for a rehearsal).

```sh
npm run demo:pick && npm run demo:videos && npm run demo:cues   # once: picks, builds and cues the videos
npm run pregen:demo && npm run audio:generate                    # once: texts (and voices with an Azure key)
npm run demo:reset                                               # before showing it: clean slate, rotation from match 1
# .env: DEMO_MODE=true  HOST_TOKEN=<anything>
npm run build && npm start                                       # or npm run dev
```

- [`/demo/control`](http://localhost:3000/demo/control) host controls (token): restart, skip, pause, resume; shows the phase and what's next.
- [`/tv`](http://localhost:3000/tv) the big screen: follows the rotation, video + scoreboard + Your Call! with its answer count + the party board, reaction bursts, a one-line chat ticker, and "Join at <public address>/join" in big type (no QR codes). `/match/<id>?tv=1` is one match in TV mode.
- Phones type the address on the TV (`/join` opens the match on now). For judges on their own devices: `npm run demo:tunnel` (or a deploy, [docs/deploy.md](docs/deploy.md)). Their first party action (a message, an answer, a reaction) asks for a nickname, prefilled with a suggestion; desktop/TV autoplays muted, phones show the poster until tapped.

### Pages

- [`/`](http://localhost:3000/) the Kaleva Media front page (kalevamedia.fi rebuilt; the menu adds Sports). Its other links open `/media/<page>`: "This page is part of kalevamedia.fi", with a link to the real page
- [`/sports`](http://localhost:3000/sports) Kaleva Sports home (`?show=live|results`). Old links to the sports home at `/` (`/?show=…`, `/#liiga-table`) redirect here; `/dev/brand` shows the wordmark options
- [`/match/2027-2701404`](http://localhost:3000/match/2027-2701404) a real match (`{season}-{gameId}`): live while it's played or replayed, the finished page after. `?host=1` shows the host bar, `?realtime=off` forces polling, `?debug=1` shows who you are, the party, the channel status, the last event, the watching count and whether the server is the leader
- [`/join`](http://localhost:3000/join) the match the rotation is on now; [`/friends`](http://localhost:3000/friends) your friend code, requests and friends watching now; `/i/<code>` an invite link
- [`/match/karpat-assat-live`](http://localhost:3000/match/karpat-assat-live) and [`/match/karpat-assat-final`](http://localhost:3000/match/karpat-assat-final), the design's mock pages, kept working without a backend
- [`/rewards`](http://localhost:3000/rewards) Kaleva Rewards, [`/leaderboard`](http://localhost:3000/leaderboard) weekly / season / Watch Party (the match on now)
- [`/teams`](http://localhost:3000/teams) all 17 teams (follow with the star), [`/teams/kärpät`](http://localhost:3000/teams/k%C3%A4rp%C3%A4t) one team: chances, last 5, next 3
- [`/profile`](http://localhost:3000/profile), [`/calls`](http://localhost:3000/calls), [`/calls/history`](http://localhost:3000/calls/history), [`/achievements`](http://localhost:3000/achievements), [`/settings`](http://localhost:3000/settings) (nickname, language, notifications, reset), [`/guidelines`](http://localhost:3000/guidelines)
- On a match page, Season stakes has "What if?": set this match and up to 3 other games that night, see the playoff race change ([docs/what-if.md](docs/what-if.md))
- [`/watch`](http://localhost:3000/watch) create or join a watch party room
- [`/dev`](http://localhost:3000/dev) links to everything below
- [`/dev/stakes`](http://localhost:3000/dev/stakes) meter, season strip and projected table on mock data
- [`/dev/live`](http://localhost:3000/dev/live) step through a full game, phone and host side by side
- [`/dev/story`](http://localhost:3000/dev/story) ledger, brief and story, verification panel with a blocked claim
- [`/room/TEST`](http://localhost:3000/room/TEST), [`/room/TEST/host`](http://localhost:3000/room/TEST/host), [`/room/TEST/screen`](http://localhost:3000/room/TEST/screen) the always-on TEST room

Phones on the same wifi open `http://<your-laptop-ip>:3000` (the server prints it on start); from anywhere, `npm run demo:tunnel` gives a public https address. TV mode and invite links use `PUBLIC_BASE_URL`, the address the tunnel reported, or the page's own origin.

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

One long-running Node server: `render.yaml` is a ready Render blueprint (build `npm ci --include=dev && npm run build`, start `npm start`, health check `/healthz`), and [docs/deploy.md](docs/deploy.md) has the steps and the tunnel alternative. The server binds `0.0.0.0` on `PORT` and trusts one proxy (cookies are `Secure` over HTTPS). Serverless won't work: the live engine is a loop in a process. A second instance on the same database is safe (one engine leader, the rest follow). API docs: [docs/api/mapping.md](docs/api/mapping.md) (Liiga fields), [docs/api/goal-types.md](docs/api/goal-types.md).
