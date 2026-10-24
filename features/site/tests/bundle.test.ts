// the browser bundle never carries a server secret: builds the client and searches every file
// for the server-only values in .env (by name in failures, never the value) and for the marks
// of server code (the liiga key header, the supabase secret key)
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SERVER_ONLY = ["LIIGA_API_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "LLM_API_KEY", "HOST_TOKEN", "AZURE_SPEECH_KEY"];
// (the host bar's input says "HOST_TOKEN" as a placeholder; the token's value is checked above)
const MARKS = [
  "x-api-key",
  "sb_secret_",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIIGA_API_KEY",
  "LLM_API_KEY",
  "AZURE_SPEECH_KEY",
  "Ocp-Apim-Subscription-Key",
  "realtime/v1/api/broadcast",
];
const out = join(tmpdir(), `ks-bundle-${process.pid}`);

/** server-only values from .env and the environment, long enough to be real secrets */
function secrets(): { name: string; value: string }[] {
  const fromFile = new Map<string, string>();
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) fromFile.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
  }
  return SERVER_ONLY.map((name) => ({ name, value: process.env[name] ?? fromFile.get(name) ?? "" })).filter((s) => s.value.length >= 8);
}

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("client bundle", () => {
  it("has no server secret or server-only code", async () => {
    const { build } = await import("vite");
    await build({ logLevel: "silent", build: { outDir: out, emptyOutDir: true } });
    const text = files(out)
      .filter((f) => /\.(js|css|html|map|json|txt)$/.test(f))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(text.length).toBeGreaterThan(10_000);
    expect(secrets().filter((s) => text.includes(s.value)).map((s) => s.name)).toEqual([]);
    expect(MARKS.filter((m) => text.includes(m))).toEqual([]);
  }, 180_000);
});
