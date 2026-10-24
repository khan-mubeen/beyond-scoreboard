// ffmpeg and ffprobe from npm (ffmpeg-static, ffprobe-static): no system install. scripts only
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const FFMPEG = require("ffmpeg-static") as string;
export const FFPROBE = (require("ffprobe-static") as { path: string }).path;

/** runs a binary; resolves with its stdout and stderr, rejects on a non-zero exit */
export function run(bin: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    const timer = opts.timeoutMs ? setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs) : null;
    p.on("error", reject);
    p.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin.split(/[\\/]/).pop()} exited ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

/** a media file's length in seconds */
export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]);
  const s = Number(stdout.trim());
  if (!Number.isFinite(s) || s <= 0) throw new Error(`ffprobe: no duration for ${file}`);
  return s;
}
