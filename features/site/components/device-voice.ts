// the browser's own voice, when the summary has no ai audio yet: the best voice the device has for
// the language, a little slower than normal, sentence by sentence with a short pause between
import type { Language } from "@/shared/types";

export interface VoiceLike {
  name: string;
  lang: string;
}

/** the locales a language should be read in, best first */
const LOCALES: Record<Language, string[]> = { fi: ["fi-fi"], en: ["en-gb", "en-us"] };
/** the natural-sounding ones (Edge's "Online (Natural)", Chrome/Android "Neural") */
const NATURAL = /natural|neural|online/i;

export const DEVICE_RATE = 0.9;
export const PAUSE_MS = 300;

/** exact locale first, and a natural voice before a robotic one; null when the device has none */
export function pickVoice<T extends VoiceLike>(voices: T[], lang: Language): T | null {
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  const score = (v: T) => {
    const locale = norm(v.lang);
    const exact = LOCALES[lang].indexOf(locale);
    if (exact < 0 && !locale.startsWith(lang)) return -1;
    // exact locale (en-GB before en-US) outranks the same language elsewhere; natural adds on top
    return (exact >= 0 ? 10 - exact : 0) + (NATURAL.test(v.name) ? 20 : 0);
  };
  let best: T | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = score(v);
    if (s > bestScore) [best, bestScore] = [v, s];
  }
  return best;
}

export const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

/** about how long the device takes: ~14 characters a second at rate 1, plus the pauses */
export const deviceSeconds = (text: string) => Math.round(text.length / 14 / DEVICE_RATE + (Math.max(0, sentencesOf(text).length - 1) * PAUSE_MS) / 1000);
