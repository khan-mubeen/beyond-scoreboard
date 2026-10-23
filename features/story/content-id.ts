import type { ContentKind, Language } from "@/shared/types";

export interface ContentMeta {
  kind: ContentKind;
  teamId: string;
  gameId: string;
  language: Language;
}

/** "story.karpat.game-1042.en", also the cache file name */
export function contentId(m: ContentMeta): string {
  return `${m.kind}.${m.teamId}.${m.gameId}.${m.language}`;
}

export function parseContentId(id: string): ContentMeta | null {
  const [kind, teamId, gameId, language, ...rest] = id.split(".");
  if (rest.length || !teamId || !gameId) return null;
  if (kind !== "brief" && kind !== "story") return null;
  if (language !== "en" && language !== "fi") return null;
  return { kind, teamId, gameId, language };
}
