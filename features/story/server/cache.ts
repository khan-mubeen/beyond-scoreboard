import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Content, Fact, VerificationReport } from "@/shared/types";

/** one file per content id, written by scripts/pregenerate-content.ts */
export interface CacheEntry {
  content: Content;
  ledger: Fact[];
  report: VerificationReport;
}

const CACHE_DIR = fileURLToPath(new URL("../cache/", import.meta.url));

export function readCache(id: string): CacheEntry | null {
  const file = `${CACHE_DIR}${id}.json`;
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as CacheEntry;
}
