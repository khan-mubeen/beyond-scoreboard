// responsible ai end to end, in-process on the snapshots and the memory db: a stored ai text is
// never shown until an editor approves it in /editor (then it says so), the labels follow the
// real source, an edit runs the validator again, phrase wordings are reviewed per question type,
// and "report a mistake" is stored, rate-limited and listed for the editors
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wordCallSourced } from "@/features/live/server";
import type { Content, EditorPhraseGroup, EditorText, FinishedMatchDetail } from "@/shared/types";
import { aiLabelText } from "../components/AiLabel";

const HOST = "test-host-token";
Object.assign(process.env, { USE_SNAPSHOT: "true", DB_MODE: "memory", SIM_RUNS: "300", HOST_TOKEN: HOST, LLM_ENABLED: "false" });
for (const k of ["LIIGA_API_URL", "LIIGA_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DEMO_MODE", "DEMO_REPLAY_MATCH_ID"]) delete process.env[k];

const FINAL = "2027-2701398"; // KooKoo 3-2 Tappara after a shootout
let base = "";
let close = () => {};
let db: import("@/shared/db").Db;
beforeAll(async () => {
  const express = (await import("express")).default;
  const { api } = await import("@/server/api");
  const { startup } = await import("@/features/site/server/routes/startup");
  await startup();
  db = (await import("@/shared/db")).getDb();
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
}, 120_000);
afterAll(() => close());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
let cookie = "";
async function http(path: string, opts: { method?: string; body?: unknown; host?: boolean } = {}) {
  const res = await fetch(`${base}/api/site${path}`, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(cookie && { cookie }), ...(opts.host && { "x-host-token": HOST }) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const c = res.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("ks_anon="));
  if (c && !cookie) cookie = c;
  return { status: res.status, body: (await res.json().catch(() => null)) as Json };
}
const page = async () => (await http(`/matches/${FINAL}`)).body as FinishedMatchDetail;
const texts = async () => ((await http("/editor/texts?filter=all", { host: true })).body.texts as EditorText[]);

describe("labels follow the real source", () => {
  it("texts, questions, data and audio", () => {
    expect(aiLabelText({ kind: "text", origin: { source: "ai", reviewed: null, key: "k" } })).toBe("AI-written · facts checked against Liiga data");
    expect(aiLabelText({ kind: "text", origin: { source: "template", reviewed: null, key: "k" } })).toBe("Written from match data");
    expect(aiLabelText({ kind: "text", origin: null })).toBe("Written from match data");
    expect(aiLabelText({ kind: "call", wording: "ai" })).toBe("Question wording by AI · answers decided by Liiga data");
    expect(aiLabelText({ kind: "call", wording: "auto" })).toBe("Automatic question from live data");
    expect(aiLabelText({ kind: "data" })).toBe("From Liiga data");
    expect(aiLabelText({ kind: "audio", ai: true })).toBe("AI voice (Azure)");
    expect(aiLabelText({ kind: "audio", ai: false })).toBe("Device voice");
  });

  it("a question's wording is ai only when an approved phrase-bank wording was used", () => {
    const vars = { team: "Tappara", home: "Tappara", away: "Ilves" };
    expect(wordCallSourced("power_play", vars, [])).toEqual({ text: "Will Tappara score on this power play?", ai: false });
    expect(wordCallSourced("power_play", vars, ["Can {team} make this power play count?"])).toEqual({ text: "Can Tappara make this power play count?", ai: true });
    // a wording that breaks the rules (not a question, a betting word) falls back to the built-in one
    expect(wordCallSourced("power_play", vars, ["Bet on {team} now"]).ai).toBe(false);
    expect(wordCallSourced("power_play", vars, ["What are the odds {team} scores?"]).ai).toBe(false);
  });
});

describe("the editor and the public pages", () => {
  let key = "";
  let item: EditorText;

  it("with no stored text the page shows the template, labelled as written from match data", async () => {
    const p = await page();
    expect(p.status).toBe("final");
    expect(p.whatItMeant.story.origin).toMatchObject({ source: "template", reviewed: null });
    key = p.whatItMeant.story.origin!.key!;
    expect(key).toMatch(new RegExp(`^${FINAL}:.+:story:en$`));
  });

  it("an ai text waiting for review is never shown publicly", async () => {
    const shown = (await page()).whatItMeant.story;
    // the "llm" wrote it: the same verified sentences, one reworded, pending review
    const sentences = shown.sentences.map((s, i) => (i === 0 ? { ...s, text: `${s.text.replace(/\.$/, "")}, by the way.` } : s));
    await db.content.put(key, { ...shown, sentences, origin: undefined, review: { status: "pending", by: null, at: null } } as Content, "llm");
    const after = (await page()).whatItMeant.story;
    expect(after.origin?.source).toBe("template");
    expect(after.sentences[0].text).toBe(shown.sentences[0].text);
    // a rejected one neither
    const stored = (await db.content.get(key))!.content as Content;
    await db.content.put(key, { ...stored, review: { status: "rejected", by: "Aino", at: new Date().toISOString() } }, "llm");
    expect((await page()).whatItMeant.story.origin?.source).toBe("template");
    await db.content.put(key, { ...stored, review: { status: "pending", by: null, at: null } }, "llm");
  });

  it("/editor needs the host token", async () => {
    expect((await http("/editor/texts")).status).toBe(403);
    expect((await http("/editor/reports")).status).toBe(403);
    item = (await texts()).find((t) => t.parts.some((p) => p.key === key))!;
    expect(item).toMatchObject({ matchId: FINAL, lang: "en", status: "pending", reviewedBy: null });
    expect(item.parts.find((p) => p.key === key)).toMatchObject({ source: "ai", blocked: 0 });
  });

  it("an edit runs the validator again: a typed number is refused, a clean edit goes back to pending", async () => {
    const part = item.parts.find((p) => p.key === key)!;
    const wrong = part.sentences.map((s, i) => (i === 0 ? "The playoff chance jumped to 97% tonight." : s.text));
    const refused = await http("/editor/texts/edit", { method: "POST", host: true, body: { key, sentences: wrong, reviewer: "Aino Editor" } });
    expect(refused.status).toBe(422);
    expect(refused.body.claims.length).toBeGreaterThan(0);
    expect(((await db.content.get(key))!.content as Content).sentences[0].text).not.toContain("97%");
    // no reviewer name: refused
    expect((await http("/editor/texts/edit", { method: "POST", host: true, body: { key, sentences: part.sentences.map((s) => s.text), reviewer: "" } })).status).toBe(400);
    const clean = part.sentences.map((s, i) => (i === 0 ? s.text.replace(", by the way.", ".") : s.text));
    const ok = await http("/editor/texts/edit", { method: "POST", host: true, body: { key, sentences: clean, reviewer: "Aino Editor" } });
    expect(ok.status).toBe(200);
    expect(((await db.content.get(key))!.content as Content).review).toMatchObject({ status: "pending", edited: true });
    expect((await page()).whatItMeant.story.origin?.source).toBe("template");
  });

  it("approved: shown publicly, labelled ai-written and reviewed, with the reviewer and the time stored", async () => {
    const r = await http(`/editor/texts/${encodeURIComponent(item.id)}/review`, { method: "POST", host: true, body: { action: "approve", reviewer: "Aino Editor" } });
    expect(r.status).toBe(200);
    const stored = ((await db.content.get(key))!.content as Content).review!;
    expect(stored).toMatchObject({ status: "approved", by: "Aino Editor" });
    expect(Date.parse(stored.at!)).toBeGreaterThan(0);
    const shown = (await page()).whatItMeant.story;
    expect(shown.origin).toMatchObject({ source: "ai", reviewed: { by: "Aino Editor" }, key });
    expect(aiLabelText({ kind: "text", origin: shown.origin })).toBe("AI-written · facts checked against Liiga data");
    // rejected again: back to the template
    await http(`/editor/texts/${encodeURIComponent(item.id)}/review`, { method: "POST", host: true, body: { action: "reject", reviewer: "Aino Editor" } });
    expect((await page()).whatItMeant.story.origin).toMatchObject({ source: "template", reviewed: null });
  });

  it("a text that fails the validator can't be approved", async () => {
    const stored = (await db.content.get(key))!.content as Content;
    await db.content.put(key, { ...stored, sentences: [{ text: "Tappara are 97% sure of the playoffs.", factIds: [] }], review: { status: "pending", by: null, at: null } }, "llm");
    const r = await http(`/editor/texts/${encodeURIComponent(item.id)}/review`, { method: "POST", host: true, body: { action: "approve", reviewer: "Aino Editor" } });
    expect(r.status).toBe(409);
    // and even approved by hand in the database, a text that no longer passes is not shown
    await db.content.put(key, { ...stored, sentences: [{ text: "Tappara are 97% sure of the playoffs.", factIds: [] }], review: { status: "approved", by: "x", at: new Date().toISOString() } }, "llm");
    expect((await page()).whatItMeant.story.origin?.source).toBe("template");
  });

  it("phrase wordings: grouped by question type, approved in bulk, never one that breaks the rules", async () => {
    await db.phrases.insert([
      { callType: "power_play", lang: "en", template: "Can {team} make this power play count?", approved: false },
      { callType: "power_play", lang: "en", template: "Next goal", approved: false },
    ]);
    const groups = (await http("/editor/phrases", { host: true })).body.groups as EditorPhraseGroup[];
    const g = groups.find((x) => x.callType === "power_play")!;
    const good = g.items.find((i) => i.template.endsWith("count?"))!;
    const bad = g.items.find((i) => i.template === "Next goal")!;
    expect(bad.problem).toBeTruthy();
    expect((await http("/editor/phrases", { method: "POST", host: true, body: { ids: [good.id, bad.id], action: "approve", reviewer: "Aino Editor" } })).status).toBe(409);
    expect((await http("/editor/phrases", { method: "POST", host: true, body: { ids: [good.id], action: "approve", reviewer: "Aino Editor" } })).body.changed).toBe(1);
    const after = ((await http("/editor/phrases", { host: true })).body.groups as EditorPhraseGroup[]).find((x) => x.callType === "power_play")!;
    expect(after.items.find((i) => i.id === good.id)).toMatchObject({ status: "approved", reviewedBy: "Aino Editor" });
    expect(await db.phrases.listApproved("power_play", "en")).toContain("Can {team} make this power play count?");
  });
});

describe("report a mistake", () => {
  it("stored, moderated, one every 20 s, and listed in /editor with a link", async () => {
    const key = (await page()).whatItMeant.story.origin!.key!;
    expect((await http("/reports", { method: "POST", body: { refKind: "text", refKey: key, matchId: FINAL, message: "x" } })).status).toBe(400);
    expect((await http("/reports", { method: "POST", body: { refKind: "text", refKey: key, matchId: FINAL, message: "What are the odds on this?" } })).status).toBe(422);
    const sent = await http("/reports", { method: "POST", body: { refKind: "text", refKey: key, matchId: FINAL, message: "The second sentence has the wrong period." } });
    expect(sent.status).toBe(201);
    expect((await http("/reports", { method: "POST", body: { refKind: "text", refKey: key, matchId: FINAL, message: "And one more thing." } })).status).toBe(429);
    const listed = (await http("/editor/reports", { host: true })).body.reports;
    expect(listed[0]).toMatchObject({ refKind: "text", refKey: key, message: "The second sentence has the wrong period.", href: `/match/${FINAL}`, what: "Match story (EN)" });
    expect((await texts()).find((t) => t.parts.some((p) => p.key === key))?.reports).toBe(1);
  });
});
