import { type FormEvent, type ReactNode, useId, useState } from "react";
import type { Comment } from "@/shared/types";
import { Icon } from "./Icon";
import { SectionCard } from "./SectionCard";
import { Initial } from "./TeamLogo";

export function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line" aria-live="polite">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-3 py-3.5 first:pt-0">
          <Initial name={c.author} size={30} />
          <div className="min-w-0">
            <p className="text-xs font-semibold">{c.author}</p>
            <p className="text-sm text-ink/80">{c.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * match discussion. with onPost the comment goes to the server (which may refuse it with a
 * reason); without it, posting adds to a local list (the design demo).
 * readOnly is the "discussion highlights" version
 */
export function LiveDiscussion({
  title = "Live discussion",
  comments,
  action,
  readOnly = false,
  id,
  onPost,
}: {
  title?: string;
  comments: Comment[];
  action?: ReactNode;
  readOnly?: boolean;
  id?: string;
  onPost?: (text: string) => Promise<{ comment: Comment } | { error: string }>;
}) {
  const [local, setLocal] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function post(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!onPost) {
      setLocal((l) => [...l, { id: `local-${l.length + 1}`, author: "You", text }]);
      setDraft("");
      return;
    }
    const res = await onPost(text);
    if ("error" in res) return setError(res.error);
    setError(null);
    setLocal((l) => (comments.some((c) => c.id === res.comment.id) ? l : [...l, res.comment]));
    setDraft("");
  }

  // a comment that arrived over realtime replaces the local copy
  const shown = [...comments, ...local.filter((c) => !comments.some((x) => x.id === c.id))];

  return (
    <SectionCard id={id} title={title} action={action}>
      <CommentList comments={shown} />
      {error && (
        <p role="alert" className="mt-1 text-xs text-bad">
          {error}
        </p>
      )}
      {!readOnly && (
        <form
          onSubmit={post}
          className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5"
        >
          <label htmlFor={inputId} className="sr-only">
            Write a comment
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment..."
            maxLength={280}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-md p-1.5 text-muted hover:text-accent disabled:opacity-40"
            aria-label="Post comment"
          >
            <Icon name="send" className="size-4" />
          </button>
        </form>
      )}
    </SectionCard>
  );
}
