// where links to this site start (invite links, tv mode's "Join at …"): PUBLIC_BASE_URL when it
// is set (a deploy), else what npm run demo:tunnel reported (kept in settings so every server
// knows it, refreshed by the running tunnel, ignored once stale), else the origin the request came
// in on (behind a proxy or tunnel: x-forwarded-proto / host, with trust proxy on)
import type { Request } from "express";
import { getDb } from "@/shared/db";

const KEY = "public_base_url";
/** the tunnel re-reports every minute; a value older than this is a tunnel that stopped */
const STALE_MS = 5 * 60_000;

let reported: { url: string; at: number } | null = null;
let readAt = 0;

async function refresh() {
  if (Date.now() - readAt < 10_000) return;
  readAt = Date.now();
  const v = await getDb()
    .settings.get<{ url: string; at: string }>(KEY)
    .catch(() => null);
  if (v?.url) reported = { url: v.url, at: Date.parse(v.at) };
}

const clean = (url: string) => url.trim().replace(/\/+$/, "");

/** the base url, without a trailing slash */
export function publicBaseUrl(req?: Request): string {
  const env = process.env.PUBLIC_BASE_URL;
  if (env?.trim()) return clean(env);
  void refresh();
  if (reported && Date.now() - reported.at < STALE_MS) return reported.url;
  if (!req) return "";
  return `${req.protocol}://${req.get("x-forwarded-host") ?? req.get("host")}`;
}

/** the tunnel's url (POST /api/site/public-url, host token) */
export async function reportPublicUrl(url: string) {
  reported = { url: clean(url), at: Date.now() };
  await getDb().settings.set(KEY, { url: reported.url, at: new Date(reported.at).toISOString() });
}
