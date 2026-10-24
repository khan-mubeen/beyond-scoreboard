// text to speech: the azure request as microsoft documents it (mocked http), and the switch:
// with TTS_ENABLED=false the running server never sends anything to azure
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, setDb } from "@/shared/db";
import { buildMatchLedger, type MatchFactsInput } from "../ledger/match-ledger";
import { spokenSummary } from "../server/match-content";
import { AZURE_FORMAT, azureTts, ssml } from "../tts/azure";
import { DEFAULT_VOICES, hasAzureKey, ttsFromEnv } from "../tts";

const facts: MatchFactsInput = {
  matchId: "2027-2701400",
  home: "SaiPa",
  away: "Kärpät",
  team: "Kärpät",
  score: { home: 2, away: 1 },
  decidedIn: "shootout",
  venue: "Kisapuisto",
  date: "Tuesday 20 October 2026",
  dateFi: "20.10.2026",
  goals: [{ scorer: "Mikko Virtanen", team: "Kärpät", period: 2, time: "08:09", homeScore: 0, awayScore: 1, kind: null }],
  chanceBefore: 90,
  chanceAfter: 91,
  positionBefore: 6,
  positionAfter: 6,
  sourceGameIds: ["2027-2701400"],
};

describe("azure tts (mocked http)", () => {
  it("posts ssml with the documented headers and reads an mp3 back", async () => {
    const mp3 = Buffer.alloc(12_000 * 60); // 60 s at 96 kbit/s
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(mp3, { status: 200 }));
    const tts = azureTts({ key: "k".repeat(32), region: "westeurope", voices: { fi: "fi-FI-HarriNeural", en: "en-GB-RyanNeural" }, fetch: fetch as unknown as typeof globalThis.fetch });
    const speech = await tts.synthesize("Kärpät & HIFK <3", "fi");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Ocp-Apim-Subscription-Key": "k".repeat(32),
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": AZURE_FORMAT,
      "User-Agent": "kaleva-sports",
    });
    expect(init?.body).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="fi-FI"><voice name="fi-FI-HarriNeural"><prosody rate="-10%">Kärpät &amp; HIFK &lt;3</prosody></voice></speak>',
    );
    expect(speech).toMatchObject({ voice: "fi-FI-HarriNeural", durationSec: 60 });
  });

  it("reads calmly: -10% on top of any length adjustment, a short break between sentences", () => {
    expect(ssml("Hei", "fi", "fi-FI-HarriNeural", -8)).toContain('<prosody rate="-18%">Hei</prosody>');
    expect(ssml("Hei", "fi", "fi-FI-HarriNeural", 25)).toContain('<prosody rate="+15%">');
    expect(ssml("Kärpät voitti. Seuraava peli on perjantaina! Hyvä.", "fi", "fi-FI-HarriNeural")).toContain(
      'Kärpät voitti.<break time="350ms"/>Seuraava peli on perjantaina!<break time="350ms"/>Hyvä.',
    );
  });

  it("uses the newscast style only for voices that have it (Microsoft's voice table)", () => {
    const en = ssml("TPS beat Ilves.", "en", "en-US-GuyNeural");
    expect(en).toContain('xml:lang="en-US"');
    expect(en).toContain('<mstts:express-as style="newscast"><prosody rate="-10%">TPS beat Ilves.</prosody></mstts:express-as>');
    // no fi-FI voice and no en-GB voice we'd pick has a newscast style
    for (const [lang, voice] of [["fi", "fi-FI-HarriNeural"], ["fi", "fi-FI-NooraNeural"], ["en", "en-GB-RyanNeural"]] as const) {
      expect(ssml("Hei.", lang, voice)).not.toContain("express-as");
    }
    expect(DEFAULT_VOICES).toEqual({ fi: "fi-FI-HarriNeural", en: "en-US-GuyNeural" });
  });

  it("says what a failed status means", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 401 }));
    const tts = azureTts({ key: "k".repeat(32), region: "westeurope", voices: { fi: "fi-FI-HarriNeural", en: "en-GB-RyanNeural" }, fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(tts.synthesize("Hei", "fi")).rejects.toThrow(/401.*key/);
  });

  it("treats the .env.example placeholder as no key", () => {
    vi.stubEnv("AZURE_SPEECH_KEY", "your-azure-speech-key");
    expect(hasAzureKey()).toBe(false);
    expect(ttsFromEnv().name).toBe("none");
    vi.unstubAllEnvs();
  });
});

describe("TTS_ENABLED", () => {
  beforeEach(() => {
    setDb(createMemoryDb());
    vi.stubEnv("AZURE_SPEECH_KEY", "a-real-looking-key-0123456789abcdef");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("off: the summary has its transcript and no audio, and nothing goes to azure", async () => {
    vi.stubEnv("TTS_ENABLED", "false");
    const fetch = vi.fn(async (_u: string | URL | Request) => new Response(""));
    vi.stubGlobal("fetch", fetch);
    const s = await spokenSummary(facts, "team", "fi");
    expect(s.audio).toBeNull();
    expect(s.transcript).toContain("Kärpillä");
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch.mock.calls.filter(([u]) => String(u).includes("tts.speech.microsoft.com"))).toEqual([]);
    expect(buildMatchLedger(facts).facts.length).toBeGreaterThan(5);
  });

  it("on: a missing audio is made once in the background", async () => {
    vi.stubEnv("TTS_ENABLED", "true");
    const fetch = vi.fn(async (_u: string | URL | Request) => new Response(Buffer.alloc(12_000 * 60)));
    vi.stubGlobal("fetch", fetch);
    await spokenSummary(facts, "team", "en");
    await new Promise((r) => setTimeout(r, 50));
    expect(fetch.mock.calls.filter(([u]) => String(u).includes("tts.speech.microsoft.com")).length).toBe(1);
  });
});
