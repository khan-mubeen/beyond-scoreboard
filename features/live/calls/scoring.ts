import type { Answer, CallType, LeaderboardEntry, Player } from "@/shared/types";

/** points only. no prizes */
export const CALL_POINTS: Record<CallType, number> = {
  next_goal: 150,
  goal_in_5: 100,
  regulation_result: 200,
  overtime: 100,
};

export interface ResolvedCall {
  callId: string;
  type: CallType;
  correctOptionId: string;
}

export function scoreFor(playerId: string, answers: Answer[], resolved: ResolvedCall[]): number {
  return resolved.reduce((sum, call) => {
    const a = answers.find((x) => x.playerId === playerId && x.callId === call.callId);
    return a?.optionId === call.correctOptionId ? sum + CALL_POINTS[call.type] : sum;
  }, 0);
}

/** highest score first, equal scores share a rank */
export function buildLeaderboard(
  players: Pick<Player, "id" | "nickname">[],
  answers: Answer[],
  resolved: ResolvedCall[],
): LeaderboardEntry[] {
  const rows = players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: scoreFor(p.id, answers, resolved) }))
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  return rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o.score > r.score).length }));
}
