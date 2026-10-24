// the spoken summaries' audio: made once at prep time (npm run audio:generate, or audio:import for
// a file made elsewhere), uploaded to the public "match-audio" bucket, and recorded in
// content_cache WITH its transcript. the page always shows the transcript that was spoken
import { createHash } from "node:crypto";
import { getDb } from "@/shared/db";
import { uploadPublic } from "@/shared/storage";
import type { Language, SpokenSummary } from "@/shared/types";
import type { Tts } from "../tts";

export const AUDIO_BUCKET = "match-audio";

export interface AudioRecord {
  url: string;
  durationSec: number;
  voice: string;
  transcript: string;
  transcriptHash: string;
  source: "azure" | "azure-portal";
}

export const audioKey = (matchId: string, teamId: string, lang: Language) => `${matchId}:${teamId}:audio:${lang}`;
export const transcriptHash = (text: string) => createHash("sha256").update(text).digest("hex");

export async function storedAudio(matchId: string, teamId: string, lang: Language): Promise<AudioRecord | null> {
  const row = await getDb()
    .content.get(audioKey(matchId, teamId, lang))
    .catch(() => null);
  const r = row?.content as AudioRecord | undefined;
  return r?.url && r.transcript ? r : null;
}

/** uploads an mp3 and records it with the exact transcript it reads */
export async function saveAudio(
  matchId: string,
  teamId: string,
  lang: Language,
  rec: { mp3: Buffer; durationSec: number; voice: string; transcript: string; source: AudioRecord["source"] },
): Promise<AudioRecord> {
  const hash = transcriptHash(rec.transcript);
  // named by what it says and who says it: the same text never uploads twice
  const name = createHash("sha256").update(`${rec.transcript}|${rec.voice}|${lang}`).digest("hex").slice(0, 20);
  const url = await uploadPublic(AUDIO_BUCKET, `${matchId}/${lang}-${name}.mp3`, rec.mp3, "audio/mpeg");
  const record: AudioRecord = { url, durationSec: Math.round(rec.durationSec * 10) / 10, voice: rec.voice, transcript: rec.transcript, transcriptHash: hash, source: rec.source };
  await getDb().content.put(audioKey(matchId, teamId, lang), record, "template");
  return record;
}

/** a summary should take about a minute to hear */
export const SPOKEN_SECONDS = { min: 50, max: 75 };

/**
 * synthesizes a transcript and stores it (prep time, or a running server with TTS_ENABLED=true).
 * outside 50-75 s it is made once more at a speaking rate that lands near a minute: the words
 * (and so the transcript shown with it) stay exactly the same
 */
export async function generateAudio(tts: Tts, matchId: string, teamId: string, lang: Language, transcript: string): Promise<AudioRecord & { rate: number }> {
  let speech = await tts.synthesize(transcript, lang);
  let rate = 0;
  if (speech.durationSec < SPOKEN_SECONDS.min || speech.durationSec > SPOKEN_SECONDS.max) {
    rate = Math.max(-25, Math.min(25, Math.round((speech.durationSec / 62 - 1) * 100)));
    speech = await tts.synthesize(transcript, lang, { rate });
  }
  return { ...(await saveAudio(matchId, teamId, lang, { ...speech, transcript, source: "azure" })), rate };
}

const told = new Set<string>();
export function sayOnce(line: string) {
  if (told.has(line)) return;
  told.add(line);
  console.log(line);
}

/** the pair the page gets: the stored audio and the transcript stored with it, else the text alone */
export function spokenFrom(lang: Language, text: string, rec: AudioRecord | null, where: string): SpokenSummary {
  if (!rec) return { lang, transcript: text, audio: null };
  if (rec.transcriptHash !== transcriptHash(text)) sayOnce(`story: audio out of date for ${where}/${lang} (the stored transcript is shown with it)`);
  return { lang, transcript: rec.transcript, audio: { url: rec.url, durationSec: rec.durationSec, voice: rec.voice, source: rec.source } };
}
