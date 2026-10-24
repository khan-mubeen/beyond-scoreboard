# beyond-scoreboard

An AI-powered sports experience featuring live match insights, personalized content, interactive predictions, fan rewards, and verified AI-generated analysis. Built for JunctionX Oulu 2026, Kaleva Media Challenge.

## PowerPlay (working name)

A watch party for Liiga, played on a replayed real game.
**Big screen:** each team's playoff and relegation chance moves with the score, and the projected table re-sorts when a goal goes in.
**Phones:** fans join by QR code and make live calls for points. **AI story:** a pre-game brief and a post-game story where every number comes from a verified fact ledger.

User-facing text always says "chance" ("playoff chance 64%"), never "odds". No prizes, no betting.

## Architecture

```
  phones (/room/CODE)      host (/room/CODE/host)      big screen (/room/CODE/screen)
        │  poll state every 1s, POST join / answers / control  │
        └──────────────────────────┬──────────────────────────┘
                                   ▼
                 one node process: server/main.ts (express)
          /api/* ──► server/api.ts ──► features/<part>/server/routes/*
          everything else ──► the react app (vite in dev, dist/ in prod)

  features/live/server ──► in-memory room store, replay clock, calls, scoring
          │ uses
          ▼
  features/stakes/server ──► snapshots/*.json, else shared/mock   (chances, table)
          ▲ uses
  features/story/server  ──► story/cache/*.json, else template    (brief, story, verification)

  all three speak shared/types.ts
```

Stack: Vite + React + TypeScript (strict) + Tailwind, a small Express server, npm. No database: rooms, players and answers live in memory. Story content is pre-generated into JSON.

## Who owns what

| Part   | Folder             | Responsibility                                                                  |
| ------ | ------------------ | ------------------------------------------------------------------------------- |
| stakes | `features/stakes/` | Liiga data, standings, simulation, stakes visuals, big screen                   |
| live   | `features/live/`   | replay clock, calls, rooms, scoring, phone and host screens                     |
| story  | `features/story/`  | fact ledger, LLM writer, validator, trust components                            |
| site   | `features/site/`   | Kaleva Sports pages: home, match pages, rewards (front-end, mock data for now)  |
| shared | `shared/`          | contract types, mock data, UI primitives, tokens. tell the team before changing |

`app/` (pages) and `server/` (api wiring) are thin tables that only point at feature code.

## Quick start

```sh
npm install
npm run dev          # http://localhost:3000, api and app on one port
```

Other scripts:

| script                 | what it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `npm run build`        | builds the client into `dist/`                              |
| `npm start`            | serves `dist/` and the api (run `build` first)              |
| `npm test`             | vitest, pure functions only                                 |
| `npm run lint`         | eslint, including the import rules below                    |
| `npm run typecheck`    | `tsc --noEmit`                                              |
| `npm run format`       | prettier                                                    |
| `npm run snapshot`     | fetch Liiga data into `features/stakes/snapshots/` (gate 0) |
| `npm run fake-players` | `-- [room] [count]`, joins fake players to a running server |
| `npm run pregen`       | write LLM content into `features/story/cache/`              |

Copy `.env.example` to `.env` to change anything. Defaults work offline: `USE_SNAPSHOT=true` reads snapshots and falls back to `shared/mock/`, and `LLM_ENABLED=false` uses the template writer. The running app never calls the LLM. It reads the cache, and only the deterministic validator decides what passes.

### Pages

- [`/`](http://localhost:3000/) Kaleva Sports home
- [`/match/karpat-assat-live`](http://localhost:3000/match/karpat-assat-live) and [`/match/karpat-assat-final`](http://localhost:3000/match/karpat-assat-final), the live and finished match pages
- [`/rewards`](http://localhost:3000/rewards) Kaleva Rewards. `/calls`, `/calls/history`, `/achievements` and `/settings` say "Coming soon"
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

Logic that tests or scripts need lives outside `server/` as pure functions. Scripts never import `server/`.

## Import rules (enforced by `npm run lint`)

- `app/` imports only `@/features/<part>/screens/*` and `@/shared/*`.
- `server/` imports only `@/features/<part>/server/routes/*`.
- A feature may import `@/shared/*`, another feature's `@/features/<part>`, and another feature's `@/features/<part>/server` (only from inside its own `server/` folder).
- Every other cross-feature path is blocked, e.g. `@/features/stakes/engine/simulation` or `../../stakes/engine/zones`.
- `components/`, `screens/` and `index.ts` never import a `server/` path or node built-ins. Nothing outside `server/` imports `server/`.
- `shared/` never imports a feature.

See [docs/contract.md](docs/contract.md) for every shared type and public function, [docs/gates.md](docs/gates.md) for gate 0, and [CONTRIBUTING.md](CONTRIBUTING.md) for how we work.

## Deploy

One long-running Node server (Render or Railway): build with `npm install && npm run build`, start with `npm start`. Set `PORT` if the host needs it. Serverless won't work, because the in-memory store needs a single process.
