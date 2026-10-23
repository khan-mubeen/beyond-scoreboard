import { useState } from "react";
import { DEMO_GAME_ID, DEMO_TEAM_ID, mockGames, mockRoomStates, mockStakesCard, mockTeams } from "@/shared/mock";
import { Button, Card } from "@/shared/ui";
import { ProjectedTable } from "../components/ProjectedTable";
import { SeasonStrip } from "../components/SeasonStrip";
import { StakesMeter } from "../components/StakesMeter";

// one entry per score the demo game passes through, to watch the table re-sort
const scoreSteps = mockRoomStates.filter(
  (s, i, all) =>
    i === 0 ||
    `${s.score.home}-${s.score.away}` !== `${all[i - 1].score.home}-${all[i - 1].score.away}` ||
    s.phase === "final",
);

export function DevStakes() {
  const [teamId, setTeamId] = useState(DEMO_TEAM_ID);
  const [gameId, setGameId] = useState(DEMO_GAME_ID);
  const [step, setStep] = useState(0);
  const state = scoreSteps[step];
  const teamGames = mockGames.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  const card = step === 0 ? mockStakesCard : state.stakes;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">/dev/stakes</h1>

      <Card className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Team
          <select className="rounded-md bg-surface-2 p-2" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {mockTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Game
          <select className="rounded-md bg-surface-2 p-2" value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {teamGames.map((g) => (
              <option key={g.id} value={g.id}>
                {g.date.slice(0, 10)} {g.homeTeamId} – {g.awayTeamId}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ◀
          </Button>
          <span className="w-40 text-center text-sm tabular-nums">
            demo game {state.score.home}–{state.score.away} ({state.phase})
          </span>
          <Button variant="ghost" disabled={step === scoreSteps.length - 1} onClick={() => setStep(step + 1)}>
            ▶
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            {card.teamId === teamId ? (
              <StakesMeter card={card} />
            ) : (
              <p className="text-sm text-muted">The mock has a stakes card for {DEMO_TEAM_ID} only.</p>
            )}
          </Card>
          <Card>
            <p className="mb-2 text-sm text-muted">Season</p>
            <SeasonStrip teamId={teamId} games={mockGames} currentGameId={gameId} />
          </Card>
        </div>
        <Card>
          <p className="mb-2 text-sm text-muted">Projected table</p>
          <ProjectedTable rows={state.projectedTable} highlightTeamIds={[teamId]} />
        </Card>
      </div>
    </main>
  );
}
