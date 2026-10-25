import { useEffect, useRef, useState } from "react";
import type { Language, SpokenSummary } from "@/shared/types";
import { deviceSeconds, DEVICE_RATE, PAUSE_MS, pickVoice, sentencesOf } from "./device-voice";
import { Icon } from "./Icon";
import { SectionCard } from "./SectionCard";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** the device's best voice for a language (exact locale, natural first), if it has one */
function useDeviceVoice(lang: Language): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => setVoice(pickVoice(window.speechSynthesis.getVoices(), lang));
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
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
  const total = s.audio?.durationSec ?? deviceSeconds(s.transcript);
  // each device read gets a run number, so a stop (or a language switch) ends its queue
  const run = useRef(0);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);

  function stopDevice() {
    run.current++;
    clearTimeout(pause.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  // switching language (or leaving the page) stops what is playing
  useEffect(() => {
    const el = audio.current;
    const runs = run;
    const timer = pause;
    return () => {
      el?.pause();
      runs.current++;
      clearTimeout(timer.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [lang]);

  /** sentence by sentence, slightly slow, a short pause between */
  function speakDevice(voice: SpeechSynthesisVoice) {
    const synth = window.speechSynthesis;
    const parts = sentencesOf(s.transcript);
    const mine = ++run.current;
    let done = 0;
    const next = (i: number) => {
      if (run.current !== mine) return;
      if (i >= parts.length) {
        setPlaying(false);
        setProgress(1);
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = DEVICE_RATE;
      u.onend = () => {
        done += parts[i].length + 1;
        setProgress(done / s.transcript.length);
        pause.current = setTimeout(() => next(i + 1), PAUSE_MS);
      };
      synth.speak(u);
    };
    synth.cancel();
    next(0);
    setPlaying(true);
  }

  function toggle() {
    if (s.audio) {
      const a = audio.current;
      if (!a) return;
      if (a.paused) void a.play();
      else a.pause();
      return;
    }
    if (playing) {
      stopDevice();
      setPlaying(false);
      return;
    }
    if (device) speakDevice(device);
  }

  const label = s.audio ? `AI voice · Azure Neural (${s.audio.voice})` : device ? "Device voice" : null;
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
              className={`px-3 py-1 ${lang === l ? "bg-accent text-accent-ink" : "hover:bg-surface-2"}`}
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
            className={`flex items-center gap-2 rounded-full bg-accent font-semibold text-accent-ink hover:bg-accent-hover ${tv ? "px-6 py-3 text-xl" : "px-4 py-2 text-sm"}`}
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
