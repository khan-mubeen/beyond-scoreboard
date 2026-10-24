// openai-compatible chat completions (LLM_ENABLED, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL).
// the model only ever sees the fact ledger and returns json; our code fills the numbers and
// validates. live features call it with a short timeout and fall back to templates

export interface ChatOptions {
  system: string;
  user: string;
  /** live features: 2500. offline pregeneration can wait longer */
  timeoutMs?: number;
  temperature?: number;
  /** reasoning models think before the json: 1500 fits a few sentences, a list needs more */
  maxTokens?: number;
}

export const llmEnabled = () => process.env.LLM_ENABLED === "true" && !!process.env.LLM_BASE_URL;

/** the first json object in a reply (models wrap json in fences or prose) */
export function parseJsonReply(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** a parsed json reply, or null on timeout, error, or when the llm is off */
export async function chatJson(opts: ChatOptions): Promise<unknown> {
  if (!llmEnabled()) return null;
  const base = process.env.LLM_BASE_URL!.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY ?? ""}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? process.env.LLM_WRITER_MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1500,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    return parseJsonReply(body.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}
