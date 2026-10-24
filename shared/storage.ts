// public files in supabase storage (buckets "highlights" and "match-audio", made public by a
// migration). server and scripts only: uploads use the secret key
import { supabaseAdmin } from "./db/supabase";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const storageReady = () => !!url && !!secret;

/** the public address of a file in a public bucket */
export const publicUrl = (bucket: string, path: string) => `${url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

/** uploads (or replaces) a file and returns its public url */
export async function uploadPublic(bucket: string, path: string, data: Buffer, contentType: string): Promise<string> {
  if (!url || !secret) throw new Error("storage: SUPABASE_URL and SUPABASE_SECRET_KEY are needed to upload");
  const { error } = await supabaseAdmin(url, secret).storage.from(bucket).upload(path, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`storage: ${bucket}/${path}: ${error.message}`);
  return publicUrl(bucket, path);
}
