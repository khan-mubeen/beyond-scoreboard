import { useEffect, useRef, useState } from "react";
import type { Language, SpokenSummary } from "@/shared/types";
import { Icon } from "./Icon";
import { SectionCard } from "./SectionCard";

const LOCALE: Record<Language, string> = { en: "en", fi: "fi" };
const fmt =(s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
/** speech runs about 14 characters a second at rate 1 */
const CHARS_PER_SEC = 14;
/** the device voice a little faster (at most 1.2x) so the summary takes about a minute */
const deviceRate = (text: string) => Math.min(1.2, Math.max(1, text.length / CHARS_PER_SEC / 60));
const estimate = (text: string) => Math.round(text.length / CHARS_PER_SEC / deviceRate(text));

/** the browser's own voice for a language, if it has one */
function useDeviceVoice(lang: Language): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pickVoice = () => setVoice(window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(LOCALE[lang])) ?? null);
    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, [lang]);
  return voice;
}

/**
 * the 60-second summary: listen (the stored ai voice, else the device's own), en | fi, and the
 * transcript that is spoken. nothing autoplays; in tv mode the host presses play
 */
export function AudioSummary({ summary, defaultLang = "en", tv = false }: { summary: Record<Language, SpokenSummary>; defaultLang?: Language; tv?: boolean }) {
  const [lang, setLang] = useState<Language>(defaultLang);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const s = summary[lang];
  const device = useDeviceVoice(lang);
  const canListen = !!s.audio || !!device;
  const total = s.audio?.durationSec ?? estimate(s.transcript);

  // switching language (or leaving the page) stops what is playing
  useEffect(() => {
    const el = audio.current;
    return () => {
      el?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [lang]);

  function toggle() {
    if (s.audio) {
      const a = audio.current;
      if (!a) return;
      if (a.paused) void a.play();
      else a.pause();
      return;
    }
    const synth = window.speechSynthesis;
    if (playing) {
      synth.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(s.transcript);
    if (device) u.voice = device;
    u.lang = device?.lang ?? LOCALE[lang];
    u.rate = deviceRate(s.transcript);
    u.onboundary = (e) => setProgress(e.charIndex / s.transcript.length);
    u.onend = () => {
      setPlaying(false);
      setProgress(1);
    };
    synth.cancel();
    synth.speak(u);
    setPlaying(true);
  }

  const label = s.audio ? `AI voice · Azure Neural (${s.audio.voice})` : device ? `Device voice (${device.name})` : null;
  return (
    <SectionCard
      id="audio-summary"
      title="The match in 60 seconds"
      action={
        <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full border border-line text-xs font-semibold">
          {(["en", "fi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => {
                setPlaying(false);
                setProgress(0);
                setLang(l);
              }}
              className={`px-3 py-1 ${lang === l ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      }
    >
      {canListen && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className={`flex items-center gap-2 rounded-full bg-accent font-semibold text-accent-ink hover:brightness-110 ${tv ? "px-6 py-3 text-xl" : "px-4 py-2 text-sm"}`}
            aria-label={playing ? "Pause the summary" : `Listen to the summary, ${fmt(total)}`}
          >
            <Icon name={playing ? "pause" : "play"} className="size-4" />
            {playing ? "Pause" : `Listen · ${fmt(total)}`}
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Summary progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
      {s.audio && (
        <audio
          ref={audio}
          key={s.audio.url}
          src={s.audio.url}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || total))}
        />
      )}
      {label && <p className="mt-2 text-xs text-muted">{label}</p>}
      <p lang={lang} className={`mt-3 leading-relaxed ${tv ? "text-xl" : "text-[15px]"}`}>
        {s.transcript}
      </p>
    </SectionCard>
  );
}
