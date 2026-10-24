// loads .env before any other module reads process.env. import this first in server/main.ts
try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}
