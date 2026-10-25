import { type ReactNode, useEffect, useRef, useState } from "react";
import type { HighlightVideo, LiveRotation } from "@/shared/types";
import { serverNowMs } from "../data";
import { Icon } from "./Icon";
import { LiigaLink } from "./VideoPlayer";

const SYNC_MS = 2000;
const MAX_DRIFT = 1.5;
const phone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/** the highlight's second right now, on the server's clock */
export function videoSecNow(r: LiveRotation): number | null {
  if (r.phase !== "live" || r.videoSec === null) return null;
  return r.paused ? r.videoSec : Math.max(0, (serverNowMs() - r.liveStartedAt) / 1000);
}

// ---------- youtube (kept for later; the demo uses mp4 from storage) ----------

interface YtPlayer {
  seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number;
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
type YtGlobal = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YtPlayer };
let ytReady: Promise<YtGlobal> | null = null;
function loadYouTube(): Promise<YtGlobal> {
  ytReady ??= new Promise((resolve) => {
    const w = window as unknown as { YT?: YtGlobal; onYouTubeIframeAPIReady?: () => void };
    if (w.YT?.Player) return resolve(w.YT);
    w.onYouTubeIframeAPIReady = () => resolve(w.YT!);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

/** the minimal player surface the sync loop needs, for both mp4 and youtube */
interface Surface {
  time(): number;
  seek(s: number): void;
  play(): void;
  pause(): void;
  mute(on: boolean): void;
}

function Frame({ poster, children }: { poster: string | null; children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-dark text-center text-dark-ink">
      {poster && <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * a rotation match's highlight. live: plays in step with the server (every 2 s, a drift over
 * 1.5 s seeks), so everyone sees each goal when the game does. desktop and tv autoplay muted;
 * phones show the poster until "Watch highlight" is tapped (bandwidth). no video or an error:
 * the poster and "Highlight coming soon" (events and calls keep running). summary: free play
 */
export function HighlightPlayer({
  video,
  rotation,
  tv = false,
  className = "aspect-video",
  overlay,
  liigaUrl,
}: {
  video: HighlightVideo | null;
  rotation: LiveRotation | null;
  tv?: boolean;
  className?: string;
  overlay?: ReactNode;
  /** the match on liiga.fi, under the player: "Video not playing? Watch on liiga.fi" */
  liigaUrl?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const surface = useRef<Surface | null>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [tapped, setTapped] = useState(false);
  const live = rotation?.phase === "live";
  const waitForTap = live && !tv && phone() && !tapped;
  const yt = video?.type === "youtube" ? video.id : null;

  // the youtube player, when the video is on youtube
  useEffect(() => {
    if (!yt || !box.current) return;
    let player: YtPlayer | null = null;
    let gone = false;
    const el = document.createElement("div");
    box.current.querySelector("[data-yt]")?.appendChild(el);
    void loadYouTube().then((YT) => {
      if (gone) return;
      player = new YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        videoId: yt,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1 },
        events: { onError: () => setFailed(true) },
      });
      surface.current = {
        time: () => player!.getCurrentTime(),
        seek: (s) => player!.seekTo(s, true),
        play: () => player!.playVideo(),
        pause: () => player!.pauseVideo(),
        mute: (on) => (on ? player!.mute() : player!.unMute()),
      };
    });
    return () => {
      gone = true;
      surface.current = null;
      player?.destroy();
    };
  }, [yt]);

  // the mp4 element
  useEffect(() => {
    const v = videoEl.current;
    if (!v) return;
    surface.current = {
      time: () => v.currentTime,
      seek: (s) => {
        v.currentTime = s;
      },
      play: () => void v.play().catch(() => {}),
      pause: () => v.pause(),
      mute: (on) => {
        v.muted = on;
      },
    };
    return () => {
      surface.current = null;
    };
  }, [video]);

  // follow the server: play and seek while live, stop otherwise
  useEffect(() => {
    if (!rotation || waitForTap || failed) return;
    const step = () => {
      const s = surface.current;
      if (!s) return;
      const target = videoSecNow(rotation);
      if (target === null || rotation.paused) return s.pause();
      if (Math.abs(s.time() - target) > MAX_DRIFT) s.seek(target);
      s.play();
    };
    step();
    if (!live) return;
    const t = setInterval(step, SYNC_MS);
    return () => clearInterval(t);
  }, [rotation, live, waitForTap, failed]);

  useEffect(() => surface.current?.mute(muted), [muted]);

  const poster = video?.poster ?? "/placeholders/video-highlights.svg";
  return (
    <div className="flex flex-col gap-1">
      <div ref={box} className={`relative overflow-hidden rounded-card bg-dark text-dark-ink shadow-card ${className}`}>
        {!video || failed ? (
          <Frame poster={poster}>
            <Icon name="play" className="mx-auto size-10" />
            <p className="mt-2 font-semibold">Highlight coming soon</p>
            <p className="text-sm opacity-80">Goals and calls keep coming in below.</p>
          </Frame>
        ) : video.type === "mp4" ? (
          <video
            ref={videoEl}
            src={video.url}
            poster={poster}
            playsInline
            muted
            preload={waitForTap ? "none" : "auto"}
            controls={!live}
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <div data-yt className="absolute inset-0 [&>div]:size-full [&_iframe]:size-full" />
        )}
        {video && !failed && waitForTap && (
          <button type="button" onClick={() => setTapped(true)} className="absolute inset-0 grid place-items-center bg-dark/40">
            <span className="flex items-center gap-2 rounded-full bg-dark-ink text-ink hover:bg-white/85 px-5 py-3 font-semibold">
              <Icon name="play" className="size-4" /> Watch highlight
            </span>
          </button>
        )}
        {video && !failed && live && !waitForTap && (
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-dark/70 px-3 py-1.5 text-xs font-semibold text-dark-ink"
          >
            <Icon name={muted ? "volumeOff" : "volume"} className="size-4" />
            {muted ? "Unmute" : "Mute"}
          </button>
        )}
        {overlay && <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">{overlay}</div>}
      </div>
      {liigaUrl && !tv && <LiigaLink href={liigaUrl} label="Video not playing? Watch on liiga.fi" className="inline-flex items-center gap-1 self-end text-xs text-muted underline hover:text-ink" />}
    </div>
  );
}
