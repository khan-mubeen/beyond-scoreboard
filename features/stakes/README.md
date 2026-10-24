# stakes

What a game means for each team: standings, the season simulation, the stakes visuals and the big screen. Liiga data comes from `@/features/liiga/server`.

## Public API

Browser-safe, `@/features/stakes`:

- `StakesMeter`, `SeasonStrip`, `ProjectedTable`
- `zoneForRank`, `zoneLabel`, `zoneChancesFromPositions`, `playoffChance`

Server only, `@/features/stakes/server`:

- season forecast: `getSeasonContext()`, `forecastNow(ctx, targets)`, `forecastBefore(ctx, game)`, `checkRulesAgainstApi()`
- engine helpers: `worthFor`, `ifEndsNow`, `chanceTimeline`, `goalOfTheGame`, `leverage`, `tableIfEndsNow`, `rankOf`
- watch party (mock data): `getStakes(teamId, gameId)`, `oddsByScoreState(gameId)`, `getFactInputs(teamId, gameId)`

## How the forecast works

- Strength per team from goals for and against, shrunk towards the league average (k = 10 games) and blended 50/50 with the schedule's xG.
- Each remaining game: Poisson goals with home advantage; a tie goes to overtime, won by the home team at the observed rate.
- `SIM_RUNS` (10,000) seeded seasons, so the same data gives the same numbers. A game's four outcomes are forced inside the same simulated seasons (only the two teams re-ranked), which makes "what this game is worth" exact differences, not noise. About 0.25 s for a full forecast.
- A finished game is judged as the season stood before it (`forecastBefore`), which is also what a demo replay shows.
- Zone lines (4 / 12 / 14) are in `engine/rules.config.ts` and checked against the api's `playoffsLines` at startup.

## Layout

- `engine/`: pure. `rules.config.ts`, `zones.ts`, `standings.ts` (points, table, projected table), `strength.ts`, `simulation.ts`, `stakes.ts`, `world.ts`
- `components/`: the three visuals, animated with `motion`
- `screens/`: `BigScreen.tsx` (lobby with QR, live, final), `DevStakes.tsx`
- `server/`: `index.ts`, `forecast.ts` (cached per world)

## Test alone

- `npm test -- features/stakes`: the table rebuilt from the schedule equals the official standings team by team, plus the simulation's distributions and forced outcomes.
- `npm run dev`, then open `/dev/stakes` (mock data).
