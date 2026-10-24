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

/** placeholder player until the video api is connected */
export function VideoModal({ video, onClose }: { video: VideoInfo | null; onClose: () => void }) {
  return (
    <Modal open={video !== null} onClose={onClose} title={video?.title ?? "Video"} wide>
      {video && (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-dark text-dark-ink">
          <img src={video.poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <Icon name="play" className="mx-auto size-10" />
              <p className="mt-2 font-semibold">Video player placeholder</p>
              <p className="text-sm opacity-80">The stream connects when the video api is ready.</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
