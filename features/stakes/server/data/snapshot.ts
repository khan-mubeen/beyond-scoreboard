import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SNAPSHOT_DIR = fileURLToPath(new URL("../../snapshots/", import.meta.url));

/** reads features/stakes/snapshots/<name>.json, or null when off or missing */
export function readSnapshot<T>(name: string): T | null {
  if (process.env.USE_SNAPSHOT === "false") return null;
  const file = `${SNAPSHOT_DIR}${name}.json`;
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}
