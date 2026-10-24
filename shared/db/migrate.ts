// applies supabase/migrations/*.sql over a direct postgres connection (SUPABASE_DB_URL).
// records them in supabase_migrations.schema_migrations, like the supabase cli, so
// `npx supabase db push` and this script agree on what is applied. run: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.log("SUPABASE_DB_URL is not set. add it to .env, or run `npx supabase db push`, or paste the files");
  console.log("in supabase/migrations/ into the supabase sql editor, oldest first.");
  process.exit(1);
}

const dir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
try {
  await sql`create schema if not exists supabase_migrations`;
  await sql`create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`;
  const done = new Set((await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version));

  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (done.has(version)) {
      console.log(`skip  ${file}`);
      continue;
    }
    const body = readFileSync(dir + file, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into supabase_migrations.schema_migrations (version, statements, name) values (${version}, ${[body]}, ${rest.join("_")})`;
    });
    console.log(`apply ${file}`);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
