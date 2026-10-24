// the text-to-speech provider from the environment. TTS_ENABLED decides whether the running server
// may call it (the demo keeps it off and plays stored audio only); the prep script
// (npm run audio:generate) uses azure whenever a real AZURE_SPEECH_KEY is set
import type { Language } from "@/shared/types";
import { azureTts } from "./azure";
import type { Tts } from "./types";

export type { Speech, Tts } from "./types";

const PLACEHOLDER_KEY = "your-azure-speech-key";

export const DEFAULT_VOICES: Record<Language, string> = { fi: "fi-FI-HarriNeural", en: "en-GB-RyanNeural" };

/** the running server may synthesize speech */
export const ttsEnabled = () => process.env.TTS_ENABLED === "true";

/** a real key, not empty and not the .env.example placeholder */
export function hasAzureKey(): boolean {
  const k = process.env.AZURE_SPEECH_KEY?.trim();
  return !!k && k !== PLACEHOLDER_KEY && k.length >= 20;
}

export const voices = (): Record<Language, string> => ({
  fi: process.env.TTS_VOICE_FI || DEFAULT_VOICES.fi,
  en: process.env.TTS_VOICE_EN || DEFAULT_VOICES.en,
});

/** never calls anything: the demo setting */
export const noneTts: Tts = {
  name: "none",
  voice: (lang) => voices()[lang],
  async synthesize() {
    throw new Error("text to speech is off");
  },
};

/** azure when it has a key (and TTS_PROVIDER is azure), else none */
export function ttsFromEnv(): Tts {
  if ((process.env.TTS_PROVIDER ?? "azure") !== "azure" || !hasAzureKey()) return noneTts;
  return azureTts({ key: process.env.AZURE_SPEECH_KEY!.trim(), region: process.env.AZURE_SPEECH_REGION || "westeurope", voices: voices() });
}
