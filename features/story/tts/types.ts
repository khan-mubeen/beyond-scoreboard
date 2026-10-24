// text to speech, behind one interface: azure (rest + ssml, mp3) and none (never calls out)
import type { Language } from "@/shared/types";

export interface Speech {
  mp3: Buffer;
  durationSec: number;
  voice: string;
}

export interface Tts {
  readonly name: "azure" | "none";
  /** the voice a language is read in */
  voice(lang: Language): string;
  /** rate: speaking speed in percent around normal (+8 faster, -8 slower) */
  synthesize(text: string, lang: Language, opts?: { rate?: number }): Promise<Speech>;
}
