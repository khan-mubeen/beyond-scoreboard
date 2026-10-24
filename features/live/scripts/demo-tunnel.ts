// a public https address for the local server, so judges join from their own phones and laptops:
// a cloudflare quick tunnel (no account; the cloudflared binary comes with the npm package, also on
// windows). it waits until the address answers, prints it, and tells the running server (with
// HOST_TOKEN) so tv mode shows "Join at …" and invite links use it; it re-reports every minute
// while it runs. start the server first. ctrl-c stops the tunnel.
// run: npm run demo:tunnel            (the server on PORT, default 3000)
//      npm run demo:tunnel -- --port 3001
export {};
import { existsSync } from "node:fs";
import { bin, install, Tunnel } from "cloudflared";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const at = process.argv.indexOf("--port");
const port = Number(at >= 0 ? process.argv[at + 1] : (process.env.PORT ?? 3000));
const local = `http://localhost:${port}`;
const host = process.env.HOST_TOKEN?.trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const up = await fetch(`${local}/healthz`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
if (!up?.ok) {
  console.error(`no server answers on ${local}. start it first: npm run dev (or npm run build && npm start)`);
  process.exit(1);
}

// the npm package downloads cloudflared when it installs; an install that skipped scripts gets it now
if (!existsSync(bin)) {
  console.log("tunnel: downloading cloudflared…");
  await install(bin);
}

const tunnel = Tunnel.quick(local);
const stop = () => {
  tunnel.stop();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
tunnel.on("exit", (code) => {
  console.error(`tunnel: cloudflared stopped (exit ${code}). run npm run demo:tunnel again for a new address`);
  process.exit(1);
});

const url = await new Promise<string>((resolve, reject) => {
  tunnel.once("url", resolve);
  tunnel.once("error", reject);
  setTimeout(
    () => reject(new Error("cloudflared gave no address within 60 s (is the internet reachable?)")),
    60_000,
  ).unref();
}).catch((err: Error) => {
  console.error(`tunnel: ${err.message}`);
  tunnel.stop();
  process.exit(1);
});

// a new address needs a few seconds before the world can reach it
console.log(`tunnel: ${url} is starting…`);
let reachable = false;
for (let i = 0; i < 45 && !reachable; i++) {
  reachable = !!(await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(4000) }).catch(() => null))?.ok;
  if (!reachable) await sleep(2000);
}

/** the server shows the address on the tv and in invite links (re-sent while the tunnel runs) */
async function report(): Promise<boolean> {
  if (!host) return false;
  const r = await fetch(`${local}/api/site/public-url`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-host-token": host },
    body: JSON.stringify({ url }),
  }).catch(() => null);
  return !!r?.ok;
}
const told = await report();
setInterval(() => void report(), 60_000).unref();

const join = `${url.replace(/^https:\/\//, "")}/join`;
console.log("");
console.log("  ┌──────────────────────────────────────────────────────────────");
console.log(`  │ public address  ${url}`);
console.log(`  │ judges type     ${join}`);
console.log(`  │ tv mode         ${url}/tv   (or on this laptop: ${local}/tv)`);
console.log(`  │ PUBLIC_BASE_URL=${url}`);
console.log("  └──────────────────────────────────────────────────────────────");
console.log(
  reachable
    ? "tunnel: reachable from the internet"
    : "tunnel: not reachable yet (dns can lag a minute); it keeps running",
);
console.log(
  told
    ? "tunnel: the server knows the address (tv mode shows it, invites use it)"
    : host
      ? "tunnel: couldn't tell the server; set PUBLIC_BASE_URL above in .env and restart it"
      : "tunnel: no HOST_TOKEN in .env, so the server wasn't told; set PUBLIC_BASE_URL above in .env and restart it",
);
console.log("ctrl-c stops the tunnel");
// cloudflared keeps the process alive; the interval above is unref'd
await new Promise(() => {});
