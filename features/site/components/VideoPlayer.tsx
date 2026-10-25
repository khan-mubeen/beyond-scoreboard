import { type ReactNode, useState } from "react";
import type { VideoInfo } from "@/shared/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

/** the thumbnail if it loads, else our poster */
export function Poster({ src, fallback = "/placeholders/video-highlights.svg", className = "" }: { src: string; fallback?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <img src={failed ? fallback : src} alt="" onError={() => setFailed(true)} className={className} />;
}

/** "Watch on liiga.fi": a link that opens the match on liiga.fi in a new tab */
export function LiigaLink({ href, className = "", label = "Watch on liiga.fi" }: { href: string; className?: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label}
      <Icon name="arrowUpRight" className="size-3.5" />
    </a>
  );
}

/**
 * a poster that opens the video modal (a clip we host), or "Watch on liiga.fi" (any other match:
 * we never play liiga's streams). overlay sits on top (badges, captions, buttons)
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
  const external = !video.src && !!video.href;
  return (
    <div className={`relative overflow-hidden rounded-card bg-dark text-dark-ink shadow-card ${className}`}>
      <Poster src={video.poster} className="absolute inset-0 size-full object-cover" />
      {external ? (
        <a href={video.href!} target="_blank" rel="noreferrer" className="absolute inset-0 grid place-items-center" aria-label={`Watch on liiga.fi: ${video.title}`}>
          <span className="relative z-10 flex items-center gap-2 rounded-full bg-dark-ink px-5 py-3 text-sm font-semibold text-ink shadow-card">
            <Icon name="play" className="size-4" /> Watch on liiga.fi
          </span>
        </a>
      ) : (
        <button type="button" onClick={onPlay} className="absolute inset-0" aria-label={`Play: ${video.title}`} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/10 to-dark/30" />
      <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {overlay}
      </div>
      {progress !== undefined && (
        <div aria-hidden className="absolute inset-x-5 bottom-3 h-0.5 bg-dark-ink/30">
          <div className="h-full bg-dark-ink" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** plays a clip we host (a rotation highlight, from a goal), else the placeholder */
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
          {video.href && <LiigaLink href={video.href} label="Video not playing? Watch on liiga.fi" className="inline-flex items-center gap-1 self-end text-xs text-muted underline hover:text-ink" />}
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
