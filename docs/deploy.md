# Public access: a tunnel or a deploy

Judges join from their own phones and laptops, so the site needs a public HTTPS address. Two ways, both on the same Supabase project.

## 1. A tunnel from the laptop (no account, minutes)

The laptop runs the server; a Cloudflare quick tunnel gives it a public HTTPS address.

1. Start the server: `npm run build && npm start` (or `npm run dev`).
2. `npm run demo:tunnel` (another terminal). It checks the server is up, starts the tunnel (the `cloudflared` binary comes with the npm package, also on Windows), waits until the address answers from the internet, and prints:
   - the public address, e.g. `https://quiet-river-tables-demo.trycloudflare.com`
   - what judges type: `quiet-river-tables-demo.trycloudflare.com/join` (opens the match on now)
   - `PUBLIC_BASE_URL=…` for `.env`
3. With `HOST_TOKEN` in `.env`, the script tells the running server its address (`POST /api/site/public-url`), every minute while it runs: TV mode shows "Join at …" and invite links use it. Without `HOST_TOKEN`, put the printed `PUBLIC_BASE_URL` in `.env` and restart the server.
4. Open the TV on the laptop: `http://localhost:3000/tv`. Ctrl-C stops the tunnel; a new run gets a new address.

A quick tunnel has no uptime guarantee and a random address. For the demo day, a deploy (below) is steadier; keep the tunnel as the backup.

## 2. Render (one instance)

`render.yaml` is a ready blueprint: one web service, `npm ci --include=dev && npm run build`, `npm start`, health check `/healthz`, Node 22, Frankfurt, Starter plan (a free service sleeps after 15 idle minutes, and the live engine with it).

1. Push the repo to GitHub.
2. Render → New → Blueprint → pick the repo. Render reads `render.yaml` and asks for the secrets (names only here):
   - server: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `HOST_TOKEN`, `LIIGA_API_URL`, `LIIGA_API_KEY` (the last two only matter with `USE_SNAPSHOT=false`)
   - build time, browser-safe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Vite puts them in the bundle, so they must be set before the first build)
   - `PUBLIC_BASE_URL`: `https://<service>.onrender.com` (or leave it empty: links then use the address the page came in on)
3. Apply the database migrations once, from a laptop: `npm run db:migrate` (needs `SUPABASE_DB_URL` in `.env`).
4. Deploy. Check `https://<service>.onrender.com/healthz`: `{"ok":true,"role":"leader",…}`.
5. Before the demo: `npm run demo:reset` from a laptop (same database). It clears test fans, their friends, invites and passes, the party presence, and restarts the rotation.
6. TV: open `https://<service>.onrender.com/demo/control` on the TV's browser once and enter the host token (it is kept in that browser), then `/tv`.

Already set by the blueprint: `DEMO_MODE=true`, `USE_SNAPSHOT=true`, `LLM_ENABLED=false`, `TTS_ENABLED=false`, `WELCOME_POINTS=1250`, `CALL_ANSWER_SECONDS=20`. Render sets `PORT`; the server binds `0.0.0.0` on it.

## How the server behaves behind a proxy

- `trust proxy` is on (one hop: the tunnel or Render's load balancer), so `req.secure` and the origin come from `X-Forwarded-*`.
- The fan cookie `ks_anon` is `HttpOnly`, `SameSite=Lax`, and `Secure` whenever the page came over HTTPS.
- `/healthz` answers `{ ok, role, instance, db, uptimeSec }`; `role` says whether this process runs the live engine (`leader`) or only serves HTTP (`follower`).

## More than one server on one database

Safe. Exactly one process runs the live engine: the leader holds a lease in the `settings` table (`engine_leader`), claimed and renewed every 5 s through `claim_engine_leader` (an atomic compare-and-set in Postgres, 15 s TTL). The others log "follower mode", serve HTTP, and mirror the leader's calls from the database for their pages. A leader that stops cleanly lets go at once (measured: the follower took over in 1.1 s); one that crashes is replaced when its lease runs out (measured: 12.6 s). Presence lives in the database (`party_presence`), so every server agrees on who is watching.

With the memory database (`DB_MODE=memory`) there is one process by definition: it is always the leader.
