// demo/rotation.json: the pinned demo clock and the three highlight matches of the rotation.
// npm run demo:pick writes it, demo:videos and demo:cues fill in the videos and goal cues.
// server and scripts only (node fs); validated on every load (cues increasing, inside the video)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** demo/rotation.json (DEMO_ROTATION_FILE points tests at their own) */
export const ROTATION_FILE = process.env.DEMO_ROTATION_FILE ?? fileURLToPath(new URL("../demo/rotation.json", import.meta.url));

const video = z.union([
  z.object({ type: z.literal("mp4"), url: z.string().url() }),
  z.object({ type: z.literal("youtube"), id: z.string().min(5) }),
  z.literal("PLACEHOLDER"),
]);

/** where a goal appears in the highlight: video second -> game second */
const cue = z.object({ goalId: z.string(), videoSec: z.number().nonnegative(), gameTime: z.number().nonnegative() });

const match = z.object({
  matchId: z.string().regex(/^\d{4}-\d+$/),
  title: z.string(),
  video: video.default("PLACEHOLDER"),
  poster: z.string().nullable().default(null),
  durationSec: z.number().positive(),
  cues: z.array(cue).default([]),
  /** demo:videos: where each goal's clip sits in the joined highlight, for demo:cues */
  segments: z.array(z.object({ goalId: z.string(), startSec: z.number().nonnegative(), durationSec: z.number().positive() })).default([]),
  /** audio-peaks (found from the crowd noise), manual (/demo/cues) or linear (no cues) */
  cuesSource: z.enum(["audio-peaks", "manual", "linear"]).default("linear"),
  /** the original liiga stream, for "Clip not playing? Open the stream" */
  streamUrl: z.string().nullable().default(null),
});

export const rotationSchema = z
  .object({
    /** the frozen league moment, iso with offset: 60 minutes before the demo date's first game */
    demoNow: z.string().datetime({ offset: true }),
    lobbySeconds: z.number().positive().default(60),
    summarySeconds: z.number().positive().default(600),
    matches: z.array(match).min(1).max(3),
  })
  .superRefine((c, ctx) => {
    c.matches.forEach((m, i) => {
      m.cues.forEach((q, j) => {
        const prev = m.cues[j - 1];
        if (q.videoSec > m.durationSec) ctx.addIssue({ code: "custom", path: ["matches", i, "cues", j], message: `cue at ${q.videoSec}s is past the video (${m.durationSec}s)` });
        if (prev && (q.videoSec <= prev.videoSec || q.gameTime < prev.gameTime))
          ctx.addIssue({ code: "custom", path: ["matches", i, "cues", j], message: "cues must increase in video and game time" });
      });
    });
  });

export type RotationConfig = z.infer<typeof rotationSchema>;
export type RotationMatchConfig = RotationConfig["matches"][number];
export type RotationCue = RotationMatchConfig["cues"][number];

/** the config, or null when there is none; throws with every problem when it is invalid */
export function loadRotation(file = ROTATION_FILE): RotationConfig | null {
  if (!existsSync(file)) return null;
  const parsed = rotationSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) throw new Error(`demo/rotation.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return parsed.data;
}

export function saveRotation(config: RotationConfig, file = ROTATION_FILE) {
  writeFileSync(file, `${JSON.stringify(rotationSchema.parse(config), null, 2)}\n`);
}
