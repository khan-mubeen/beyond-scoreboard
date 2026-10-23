// stakes server api. server only: never import this from browser code (lint enforces it).
// stubs: snapshot first, then shared/mock. todo: run the engine on real data
import { mockFactInputs, mockRoomStates, mockStakesCard } from "@/shared/mock";
import type { FactInputs, StakesCard } from "@/shared/types";
import { readSnapshot } from "./data/snapshot";

export async function getStakes(teamId: string, gameId: string): Promise<StakesCard> {
  const card = readSnapshot<StakesCard>(`stakes-${teamId}-${gameId}`) ?? mockStakesCard;
  return { ...card, teamId, gameId };
}

/** a stakes card per score state, keyed "home-away" like "2-1" */
export async function oddsByScoreState(gameId: string): Promise<Record<string, StakesCard>> {
  const fromSnapshot = readSnapshot<Record<string, StakesCard>>(`score-states-${gameId}`);
  if (fromSnapshot) return fromSnapshot;
  const out: Record<string, StakesCard> = {};
  for (const s of mockRoomStates) {
    const key = `${s.score.home}-${s.score.away}`;
    if (s.phase !== "final") out[key] ??= { ...s.stakes, gameId };
  }
  return out;
}

export async function getFactInputs(teamId: string, gameId: string): Promise<FactInputs> {
  const inputs = readSnapshot<FactInputs>(`fact-inputs-${teamId}-${gameId}`) ?? mockFactInputs;
  return { ...inputs, teamId, gameId };
}
