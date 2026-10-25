import { useState } from "react";
import type { Language, NotificationPrefs } from "@/shared/types";
import { SectionCard } from "../components/SectionCard";
import { SitePage } from "../components/SitePage";
import { Avatar } from "../components/TeamLogo";
import { PageSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { resetProfile, saveSettings, useMe } from "../data";
import { NAMES } from "@/shared/copy/names";
import type { MeResponse } from "@/shared/types";

/** change the nickname in place; used on settings and the profile */
export function NicknameForm({ current }: { current: string | null }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? current ?? "";
  const changed = value.trim().length > 0 && value.trim() !== (current ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changed) return;
    setBusy(true);
    const res = await saveSettings({ nickname: value.trim() });
    setBusy(false);
    if (!res.ok) return toast(res.error, { tone: "bad" });
    setDraft(null);
    toast("Nickname saved");
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
        Nickname
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={24}
          placeholder="Pick a nickname"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-base font-normal focus:border-accent focus:outline-none"
        />
      </label>
      <button type="submit" disabled={!changed || busy} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fi", label: "Suomi" },
];

const PREFS: { id: keyof NotificationPrefs; label: string; hint: string }[] = [
  { id: "callResults", label: "Call results", hint: "When a call you answered is decided" },
  { id: "favoriteReminders", label: "My teams are playing", hint: "A day before, and when the game starts" },
  { id: "favoriteResults", label: "My teams' results", hint: "The final score and what it meant in the table" },
];

function Toggle({ on, label, hint, onChange }: { on: boolean; label: string; hint: string; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? "bg-accent" : "bg-surface-2"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}

/** the aside: who you are on the boards, and your friend code */
function AccountSummary({ me }: { me: MeResponse }) {
  return (
    <SectionCard title="Your account">
      <div className="flex items-center gap-3">
        <Avatar src={me.user.avatar} name={me.user.name} size={52} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold" data-testid="account-name">
            {me.nickname ?? me.user.name}
          </p>
          <p className="text-sm text-muted">{me.nickname ? "How you show on boards and in the party" : "Pick a nickname to show on the boards"}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-surface-2 p-3">
        <p className="text-xs text-muted">Friend code</p>
        {me.friendCode ? (
          <p className="font-mono text-xl font-bold tracking-[0.25em]" data-testid="account-friend-code">
            {me.friendCode}
          </p>
        ) : (
          <p className="text-sm text-muted">Appears once you pick a nickname.</p>
        )}
      </div>
      <a href="/profile" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
        Your profile →
      </a>
    </SectionCard>
  );
}

/** /settings: nickname, language (calls and the audio summary), notifications, reset */
export function SettingsPage() {
  const me = useMe().data;
  const [confirming, setConfirming] = useState(false);

  async function save(patch: Parameters<typeof saveSettings>[0], done: string) {
    const res = await saveSettings(patch);
    toast(res.ok ? done : res.error, res.ok ? {} : { tone: "bad" });
  }

  return (
    <SitePage
      activeLinkId="settings"
      crumbs={[{ label: "Sports", href: "/sports" }, { label: "Settings" }]}
      title="Settings"
      aside={me ? <AccountSummary me={me} /> : undefined}
      asideLabel="Your account"
    >
      {!me ? (
        <PageSkeleton cards={3} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionCard title="Your name">
              <NicknameForm current={me.nickname} />
              <p className="mt-2 text-xs text-muted">Shown on leaderboards and in the Watch Party.</p>
            </SectionCard>

            <SectionCard title="Language">
              <div role="radiogroup" aria-label="Language" className="inline-flex rounded-lg border border-line p-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={me.language === l.id}
                    onClick={() => me.language !== l.id && void save({ language: l.id }, l.id === "fi" ? "Kieli vaihdettu" : "Language changed")}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold ${me.language === l.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Used for {NAMES.call} questions and the audio summary.</p>
            </SectionCard>

          </div>
          <div className="flex flex-col gap-4">
            <SectionCard title="Notifications">
              <div className="flex flex-col divide-y divide-line">
                {PREFS.map((p) => (
                  <Toggle
                    key={p.id}
                    on={me.notificationPrefs[p.id]}
                    label={p.label}
                    hint={p.hint}
                    onChange={(on) => void save({ notificationPrefs: { ...me.notificationPrefs, [p.id]: on } }, "Saved")}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Demo profile">
              <p className="text-sm text-muted">Start again as a new fan: your name, points, calls and teams are removed.</p>
              {confirming ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void resetProfile()} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">
                    Yes, reset my profile
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-line px-4 text-sm font-semibold">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="mt-3 h-10 rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-2">
                  Reset my demo profile
                </button>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </SitePage>
  );
}
