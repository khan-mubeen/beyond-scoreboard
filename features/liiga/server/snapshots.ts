// saved api responses in features/liiga/snapshots/, so the app runs offline (USE_SNAPSHOT=true)
// and survives api failures. one file per request path; betting fields are already stripped
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SNAPSHOT_DIR = fileURLToPath(new URL("../snapshots/", import.meta.url));

/** "/api/v1/games?date=2026-10-24&serie=RUNKOSARJA" -> "games__date-2026-10-24__serie-RUNKOSARJA" */
export function snapshotName(path: string): string {
  const [p, q = ""] = path.replace(/^\/api\/v1\//, "").split("?");
  const params = [...new URLSearchParams(q)].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}-${v}`);
  return [p.replaceAll("/", "_"), ...params].join("__").replace(/[^\w.-]/g, "_");
}

export interface SnapshotManifest {
  /** iso time of the recording, the "now" in snapshot mode */
  recordedAt: string;
  season: number;
  paths: string[];
}

export function readSnapshot<T>(path: string): T | null {
  const file = `${SNAPSHOT_DIR}${snapshotName(path)}.json`;
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
}

export function writeSnapshot(path: string, data: unknown) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(`${SNAPSHOT_DIR}${snapshotName(path)}.json`, JSON.stringify(data));
}

export function readManifest(): SnapshotManifest | null {
  const file = `${SNAPSHOT_DIR}manifest.json`;
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as SnapshotManifest) : null;
}

export function writeManifest(m: SnapshotManifest) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(`${SNAPSHOT_DIR}manifest.json`, JSON.stringify(m, null, 2) + "\n");
}
