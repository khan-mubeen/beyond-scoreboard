// typed loaders for the mock json. browser-safe, no fs.
// real liiga team names, fake numbers. see docs/contract.md
import type { Content, Fact, FactInputs, Game, RoomState, StakesCard, Team, VerificationReport } from "@/shared/types";
import contentJson from "./content.json";
import factInputsJson from "./fact-inputs.json";
import gamesJson from "./games.json";
import roomStatesJson from "./room-states.json";
import stakesCardJson from "./stakes-card.json";
import teamsJson from "./teams.json";

export const mockTeams = teamsJson as Team[];
/** only the two demo teams (kärpät, tappara) have games */
export const mockGames = gamesJson as Game[];
export const mockStakesCard = stakesCardJson as StakesCard;
export const mockFactInputs = factInputsJson as FactInputs;
/** a full replay of the demo game, in order */
export const mockRoomStates = roomStatesJson as unknown as RoomState[];
export const mockContent = contentJson as unknown as {
  story: Content;
  ledger: Fact[];
  report: VerificationReport;
};

export const DEMO_GAME_ID = "game-1042";
export const DEMO_TEAM_ID = "karpat";

export function teamById(id: string): Team {
  return (
    mockTeams.find((t) => t.id === id) ?? {
      id,
      name: id,
      shortName: id.slice(0, 3).toUpperCase(),
      city: "",
      colours: { primary: "#888888", secondary: "#ffffff" },
    }
  );
}
