// azure ai speech, text to speech over rest (learn.microsoft.com/azure/ai-services/speech-service/
// rest-text-to-speech): POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1 with
// Ocp-Apim-Subscription-Key, Content-Type application/ssml+xml, X-Microsoft-OutputFormat and a
// User-Agent; the body is ssml, the answer the audio. audio is capped at 10 minutes per request
import type { Language } from "@/shared/types";
import type { Speech, Tts } from "./types";

/** constant 96 kbit/s, so the duration is the size: bytes * 8 / 96000 */
export const AZURE_FORMAT = "audio-24khz-96kbitrate-mono-mp3";
const BITS_PER_SECOND = 96_000;

const LOCALE: Record<Language, string> = { en: "en-GB", fi: "fi-FI" };

const STATUS: Record<number, string> = {
  400: "a required parameter is missing or invalid",
  401: "the key isn't valid, or not for this region",
  415: "wrong content type (needs application/ssml+xml)",
  429: "too many requests for this resource's quota",
  502: "network or server problem (or invalid headers)",
  503: "the speech service is unavailable",
};

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** ssml for one voice; a rate (percent) wraps the text in <prosody> */
export function ssml(text: string, lang: Language, voice: string, rate = 0): string {
  const locale = LOCALE[lang];
  const body = rate ? `<prosody rate='${rate > 0 ? "+" : ""}${Math.round(rate)}%'>${escapeXml(text)}</prosody>` : escapeXml(text);
  return `<speak version='1.0' xml:lang='${locale}'><voice xml:lang='${locale}' name='${voice}'>${body}</voice></speak>`;
}

export interface AzureOptions {
  key: string;
  region: string;
  voices: Record<Language, string>;
  /** tests pass a mock */
  fetch?: typeof fetch;
}

export function azureTts(o: AzureOptions): Tts {
  const doFetch = o.fetch ?? fetch;
  return {
    name: "azure",
    voice: (lang) => o.voices[lang],
    async synthesize(text, lang, opts = {}): Promise<Speech> {
      const voice = o.voices[lang];
      const res = await doFetch(`https://${o.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": o.key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": AZURE_FORMAT,
          "User-Agent": "kaleva-sports",
        },
        body: ssml(text, lang, voice, opts.rate),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`azure tts: http ${res.status}${STATUS[res.status] ? ` (${STATUS[res.status]})` : ""}`);
      const mp3 = Buffer.from(await res.arrayBuffer());
      if (mp3.length === 0) throw new Error("azure tts: empty audio");
      return { mp3, durationSec: (mp3.length * 8) / BITS_PER_SECOND, voice };
    },
  };
}
