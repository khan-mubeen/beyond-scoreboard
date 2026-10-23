// talks to an openai-compatible endpoint (LLM_BASE_URL, LLM_API_KEY, LLM_WRITER_MODEL).
// only the pregen script calls this. the running app reads features/story/cache/ instead

export async function complete(_prompt: string): Promise<string> {
  if (!process.env.LLM_BASE_URL) throw new Error("LLM_BASE_URL is not set");
  // todo: POST {LLM_BASE_URL}/chat/completions with model LLM_WRITER_MODEL, return the text
  throw new Error("llm client not implemented yet");
}
