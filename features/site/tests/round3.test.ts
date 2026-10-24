// bug round 3, the pure parts: the home card's question badge, watch together presence, the
// optimistic nickname, the liiga.fi link, the device voice, and the feature names everywhere
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIIGA_GAMES_URL, liigaGameUrl } from "@/features/liiga";
import { NAMES } from "@/shared/copy/names";
import { checkText } from "@/shared/guardrails";
import type { LiveCall, LiveState, MeResponse } from "@/shared/types";
import { deviceSeconds, pickVoice, sentencesOf } from "../components/device-voice";
import { featuredQuestion } from "../components/featured-question";
import { applyBroadcast } from "../components/use-match-channel";
import { withSettings } from "../data";
import { createMemoryDb, setDb } from "@/shared/db";
import { ACTIVE_MS, heartbeat, leave, partyStandings, resetPresence } from "../server/presence";

const call = (status: LiveCall["status"], locksAt: number) => ({ id: "c1", status, locksAt }) as LiveCall;
const live = (c: LiveCall | null, phase?: "lobby" | "live" | "summary" | "idle") =>
  ({ status: phase === "lobby" ? "scheduled" : phase === "summary" ? "final" : "live", call: c, rotation: phase ? { phase } : null }) as Pick<LiveState, "status" | "call" | "rotation">;

describe("home card: is a question open right now?", () => {
  const now = 1_000_000;
  it("open only while the question takes answers on the server's clock", () => {
    expect(featuredQuestion(live(call("open", now + 14_000)), now)).toEqual({ kind: "open", secondsLeft: 14 });
    // the bug: an open status with the lock already passed (or a locked call) is not "1 open"
    expect(featuredQuestion(live(call("open", now - 1)), now)).toEqual({ kind: "soon" });
    expect(featuredQuestion(live(call("locked", now + 5000)), now)).toEqual({ kind: "soon" });
    expect(featuredQuestion(live(null), now)).toEqual({ kind: "soon" });
  });
  it("the lobby's who-wins question counts; nothing before, after or between rotation matches", () => {
    expect(featuredQuestion(live(call("open", now + 30_000), "lobby"), now)?.kind).toBe("open");
    expect(featuredQuestion(live(null, "summary"), now)).toBeNull();
    expect(featuredQuestion(live(null, "idle"), now)).toBeNull();
    expect(featuredQuestion({ status: "scheduled", call: null, rotation: null }, now)).toBeNull();
    expect(featuredQuestion(null, now)).toBeNull();
  });
});

describe("watch party: presence in the database", () => {
  it("opening the match joins the party; active for 90 s; a leave drops the count, the board keeps everyone", async () => {
    const db = createMemoryDb();
    setDb(db);
    resetPresence();
    const a = await db.users.create("anon-a", "Aino");
    const b = await db.users.create("anon-b", null);
    const bot = await db.users.create("anon-bot", "Bot", true);
    expect(await heartbeat("m", a)).toBe(true);
    expect(await heartbeat("m", b)).toBe(true);
    // a repeat heartbeat is no change; bots never count
    expect(await heartbeat("m", a)).toBe(false);
    expect(await heartbeat("m", bot)).toBe(false);
    let p = await partyStandings("m");
    expect(p.watching).toBe(2);
    // 0 points too, in the order they joined; a guest without a nickname is "Guest"
    expect(p.ranked.map((e) => [e.name, e.score, e.rank])).toEqual([
      ["Aino", 0, 1],
      ["Guest", 0, 1],
    ]);
    await leave("m", b);
    p = await partyStandings("m");
    expect([p.watching, p.ranked.length, p.members.map((m) => m.name)]).toEqual([1, 2, ["Aino"]]);
    // seen 91 s ago: timed out
    await db.presence.beat("m", "", a.id, new Date(Date.now() - ACTIVE_MS - 1000).toISOString());
    resetPresence();
    expect((await partyStandings("m")).watching).toBe(0);
  });

  it("a room broadcast sets the count and the board for everyone", () => {
    const s = { watching: 1, leaderboard: [] } as unknown as LiveState;
    const after = applyBroadcast(s, "room", { watching: 3, leaderboard: [{ rank: 1, name: "Aino", score: 20 }] });
    expect(after.watching).toBe(3);
    expect(after.leaderboard).toHaveLength(1);
  });
});

describe("nickname: shown at once", () => {
  it("the /me cache gets the new name before the server answers", () => {
    const me = { nickname: null, joined: false, language: "en", user: { name: "Mikko Korhonen" } } as unknown as MeResponse;
    const next = withSettings(me, { nickname: "  Tapsa " });
    expect([next.nickname, next.joined, next.user.name]).toEqual(["Tapsa", true, "Tapsa"]);
    expect(withSettings(me, { language: "fi" })).toMatchObject({ nickname: null, language: "fi" });
  });
});

describe("liiga.fi links", () => {
  it("the official game page: stats once played, follow before and during", () => {
    expect(liigaGameUrl({ season: 2027, gameId: 2701400, status: "final" })).toBe("https://liiga.fi/fi/peli/2027/2701400/tilastot");
    expect(liigaGameUrl({ season: 2027, gameId: 2701412, status: "scheduled" })).toBe("https://liiga.fi/fi/peli/2027/2701412/seuranta");
    expect(LIIGA_GAMES_URL).toMatch(/^https:\/\/liiga\.fi\//);
  });
});

describe("device voice", () => {
  const v = (name: string, lang: string) => ({ name, lang });
  it("exact locale first, natural voices before robotic ones, none for a missing language", () => {
    const voices = [v("Microsoft David - English (United States)", "en-US"), v("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB"), v("Google Deutsch", "de-DE")];
    expect(pickVoice(voices, "en")?.name).toMatch(/Ryan Online/);
    expect(pickVoice([v("Microsoft David", "en-US"), v("Microsoft Hazel", "en-GB")], "en")?.name).toBe("Microsoft Hazel");
    expect(pickVoice([v("Microsoft Heidi", "fi-FI"), v("Microsoft Noora Online (Natural)", "fi-FI")], "fi")?.name).toMatch(/Noora/);
    expect(pickVoice(voices, "fi")).toBeNull();
    expect(pickVoice([v("English India", "en_IN")], "en")?.name).toBe("English India");
  });
  it("speaks sentence by sentence; the label knows it is slower", () => {
    expect(sentencesOf("TPS won. Next up: Ilves! Good.")).toEqual(["TPS won.", "Next up: Ilves!", "Good."]);
    expect(deviceSeconds("x".repeat(990))).toBeGreaterThan(70);
  });
});

describe("feature names", () => {
  const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === "tests" ? [] : files(p);
      return /\.(tsx?|json)$/.test(f) ? [p] : [];
    });

  it("no screen, component or server text says the old name", () => {
    const old = files(ROOT).filter((p) => /Call It!/i.test(readFileSync(p, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")));
    expect(old).toEqual([]);
  });

  it("the names pass the guardrails", () => {
    for (const n of Object.values(NAMES)) expect(checkText(n), n).toEqual([]);
  });
});
