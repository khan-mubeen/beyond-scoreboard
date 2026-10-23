// fetches liiga data into features/stakes/snapshots/ so the demo runs offline.
// never imports server/. run: npm run snapshot
// todo(gate 0): fill in once the api questions in docs/gates.md are answered

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const base = process.env.LIIGA_API_URL;
if (!base) {
  console.log("LIIGA_API_URL is not set. copy .env.example to .env and fill it in.");
  process.exit(0);
}

console.log(`would fetch teams, games, goal events and standings from ${base}`);
console.log("not implemented yet. the app falls back to shared/mock until snapshots exist.");
