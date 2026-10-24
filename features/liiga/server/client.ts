// the liiga stats api over http. server only: the key is read here and sent as x-api-key, nowhere else.
// 8 s timeout, 1 retry, identical in-flight requests share one call, responses cached by ttl,
// betting fields stripped before caching. USE_SNAPSHOT=true or a failed call reads the snapshot
import { stripGambling } from "../sanitize";
import { readSnapshot } from "./snapshots";

export type DataSource = "live" | "snapshot";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  /** iso time the data was fetched or recorded */
  asOf: string;
}

const TIMEOUT_MS = 8000;

export class LiigaUnavailable extends Error {}

interface Entry {
  value: Sourced<unknown>;
  expires: number;
}

export class LiigaClient {
  private cache = new Map<string, Entry>();
  private inflight = new Map<string, Promise<Sourced<unknown>>>();
  private root: string | null = null;
  private ready: Promise<string | null> | null = null;

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly snapshotOnly: boolean,
    private readonly log: (msg: string) => void = console.log,
  ) {}

  get offline() {
    return this.snapshotOnly || !this.baseUrl || !this.apiKey;
  }

  /**
   * finds the url prefix that answers GET /api/v1/test with "ping pong". the spec's server url is
   * "/api" and its paths start with "/api/v1", so the real url can carry a doubled /api
   */
  ensureReady(): Promise<string | null> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (this.offline) {
        this.log(`liiga: ${this.snapshotOnly ? "USE_SNAPSHOT=true" : "no LIIGA_API_URL / LIIGA_API_KEY"}, serving snapshots`);
        return null;
      }
      const base = this.baseUrl!.replace(/\/+$/, "");
      const candidates = [...new Set([base.replace(/\/api\/v1$/, ""), base, base.replace(/\/api$/, ""), `${base}/api`])];
      for (const root of candidates) {
        try {
          const res = await fetch(`${root}/api/v1/test`, { headers: this.headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
          const text = (await res.text()).replace(/"/g, "").trim();
          if (res.ok && text === "ping pong") {
            this.root = root;
            this.log(`liiga: ping -> "${text}" (${new URL(root).host})`);
            return root;
          }
        } catch {
          // try the next prefix
        }
      }
      this.log("liiga: ping failed on every url prefix, serving snapshots until it answers");
      this.ready = null; // try again on the next request
      return null;
    })();
    return this.ready;
  }

  private headers() {
    return { "x-api-key": this.apiKey ?? "", accept: "application/json" };
  }

  /**
   * GET a spec path. ttl may depend on the response (a live game caches shorter than a final one)
   */
  async get<T>(path: string, ttl: number | ((data: T) => number)): Promise<Sourced<T>> {
    const hit = this.cache.get(path);
    if (hit && hit.expires > Date.now()) return hit.value as Sourced<T>;
    const pending = this.inflight.get(path);
    if (pending) return pending as Promise<Sourced<T>>;

    const run = (async (): Promise<Sourced<T>> => {
      try {
        const root = await this.ensureReady();
        if (!root) return this.fromSnapshot<T>(path);
        const data = stripGambling(await this.fetchJson<T>(root + path));
        const value: Sourced<T> = { data, source: "live", asOf: new Date().toISOString() };
        const ms = typeof ttl === "function" ? ttl(data) : ttl;
        this.cache.set(path, { value, expires: Date.now() + ms });
        return value;
      } catch (err) {
        this.log(`liiga: ${path} failed (${(err as Error).message}), trying the snapshot`);
        return this.fromSnapshot<T>(path);
      } finally {
        this.inflight.delete(path);
      }
    })();
    this.inflight.set(path, run);
    return run;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let last: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status >= 500) throw new Error(`http ${res.status}`);
        if (!res.ok) throw new LiigaUnavailable(`http ${res.status}`);
        return (await res.json()) as T;
      } catch (err) {
        last = err as Error;
        if (err instanceof LiigaUnavailable) break; // a 4xx won't fix itself on retry
      }
    }
    throw last ?? new Error("request failed");
  }

  private fromSnapshot<T>(path: string): Sourced<T> {
    const data = readSnapshot<T>(path);
    if (data === null) throw new LiigaUnavailable(`no snapshot for ${path}`);
    return { data: stripGambling(data), source: "snapshot", asOf: snapshotAsOf() };
  }

  /** for the recorder: always live, never cached */
  async fetchLive<T>(path: string): Promise<T> {
    const root = await this.ensureReady();
    if (!root) throw new LiigaUnavailable("the api is not reachable");
    return stripGambling(await this.fetchJson<T>(root + path));
  }
}

let snapshotRecordedAt: string | null = null;
export function setSnapshotAsOf(iso: string | null) {
  snapshotRecordedAt = iso;
}
const snapshotAsOf = () => snapshotRecordedAt ?? new Date(0).toISOString();
