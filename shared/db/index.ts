// the server's database. DB_MODE=memory or =supabase; by default supabase when its url and
// secret key are set. if the tables are missing, startup says so and falls back to memory.
// server only: never import from browser code (lint enforces it)
import { createMemoryDb } from "./memory";
import { createSupabaseDb, supabaseAdmin } from "./supabase";
import type { Db } from "./types";

export type * from "./types";
export { DEFAULT_PREFS } from "./types";
export { createMemoryDb } from "./memory";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const wanted = process.env.DB_MODE ?? (url && secret ? "supabase" : "memory");

let db: Db = wanted === "supabase" && url && secret ? createSupabaseDb(supabaseAdmin(url, secret)) : createMemoryDb();

export const getDb = (): Db => db;

/** for tests: swap in a fresh store */
export function setDb(next: Db) {
  db = next;
}

/** checks the tables are there; logs and falls back to memory when they aren't */
export async function checkDb(): Promise<Db["mode"]> {
  if (db.mode === "memory") {
    console.log(`db: in memory${wanted === "supabase" ? " (SUPABASE_URL / SUPABASE_SECRET_KEY missing)" : ""}, data is lost on restart`);
    return "memory";
  }
  try {
    await db.users.getByAnonId("health-check");
    console.log("db: supabase ok");
    return "supabase";
  } catch (err) {
    console.error(`db: supabase not ready (${(err as Error).message}). run \`npm run db:migrate\`. using memory for now`);
    db = createMemoryDb();
    return "memory";
  }
}
