# Liiga `goalTypes` codes

`GoalEventDTO.goalTypes` is a list of short Finnish codes. The OpenAPI spec doesn't define them, so every label below comes from the recorded games in `features/liiga/snapshots/` (12 finished games, recorded 2026-10-24). Labels live in `features/liiga/goal-types.ts`.

| code  | meaning (Finnish)                          | label shown       | evidence in the recordings                                                                                                                               |
| ----- | ------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YV`  | ylivoima                                   | power play        | 10 goals, each while the other team had a penalty running                                                                                               |
| `YV2` | ylivoima 5–3                               | 5-on-3 power play | 1 goal, two opponents in the box                                                                                                                         |
| `AV`  | alivoima                                   | shorthanded       | 4 goals, each by the team with a penalty running                                                                                                         |
| `TM`  | tyhjä maali                                | empty net         | 4 goals, all in the last 2½ minutes by the leading team                                                                                                  |
| `IM`  | ilman maalivahtia                          | extra attacker    | 3 goals, all in the last minute by the trailing team (goalie pulled)                                                                                     |
| `RL`  | rangaistuslaukaus                          | penalty shot      | 1 goal (2701407, 12:50): the other team got a 0-minute holding penalty at the same second                                                                |
| `VL`  | voittolaukaus                              | shootout goal     | 3 events at game time 3900 (period 5) in the three shootout games, `winningGoal: true`, the score fields not updated                                     |
| `VT0` | video review, goal disallowed              | (not a goal)      | 2 events (2701400 13:07, 2701405 27:18): the score fields don't move, there is no clip, and the official final score only adds up without them |

## How the code uses them

- `VT0` events are dropped in `normalizeGame` (`DISALLOWED_GOAL`), so the replay, the event list, the score and the story never count a disallowed goal. The replay test checks that the goals of every recorded game add up to the official score.
- A shootout's `VL` goal counts in the final score, as the API's team totals do (a 2-1 shootout win is 1-1 plus the winning shot).
- Power play goals (`YV`, `YV2`) feed the power play stat and the "Will {team} score on this power play?" call.
- A code not in the table is shown as-is, and the server logs `liiga: unconfirmed goalTypes code "XX"` once. `getGame` also warns when a game's goal events don't add up to its score, which is how a new "doesn't count" code would show up.

## Adding a code

1. Find the events in a snapshot (`npm run snapshot` records new games) and check them against the score fields, penalties and game time.
2. Add the label to `GOAL_TYPE_LABELS` and a row here with the evidence.
