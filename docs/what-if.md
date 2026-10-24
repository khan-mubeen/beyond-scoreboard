# What if?

A panel at the bottom of the Season stakes card on a match page. The fan sets this match's result and up to three other unplayed games on the same date, and sees how each team's playoff chance (and top-4 / relegation chance) changes. Games left unset play out in the simulation as usual.

## Where it shows

- On a match page while the match is not decided as of the league clock (`leagueNow`): upcoming, lobby and live. A finished match has `seasonStakes.whatIf: null`.
- In demo mode the league clock is the pinned `demoNow`, so the demo date's games (the rotation matches and the others that night) can be set, and anything finished before it cannot.

## API

`GET /api/site/matches/:id` → `seasonStakes.whatIf`:

```ts
{ games: { gameId, home: TeamRef, away: TeamRef, when: "Tue 20 Oct · 18:30" }[]; max: 4 }
```

The match itself comes first, then the other unplayed games on its Helsinki date, by start time.

`POST /api/site/whatif`

```json
{ "matchId": "2027-2701400", "overrides": [{ "gameId": "2027-2701400", "outcome": "regulationWin" }, { "gameId": "2027-2701379", "outcome": "overtimeLoss" }] }
```

- `outcome` is from the **home team's** view: `regulationWin | overtimeWin | overtimeLoss | regulationLoss` (the same `GameOutcome` the stakes engine uses).
- zod: `matchId`/`gameId` look like `2027-2701400`; at most 4 overrides. The server also rejects (400) a match or game that is already played as of `leagueNow` ("already played"), an unknown id, and the same game twice.
- Rate limit: 30 requests a minute per fan (the anonymous cookie id, not the IP, so a venue's phones on one network don't share a limit) → 429.
- Response (`WhatIfResult`): `{ matchId, overrides (sorted), teams: [{ team, before: {playoffs, top4, relegation}, after: {...} }], asOf, source }`. Percent, rounded. The match's two teams come first, then the other set games' teams. No betting fields (the router's `findGamblingFields` check runs on it like every response).

## How it is worked out

`simulateSeason` (features/stakes/engine/simulation.ts) takes `fixed: Record<gameId, GameOutcome>`. A fixed game still draws its random numbers and then takes the set result, so every other game in every simulated season plays out exactly as it would without the override. Two consequences, both tested:

- Setting this match to "win" gives exactly the stakes card's "What this game is worth → Win" number: that number comes from the same seeded seasons with the game forced (`features/stakes/tests/engine.test.ts`, `features/site/tests/server.test.ts`).
- For a team, win ≥ overtime win ≥ overtime loss ≥ loss, also with other games set.

`forecastWhatIf(ctx, fixed)` (features/stakes/server/forecast.ts) runs it on the season as it stands at the league clock (`worldAt` on the masked schedule) with `SIM_RUNS` seasons (10,000), cached per standings version + the canonical (sorted) overrides. `features/site/server/whatif.ts` adds the validation, the before/after per team and a second cache keyed by `asOf|matchId|sorted overrides`, so the same picks in any order are one entry.

## Speed

On the dev machine (tsx, 10,000 seasons): the simulation itself about 0.3 s; the whole request about 0.8–0.9 s cold and about 0.15 s cached (measured against `npm run dev`). The panel waits 250 ms after the last change before it asks, so changing several picks sends one request.

## Not done (ideas)

- Show the projected table under the set results (the positions are already in the forecast).
- Let the fan pick a result for any game in the next round, not only the match's date.
- Share a what-if as a link.
