// the api attaches betting data (gamblingEvent with odds and a bookmaker link) to games.
// we never pass it on: the client strips it before anything is cached, snapshotted or served

export const FORBIDDEN_KEYS = ["gamblingEvent", "odds", "homeTeamOdds", "awayTeamOdds", "tieOdds"] as const;

const isForbidden = (key: string) => (FORBIDDEN_KEYS as readonly string[]).includes(key) || /odds|gambling/i.test(key);

/** a deep copy without any betting fields */
export function stripGambling<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripGambling) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!isForbidden(k)) out[k] = stripGambling(v);
    return out as T;
  }
  return value;
}

/** paths of any betting fields still in a value. tests use it on every response and payload */
export function findGamblingFields(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findGamblingFields(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      isForbidden(k) ? [`${path}.${k}`] : findGamblingFields(v, `${path}.${k}`),
    );
  }
  return [];
}
