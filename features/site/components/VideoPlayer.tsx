import type { ReactNode } from "react";
import type { VideoInfo } from "@/shared/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

/**
 * a poster that opens the video modal. overlay sits on top (badges, captions, buttons).
 * the placeholder poster already draws the play icon
 */
export function VideoPlayer({
  video,
  onPlay,
  overlay,
  className = "aspect-video",
  progress,
}: {
  video: VideoInfo;
  onPlay: () => void;
  overlay?: ReactNode;
  className?: string;
  /** 0-1, draws the red progress line at the bottom */
  progress?: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-card bg-dark text-dark-ink shadow-card ${className}`}>
      <img src={video.poster} alt="" className="absolute inset-0 size-full object-cover" />
      <button type="button" onClick={onPlay} className="absolute inset-0" aria-label={`Play: ${video.title}`} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/10 to-dark/30" />
      <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {overlay}
      </div>
      {progress !== undefined && (
        <div aria-hidden className="absolute inset-x-5 bottom-3 h-0.5 bg-dark-ink/30">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * plays the clip when there is one (liiga goal clips are hls: native in safari and recent chrome;
 * elsewhere the link opens the stream), else the placeholder
 */
export function VideoModal({ video, onClose }: { video: VideoInfo | null; onClose: () => void }) {
  return (
    <Modal open={video !== null} onClose={onClose} title={video?.title ?? "Video"} wide>
      {video?.src ? (
        <div className="flex flex-col gap-2">
          <video
            src={video.src}
            poster={video.poster}
            controls
            autoPlay
            playsInline
            // a goal in a rotation highlight opens a few seconds before it
            onLoadedMetadata={(e) => {
              if (video.startAt) e.currentTarget.currentTime = video.startAt;
            }}
            className="aspect-video w-full rounded-lg bg-dark"
          />
          <a href={video.streamUrl ?? video.src} target="_blank" rel="noreferrer" className="self-end text-xs text-muted underline hover:text-ink">
            Clip not playing? Open the stream
          </a>
        </div>
      ) : video && (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-dark text-dark-ink">
          <img src={video.poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <Icon name="play" className="mx-auto size-10" />
              <p className="mt-2 font-semibold">Highlight coming soon</p>
              <p className="text-sm opacity-80">There is no clip for this one yet.</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
