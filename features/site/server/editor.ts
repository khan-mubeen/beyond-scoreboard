// /editor (host token): the human in the loop. stored match texts (story and 60-second summary per
// match and language) with their source, the validator's result and the review; edits are checked
// by the validator again and stay pending until approved. phrase-bank wordings by question type,
// approved or rejected in bulk. and the mistakes fans reported. public pages only ever show a
// stored text an editor approved here (features/story/server/match-content.ts)
import { phraseProblem, rotationConfig } from "@/features/live/server";
import type { CallKind } from "@/features/live/server";
import { buildMatchLedger, verify } from "@/features/story/server";
import { getSeasonContext } from "@/features/stakes/server";
import { getDb } from "@/shared/db";
import type { Content, ContentReview, EditorPart, EditorPhraseGroup, EditorReport, EditorText } from "@/shared/types";
import { matchFactsFor } from "./index";
import { teamBook } from "./teams";

export class EditorError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type TextKind = "story" | "summary";

/** "2027-2701379:651304385:tps:summary:fi" -> its parts (the team id has a colon of its own) */
export function parseTextKey(key: string): { matchId: string; teamId: string; kind: TextKind; lang: "en" | "fi" } | null {
  const p = key.split(":");
  const lang = p.at(-1);
  const kind = p.at(-2);
  if (p.length < 4 || (kind !== "story" && kind !== "summary") || (lang !== "en" && lang !== "fi")) return null;
  return { matchId: p[0], teamId: p.slice(1, -2).join(":"), kind, lang };
}

const PENDING: ContentReview = { status: "pending", by: null, at: null };

/** every stored text, grouped per match and language; "demo" keeps the rotation's matches */
export async function editorTexts(filter: "demo" | "all"): Promise<EditorText[]> {
  const db = getDb();
  const demoIds = new Set(rotationConfig()?.matches.map((m) => m.matchId) ?? []);
  const [rows, reports, ctx, book] = await Promise.all([db.content.list(), db.reports.list(500), getSeasonContext(), teamBook()]);
  const title = (id: string) => {
    const f = ctx.schedule.find((x) => x.id === id);
    return f ? `${book.ref(f.homeTeamId, f.homeName).name} – ${book.ref(f.awayTeamId, f.awayName).name}` : id;
  };
  const groups = new Map<string, { key: string; kind: TextKind; content: Content; source: "template" | "llm"; matchId: string; teamId: string; lang: "en" | "fi" }[]>();
  for (const r of rows) {
    const k = parseTextKey(r.key);
    const content = r.content as Content;
    if (!k || !Array.isArray(content?.sentences)) continue;
    if (filter === "demo" && !demoIds.has(k.matchId)) continue;
    const id = `${k.matchId}|${k.teamId}|${k.lang}`;
    (groups.get(id) ?? groups.set(id, []).get(id)!).push({ ...k, key: r.key, content, source: r.source });
  }
  const facts = new Map<string, Awaited<ReturnType<typeof matchFactsFor>>>();
  const out: EditorText[] = [];
  for (const [id, parts] of groups) {
    const { matchId, lang } = parts[0];
    if (!facts.has(matchId)) facts.set(matchId, await matchFactsFor(matchId).catch(() => null));
    const f = facts.get(matchId);
    const shown: EditorPart[] = parts
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "story" ? -1 : 1))
      .map((p) => {
        const ledger = f ? buildMatchLedger(p.kind === "story" ? f.facts : f.summaryFacts) : null;
        const report = ledger ? verify(p.content, ledger.facts) : null;
        return {
          key: p.key,
          kind: p.kind,
          source: p.source === "llm" ? "ai" : "template",
          sentences: p.content.sentences.map((s, i) => ({ text: s.text, passed: report ? report.claims[i].passed : false, reason: report ? report.claims[i].reason : "the match data couldn't be read" })),
          blocked: report ? report.blockedCount : p.content.sentences.length,
          review: p.content.review ?? PENDING,
        };
      });
    const statuses = shown.map((p) => p.review.status);
    const status = statuses.every((s) => s === "approved") ? "approved" : statuses.includes("rejected") ? "rejected" : "pending";
    const last = shown.map((p) => p.review).filter((r) => r.at).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
    out.push({
      id,
      matchId,
      title: title(matchId),
      lang,
      demo: demoIds.has(matchId),
      status,
      reviewedBy: status === "pending" ? null : (last?.by ?? null),
      reviewedAt: status === "pending" ? null : (last?.at ?? null),
      parts: shown,
      reports: reports.filter((r) => r.refKind === "text" && shown.some((p) => p.key === r.refKey)).length,
      href: `/match/${matchId}`,
    });
  }
  return out.sort((a, b) => Number(b.demo) - Number(a.demo) || a.title.localeCompare(b.title) || a.lang.localeCompare(b.lang));
}

const reviewerOf = (name: string | undefined) => {
  const n = (name ?? "").trim().slice(0, 60);
  if (n.length < 2) throw new EditorError(400, "add your name as the reviewer");
  return n;
};

/** approve or reject a match's texts in one language (its story and summary together) */
export async function reviewText(id: string, action: "approve" | "reject", reviewerName: string) {
  const reviewer = reviewerOf(reviewerName);
  const item = (await editorTexts("all")).find((t) => t.id === id);
  if (!item) throw new EditorError(404, "no such text");
  if (action === "approve" && item.parts.some((p) => p.blocked > 0)) throw new EditorError(409, "a sentence doesn't pass the validator: edit it first");
  const db = getDb();
  const at = new Date().toISOString();
  for (const part of item.parts) {
    const row = await db.content.get(part.key);
    if (!row) continue;
    const content = row.content as Content;
    await db.content.put(part.key, { ...content, review: { status: action === "approve" ? "approved" : "rejected", by: reviewer, at, edited: content.review?.edited ?? false } }, row.source);
  }
  return (await editorTexts("all")).find((t) => t.id === id)!;
}

/**
 * an editor's change to a stored text: each sentence keeps its fact citations, the validator checks
 * the whole text again (a typed number that isn't a cited fact, a repeat, a betting word: refused),
 * and it goes back to pending until approved
 */
export async function editText(key: string, sentences: string[], reviewerName: string) {
  reviewerOf(reviewerName);
  const k = parseTextKey(key);
  const db = getDb();
  const row = k ? await db.content.get(key) : null;
  if (!k || !row) throw new EditorError(404, "no such text");
  const content = row.content as Content;
  if (sentences.length !== content.sentences.length) throw new EditorError(400, `send all ${content.sentences.length} sentences`);
  const next: Content = { ...content, sentences: content.sentences.map((s, i) => ({ text: sentences[i].trim(), factIds: s.factIds })).filter((s) => s.text.length > 0) };
  const f = await matchFactsFor(k.matchId);
  if (!f) throw new EditorError(404, "the match data couldn't be read");
  const report = verify(next, buildMatchLedger(k.kind === "story" ? f.facts : f.summaryFacts).facts);
  if (report.blockedCount > 0) {
    throw new EditorError(422, "the edited text doesn't pass the validator", { claims: report.claims.filter((c) => !c.passed).map((c) => ({ text: c.text, reason: c.reason })) });
  }
  await db.content.put(key, { ...next, review: { ...PENDING, edited: true } }, row.source);
  return (await editorTexts("all")).find((t) => t.parts.some((p) => p.key === key))!;
}

/** the phrase bank by question type: each wording's status and whether it still passes the rules */
export async function editorPhrases(): Promise<EditorPhraseGroup[]> {
  const rows = await getDb().phrases.list();
  const groups = new Map<string, typeof items>();
  const items = rows.map((r) => ({
    id: r.id,
    lang: r.lang,
    template: r.template,
    status: r.approved ? ("approved" as const) : r.reviewedAt ? ("rejected" as const) : ("pending" as const),
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    problem: phraseProblem(r.callType as CallKind, r.template),
    callType: r.callType,
  }));
  for (const i of items) (groups.get(i.callType) ?? groups.set(i.callType, []).get(i.callType)!).push(i);
  return [...groups.entries()].map(([callType, list]) => ({ callType, items: list }));
}

export async function reviewPhrases(ids: string[], action: "approve" | "reject", reviewerName: string) {
  const reviewer = reviewerOf(reviewerName);
  const rows = await getDb().phrases.list();
  // a wording that breaks the rules can be rejected, never approved
  const bad = rows.filter((r) => ids.includes(r.id) && phraseProblem(r.callType as CallKind, r.template) !== null).map((r) => r.id);
  if (action === "approve" && bad.length) throw new EditorError(409, `${bad.length} wording(s) break the wording rules`);
  return { changed: await getDb().phrases.review(ids, action === "approve", reviewer) };
}

/** the mistakes fans reported, newest first, each with a link to its text */
export async function editorReports(): Promise<EditorReport[]> {
  const [rows, ctx, book] = await Promise.all([getDb().reports.list(200), getSeasonContext(), teamBook()]);
  const title = (id: string | null) => {
    const f = id ? ctx.schedule.find((x) => x.id === id) : null;
    return f ? `${book.ref(f.homeTeamId, f.homeName).name} – ${book.ref(f.awayTeamId, f.awayName).name}` : (id ?? "");
  };
  return rows.map((r) => {
    const k = r.refKind === "text" ? parseTextKey(r.refKey) : null;
    const matchId = r.matchId ?? k?.matchId ?? null;
    return { ...r, what: r.refKind === "call" ? "Your Call! question" : k ? `${k.kind === "story" ? "Match story" : "60-second summary"} (${k.lang.toUpperCase()})` : "Text", title: title(matchId), href: matchId ? `/match/${matchId}` : null };
  });
}
