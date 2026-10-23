# Gate 0: can we trust the data?

Answer these before building on real data. Until then everything runs on `shared/mock/`. Owner: stakes, with live and story checking their parts.

## Liiga API

- [ ] Do goal events have a game-clock time (seconds or mm:ss + period)? live needs this for the replay.
- [ ] Do goal events include scorer, assists and strength (powerplay, shorthanded, empty net)? They are optional in `GoalEvent` until we know.
- [ ] Does the schedule list **remaining fixtures** for the season? stakes needs them to simulate.
- [ ] Does each final game say whether it ended in **regulation, overtime or a shootout**? Points depend on it.
- [ ] Is there an **official standings** table to compare our computed table against, row by row?
- [ ] Auth, rate limits, and whether we can save responses as snapshots for an offline demo.

## Liiga rules for 2026-27

- [ ] Team count. `rules.config.ts` assumes 17.
- [ ] Zones: which positions go straight to the quarterfinals, which play the wildcard round, which are safe.
- [ ] Relegation format: how many teams, direct or a playoff against Mestis?
- [ ] Tiebreakers, in order. `rules.config.ts` has a placeholder list.
- [ ] Points: 3 for a regulation win, 2 for an OT or shootout win, 1 for an OT or shootout loss?

## Done when

- [ ] `npm run snapshot` saves real data into `features/stakes/snapshots/`.
- [ ] Our computed standings match the official table exactly.
- [ ] `rules.config.ts` is updated and the "verify" comment is resolved.
