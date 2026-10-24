// the demo rotation's highlight videos, as the pages get them: the video (never its goal cues)
// and a goal's clip (the highlight from 4 s before the goal). other matches keep liiga's clips.
// "open the stream" is our own file, never liiga's raw clip (that opens with a betting ad)
import type { LiigaGame } from "@/features/liiga";
import { goalVideoSec, rotationMatch } from "@/features/live/server";
import type { HighlightVideo, VideoInfo } from "@/shared/types";
import { goalVideo } from "./match-parts";

const POSTER = "/placeholders/video-highlights.svg";

/** the rotation match's highlight, null for a placeholder (or any other match) */
export function highlightOf(matchId: string): HighlightVideo | null {
  const m = rotationMatch(matchId);
  if (!m || m.video === "PLACEHOLDER") return null;
  const base = { poster: m.poster, durationSec: m.durationSec, streamUrl: m.streamUrl };
  return m.video.type === "mp4" ? { type: "mp4", url: m.video.url, ...base } : { type: "youtube", id: m.video.id, ...base };
}

/** a goal's "Watch" video: in a rotation match, its moment in the highlight (mp4 only) */
export function clipOf(matchId: string) {
  const h = highlightOf(matchId);
  return (goal: LiigaGame["goals"][number], title: string): VideoInfo | null => {
    const at = h?.type === "mp4" ? goalVideoSec(matchId, goal.id) : null;
    if (h?.type === "mp4" && at !== null) return { poster: h.poster ?? POSTER, title, src: h.url, startAt: Math.max(0, at - 4), streamUrl: h.streamUrl ?? h.url };
    return goalVideo(goal, title);
  };
}
