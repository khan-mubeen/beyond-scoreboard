// live liiga api access, used when USE_SNAPSHOT=false.
// todo(gate 0): confirm endpoints, auth and field names, see docs/gates.md

export async function fetchLiiga<T>(path: string): Promise<T> {
  const base = process.env.LIIGA_API_URL;
  if (!base) throw new Error("LIIGA_API_URL is not set");
  throw new Error(`liiga client not implemented yet (${path})`);
}
