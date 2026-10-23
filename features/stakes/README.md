# stakes

What a game means for each team: Liiga data, standings, the season simulation, the stakes visuals and the big screen.

## Public API

Browser-safe, `@/features/stakes`:

- `StakesMeter`, `SeasonStrip`, `ProjectedTable`
- `zoneForRank`, `zoneLabel`, `zoneChancesFromPositions`, `playoffChance`

Server only, `@/features/stakes/server`:

- `getStakes(teamId, gameId)`, `oddsByScoreState(gameId)`, `getFactInputs(teamId, gameId)`

All three read `snapshots/` first (when `USE_SNAPSHOT` is not `false`), then fall back to `shared/mock/`.

## Layout

- `engine/`: pure. `rules.config.ts`, `zones.ts`, `standings.ts` (points, table, projected table), `strength.ts` and `simulation.ts` (stubs)
- `components/`: the three visuals, animated with `motion`
- `screens/`: `BigScreen.tsx` (lobby with QR, live, final), `DevStakes.tsx`
- `server/`: `index.ts` plus `data/` (snapshot reads, liiga client stub)
- `snapshots/`: real API responses, filled at gate 0 by `scripts/fetch-snapshot.ts`

## Test alone

- `npm run dev`, then open `/dev/stakes`: pick a team and game, step the demo score and watch the table re-sort.
- `npm test -- features/stakes`

## Done when

- [ ] standings match the official table exactly
- [ ] every game gives 2 or 3 points
- [ ] the meter and table animate on mock data
