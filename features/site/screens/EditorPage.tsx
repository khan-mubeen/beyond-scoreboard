import { useEffect, useState } from "react";
import type { EditorPart, EditorPhraseGroup, EditorReport, EditorText } from "@/shared/types";
import { Icon } from "../components/Icon";
import { Pill } from "../components/SectionCard";
import { Breadcrumbs, SiteLayout } from "../components/SiteLayout";
import { Tabs } from "../components/Tabs";
import { toast } from "../components/Toast";
import { usePageTitle } from "../components/usePageTitle";
import { hostGet, hostPost, readHostToken, saveHostToken } from "../data";

type Tab = "texts" | "phrases" | "reports";
type Filter = "demo" | "all";

const NAME_KEY = "kaleva:editor-name";
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // private mode: the name lasts for this page
  }
};

const STATUS_TONE = { approved: "good", rejected: "accent", pending: "neutral" } as const;
const STATUS_LABEL = { approved: "Approved", rejected: "Rejected", pending: "Pending review" };
const KIND_LABEL = { story: "Match story", summary: "60-second summary" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** one stored text: each sentence editable, with the validator's verdict beside it */
function PartEditor({ part, onSave, busy }: { part: EditorPart; onSave: (key: string, sentences: string[]) => Promise<boolean>; busy: boolean }) {
  // a saved edit remounts this (its key holds the text), so the draft starts from the stored text
  const [draft, setDraft] = useState(() => part.sentences.map((s) => s.text));
  const changed = draft.some((t, i) => t !== part.sentences[i]?.text);
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{KIND_LABEL[part.kind]}</span>
        <Pill tone="outline">{part.source === "ai" ? "AI-written" : "Written from match data"}</Pill>
        {part.blocked > 0 ? <Pill tone="accent">{part.blocked} blocked by the validator</Pill> : <Pill tone="good">Validator passed</Pill>}
        {part.review.edited && <Pill>Edited</Pill>}
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {part.sentences.map((s, i) => (
          <li key={i} className="flex gap-2">
            <Icon name={s.passed ? "check" : "close"} className={`mt-2.5 size-4 shrink-0 ${s.passed ? "text-good" : "text-bad"}`} label={s.passed ? "Passes" : "Blocked"} />
            <div className="flex-1">
              <textarea
                aria-label={`Sentence ${i + 1}`}
                value={draft[i] ?? ""}
                rows={2}
                onChange={(e) => setDraft((d) => d.map((t, j) => (j === i ? e.target.value : t)))}
                className="w-full rounded-lg border border-line bg-surface p-2 text-sm leading-snug focus:border-accent focus:outline-none"
              />
              {!s.passed && s.reason && <p className="text-xs text-bad">{s.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
      {changed && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void onSave(part.key, draft)} className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-surface disabled:opacity-50">
            Save edits (checked again)
          </button>
          <button type="button" onClick={() => setDraft(part.sentences.map((s) => s.text))} className="h-9 rounded-lg border border-line px-3 text-sm font-semibold">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

/** /editor (host token): approve, edit or reject stored texts and phrase wordings, read reports */
export function EditorPage() {
  usePageTitle("Editor · Kaleva Sports");
  const [token, setToken] = useState(readHostToken);
  const [name, setName] = useState(readName);
  const [tab, setTab] = useState<Tab>("texts");
  const [filter, setFilter] = useState<Filter>("demo");
  const [texts, setTexts] = useState<EditorText[] | null>(null);
  const [phrases, setPhrases] = useState<EditorPhraseGroup[] | null>(null);
  const [reports, setReports] = useState<EditorReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // bumped after every change, to load the lists again
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let current = true;
    void Promise.all([
      hostGet<{ texts: EditorText[] }>(`/api/site/editor/texts?filter=${filter}`, token),
      hostGet<{ groups: EditorPhraseGroup[] }>("/api/site/editor/phrases", token),
      hostGet<{ reports: EditorReport[] }>("/api/site/editor/reports", token),
    ]).then(([t, p, r]) => {
      if (!current) return;
      if (!t.ok) return setError(t.status === 403 ? "That host token isn't right." : t.error);
      setError(null);
      setTexts(t.data.texts);
      if (p.ok) setPhrases(p.data.groups);
      if (r.ok) setReports(r.data.reports);
    });
    return () => {
      current = false;
    };
  }, [token, filter, version]);

  async function post<T>(url: string, body: unknown, done: string): Promise<{ ok: true; data: T } | { ok: false }> {
    saveHostToken(token);
    saveName(name);
    setBusy(true);
    const res = await hostPost<T>(url, { ...(body as object), reviewer: name }, token);
    setBusy(false);
    if (!res.ok) {
      toast(res.error, { tone: "bad" });
      return { ok: false };
    }
    toast(done);
    setVersion((v) => v + 1);
    return res;
  }

  const review = (t: EditorText, action: "approve" | "reject") => post(`/api/site/editor/texts/${encodeURIComponent(t.id)}/review`, { action }, action === "approve" ? `Approved: ${t.title} (${t.lang.toUpperCase()})` : "Rejected");
  const save = async (key: string, sentences: string[]) => (await post("/api/site/editor/texts/edit", { key, sentences }, "Saved. It passed the validator; approve it to publish")).ok;
  const reviewGroup = (ids: string[], action: "approve" | "reject") => post("/api/site/editor/phrases", { ids, action }, action === "approve" ? `Approved ${ids.length} wording(s)` : `Rejected ${ids.length} wording(s)`);

  const pending = texts?.filter((t) => t.status === "pending").length ?? 0;
  return (
    <SiteLayout sidebar={{ docked: false }}>
      <main className="mx-auto max-w-5xl px-4 pb-14 md:px-6">
        <Breadcrumbs items={[{ label: "Sports", href: "/sports" }, { label: "Editor" }]} />
        <h1 className="font-serif text-[36px] leading-tight font-bold">Editor</h1>
        <p className="mt-1 max-w-2xl text-muted">Only texts approved here are shown on the match pages; everything else shows the version written from match data. An edit is checked by the validator again.</p>

        <section className="mt-4 grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Host token
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} onBlur={() => saveHostToken(token)} placeholder="HOST_TOKEN" className="rounded-lg border border-line bg-surface px-3 py-2 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Your name (stored with each review)
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => saveName(name)} placeholder="e.g. Aino Editor" className="rounded-lg border border-line bg-surface px-3 py-2 font-normal" />
          </label>
          {error && <p className="text-sm text-bad sm:col-span-2">{error}</p>}
        </section>

        {texts && (
          <>
            <div className="mt-5">
              <Tabs
                label="Editor sections"
                idPrefix="editor"
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: "texts", label: `Stories and summaries${pending ? ` (${pending} pending)` : ""}` },
                  { id: "phrases", label: "Question wordings" },
                  { id: "reports", label: `Reported mistakes${reports?.length ? ` (${reports.length})` : ""}` },
                ]}
              />
            </div>

            {tab === "texts" && (
              <section id="editor-panel" role="tabpanel" aria-label="Stories and summaries" className="mt-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
                  {(["demo", "all"] as const).map((f) => (
                    <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`h-9 rounded-full border px-4 text-sm font-semibold ${filter === f ? "border-ink bg-ink text-surface" : "border-line bg-surface"}`}>
                      {f === "demo" ? "Demo matches" : "All matches"}
                    </button>
                  ))}
                </div>
                {texts.length === 0 && <p className="mt-4 text-muted">No stored texts yet. Run npm run pregen:demo to write them.</p>}
                <ul className="mt-4 flex flex-col gap-4">
                  {texts.map((t) => (
                    <li key={t.id} className="rounded-card border border-line bg-surface p-4 shadow-card" data-testid="editor-text">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{t.title}</h2>
                        <Pill tone="outline">{t.lang === "en" ? "English" : "Suomi"}</Pill>
                        <Pill tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Pill>
                        {t.reports > 0 && <Pill tone="accent">{t.reports} report(s)</Pill>}
                        <a href={t.href} className="ml-auto text-sm font-semibold text-accent hover:underline">
                          Open match page
                        </a>
                      </div>
                      {t.reviewedBy && (
                        <p className="mt-1 text-xs text-muted">
                          {STATUS_LABEL[t.status]} by {t.reviewedBy}, {when(t.reviewedAt)}
                        </p>
                      )}
                      <div className="mt-3 flex flex-col gap-3">
                        {t.parts.map((p) => (
                          <PartEditor key={`${p.key}|${p.sentences.map((s) => s.text).join("|")}`} part={p} onSave={save} busy={busy} />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy || t.status === "approved" || t.parts.some((p) => p.blocked > 0)} onClick={() => void review(t, "approve")} className="h-10 rounded-lg bg-good px-4 text-sm font-semibold text-white disabled:opacity-50">
                          Approve
                        </button>
                        <button type="button" disabled={busy || t.status === "rejected"} onClick={() => void review(t, "reject")} className="h-10 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tab === "phrases" && (
              <section id="editor-panel" role="tabpanel" aria-label="Question wordings" className="mt-4 flex flex-col gap-4">
                {!phrases?.length && <p className="text-muted">The phrase bank is empty. Run npm run pregen:phrases to suggest wordings.</p>}
                {phrases?.map((g) => {
                  const open = g.items.filter((i) => i.status === "pending");
                  const ok = open.filter((i) => !i.problem).map((i) => i.id);
                  return (
                    <div key={g.callType} className="rounded-card border border-line bg-surface p-4 shadow-card">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-mono text-base font-bold">{g.callType}</h2>
                        <span className="text-sm text-muted">
                          {g.items.length} wording(s), {open.length} pending
                        </span>
                        <span className="ml-auto flex gap-2">
                          <button type="button" disabled={busy || !ok.length} onClick={() => void reviewGroup(ok, "approve")} className="h-9 rounded-lg bg-good px-3 text-sm font-semibold text-white disabled:opacity-50">
                            Approve pending ({ok.length})
                          </button>
                          <button type="button" disabled={busy || !open.length} onClick={() => void reviewGroup(open.map((i) => i.id), "reject")} className="h-9 rounded-lg border border-line px-3 text-sm font-semibold disabled:opacity-50">
                            Reject pending
                          </button>
                        </span>
                      </div>
                      <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                        {g.items.map((i) => (
                          <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                            <span className="w-7 font-semibold text-muted uppercase">{i.lang}</span>
                            <span className="flex-1">{i.template}</span>
                            {i.problem && <span className="text-xs text-bad">{i.problem}</span>}
                            <Pill tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Pill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            )}

            {tab === "reports" && (
              <section id="editor-panel" role="tabpanel" aria-label="Reported mistakes" className="mt-4">
                {!reports?.length && <p className="text-muted">No reports yet.</p>}
                <ul className="flex flex-col gap-3">
                  {reports?.map((r) => (
                    <li key={r.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                      <p className="text-sm text-muted">
                        {r.what} · {r.title} · {when(r.createdAt)}
                      </p>
                      <p className="mt-1">{r.message}</p>
                      {r.href && (
                        <a href={r.href} className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                          Open the match page
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </SiteLayout>
  );
}
