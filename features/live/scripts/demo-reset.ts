// a clean demo: deletes the fake players (bots) and every answer, point, notification, comment,
// call and room membership that isn't seeded data, and restarts the rotation (a fresh epoch).
// seeded fans (npm run db:seed) stay.
// run: npm run demo:reset [-- --since 2026-10-24T18:00:00Z]   (default: everything)
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const args = process.argv.slice(2);
const at = args.indexOf("--since");
const since = at >= 0 ? args[at + 1] : undefined;
if (since && Number.isNaN(Date.parse(since))) {
  console.error(`--since needs an iso time, got "${since}"`);
  process.exit(1);
}

const { checkDb, getDb } = await import("@/shared/db");
const { ROTATION_KEY } = await import("../server/rotation");
const mode = await checkDb();
const removed = await getDb().admin.resetDemo(since);
console.log(`demo reset (${mode}${since ? `, since ${since}` : ", everything but the seed"}):`);
for (const [table, n] of Object.entries(removed)) console.log(`  ${table}: ${n} removed`);
// the rotation starts over from match 1's lobby, now (a running server picks it up within 5 s)
const now = new Date().toISOString();
await getDb().settings.set(ROTATION_KEY, { epoch: now, pausedAt: null, run: Date.parse(now) });
console.log(`  rotation: restarted at ${now}`);
