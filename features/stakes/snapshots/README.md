# snapshots

Real Liiga API responses saved by `npm run snapshot` (gate 0), so the demo runs offline.

The stakes server looks for these names and falls back to `shared/mock/` when one is missing:

- `stakes-<teamId>-<gameId>.json` is a `StakesCard`
- `score-states-<gameId>.json` is `Record<"home-away", StakesCard>`
- `fact-inputs-<teamId>-<gameId>.json` is `FactInputs`
