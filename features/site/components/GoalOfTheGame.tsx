import type { FinishedMatchDetail, VideoInfo } from "@/shared/types";
import { Icon } from "./Icon";
import { Pill } from "./SectionCard";
import { LiigaLink, VideoPlayer } from "./VideoPlayer";

/**
 * the finished page's video tile: the goal that moved the chance most (time, period, power play,
 * the chance change) with our highlight from it, else the game's video. "watch on liiga.fi" when
 * the clip lives there. a game without goals shows the game's video alone
 */
export function GoalOfTheGame({
  goal,
  video,
  onWatch,
}: {
  goal: FinishedMatchDetail["goalOfTheGame"];
  /** the game's own video, when there's no goal clip */
  video: VideoInfo;
  onWatch: (v: VideoInfo) => void;
}) {
  const clip = goal?.video.src || goal?.video.href ? goal.video : video;
  const liiga = goal?.video.href ?? video.href ?? null;
  return (
    <section aria-label={goal ? "Goal of the game" : "Video"} className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <VideoPlayer
        video={clip}
        onPlay={() => onWatch(clip)}
        className="aspect-video shrink-0 rounded-none shadow-none"
        overlay={
          <p className="absolute top-3 left-3">
            <Pill tone="outline" className="border-transparent">
              <Icon name="star" className="size-3.5 text-accent" /> {goal ? "Goal of the game" : "Highlights"}
            </Pill>
          </p>
        }
      />
      <div className="flex flex-1 flex-col p-4">
        {goal ? (
          <>
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">{goal.meta}</p>
            <h3 className="mt-1 text-lg leading-snug font-bold">{goal.title}</h3>
            <p className="mt-1 text-sm text-muted">{goal.effectText}</p>
            <p className="mt-2">
              <Pill tone="good">{goal.chip}</Pill>
            </p>
          </>
        ) : (
          <h3 className="text-lg leading-snug font-bold">{video.title}</h3>
        )}
        {liiga && <LiigaLink href={liiga} className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-sm font-semibold text-accent hover:underline" />}
      </div>
    </section>
  );
}
