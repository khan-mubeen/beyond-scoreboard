# Liiga API → Kaleva Sports

Where every number on the pages comes from. The spec is [liiga-openapi.json](liiga-openapi.json); the fields we read are typed in `features/liiga/dto.ts` and turned into our model by `features/liiga/normalize.ts`.

## Access

- Server only: `features/liiga/server/client.ts`, header `x-api-key: LIIGA_API_KEY`. The key never reaches the browser (the bundle test checks this).
- `LIIGA_API_URL` is the api root; a trailing `/api/v1` is stripped, since the spec paths carry it. The startup ping tries the usual prefixes and logs the one that answers.
- 8 s timeout, one retry, one request in flight per path, and a TTL cache (below).
- `stripGambling` runs on every response **before** it is cached, recorded or served: `gamblingEvent` (odds and a bookmaker link) and any key matching `odds`/`gambling` is dropped. The site api and the realtime publisher refuse to send a payload that still has one.
- Snapshot fallback: with `USE_SNAPSHOT=true`, or when a call fails, responses come from `features/liiga/snapshots/` (`npm run snapshot` records them). Every api response then says `source: "snapshot"`, and "now" is the recording time in `manifest.json`, so "today" and "live" stay consistent.

## Ids

- Team: `"495643563:kärpät"`, the internal id and a slug. The internal id is what the shot map uses (`shootingTeamId`).
- Match: `{season}-{gameId}`, e.g. `2027-2701404`. `matchIdOf` / `parseMatchId` in `features/liiga/model.ts`.

## Endpoints

| path                                          | cache                                              | normaliser               | used for                                                  |
| --------------------------------------------- | -------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| `/api/v1/games/web/tournament`                | 10 min                                             | `getSeason`              | the current season                                        |
| `/api/v1/games?date=&serie=RUNKOSARJA`        | 10 s with a live game, 30 s today, 24 h past, 10 min future | `normalizeGame`   | home page (today), finding live games for the engine      |
| `/api/v1/games/schedule?season=&serie=`       | 10 min                                             | `normalizeFixture`       | the simulation (results, remaining games, xG), upcoming, recent |
| `/api/v1/standings/RUNKOSARJA?season=&isLive=`| 10 s                                               | `normalizeStandings`     | the table, the zone-line check at startup                 |
| `/api/v1/teams?serie=&season=`                | 24 h                                               | `normalizeTeams`         | logos and short names                                     |
| `/api/v1/games/{season}/{gameId}`             | 10 s live, 30 s scheduled, 24 h final              | `normalizeGame`, `playerNames` | match page, live engine, demo replay              |
| `/api/v1/games/{season}/{gameId}/stats`       | same                                               | `normalizeStats`         | the statistics card                                       |
| `/api/v1/shotmap/{season}/{gameId}`           | same                                               | `normalizeStats`         | blocked shots                                             |
| `/api/v1/games/{season}/{gameId}/players`     | same                                               | `normalizeLineups`       | the lineups tab                                           |
| `/api/v1/games/{season}/{gameId}/pastAndFutureGames` | 10 min                                      | `normalizePastAndFuture` | "Next up" on a finished match                             |

## Fields

### Match page and live state

| shown                     | from                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| status                    | `started` / `ended` → `scheduled \| live \| final`                                                      |
| decided in                | `finishedType`: `ENDED_DURING_REGULAR_GAME_TIME` regulation, `…EXTENDED_GAME_TIME` overtime, `…WINNING_SHOT_COMPETITION` shootout |
| score                     | `homeTeam.goals`, `awayTeam.goals` (a replay counts its goals so far)                                  |
| period scores             | `periods[].homeTeamGoals / awayTeamGoals`, extra periods only when decisive                            |
| clock                     | `gameTime` (seconds) and `currentPeriod`                                                                |
| goals                     | `goalEvents`: `scorerPlayer`, `assistantPlayers`, `goalTypes` ([codes](goal-types.md)), `homeTeamScore` / `awayTeamScore`, `videoClipUrl`, `videoThumbnailUrl`. `VT0` (disallowed) is dropped |
| penalties                 | `penaltyEvents`: `penaltyMinutes`, `penaltyBegintime` / `penaltyEndtime`, `penaltyFaultName`, `playerId` → name from `/players` |
| venue, spectators         | `iceRink.name`, `spectators`                                                                            |
| video                     | `videoURL`, or the latest goal's `videoClipUrl` (HLS `.m3u8`)                                           |
| shots on goal             | `/stats` `homeTeam[].shots`, summed over periods                                                        |
| blocked shots             | `/shotmap` `PLAYER_BLOCKED` events, credited to the team that blocked (the other side of `shootingTeamId`) |
| faceoffs                  | `/stats` `faceOffWins`, as a share in %                                                                 |
| penalty minutes           | `/stats` `penaltyMinutes`                                                                               |
| power play                | the game's `powerplayGoals` / `powerplayInstances` integers; `/stats` `powerPlayInstances` as a fallback |
| game momentum             | `/stats` `puckStats` puck-control duration, as a share in % (also per period)                           |
| lineups                   | `/players` `homeTeamPlayers` / `awayTeamPlayers`: name, `jersey`, `role`, `line`                        |
| next up                   | `/pastAndFutureGames` `futureGamesHomeTeam` / `futureGamesAwayTeam`, else the schedule                  |

During a demo replay the stats card and the game video stay hidden until the end: the feed only has the final totals, which would give the result away. Penalties still running show their planned end (`begin + minutes`), because the real end may be a later goal.

### Table and stakes

| shown                        | from                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| table (home, match pages)    | standings `liveRanking`, `livePoints`, `liveGames`, `liveGoals` / `liveGoalsAgainst`       |
| zone lines 4 / 12 / 14       | `rules.config.ts`, checked against standings `playoffsLines` at startup                   |
| simulation inputs            | schedule `homeTeamGoals` / `awayTeamGoals`, `finishedType`, `expectedHomeTeamGoals` / `expectedAwayTeamGoals` (xG) |
| our table == the official one| `features/stakes/tests/engine.test.ts` rebuilds the standings from the schedule, team by team |

## Computed by us, not in the api

Playoff and relegation chance, what a game is worth (win / OT win / OT loss / loss), the chance timeline after each goal, "if it ends now", the projected table, goal of the game (the goal that moved the chance most), and the call it! questions and results. All come from `features/stakes` and `features/live` on the data above, and the texts only use numbers from the fact ledger.

## Not from the api (config or placeholders)

| field                                           | why                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| hero, nav, "coming soon" sports, rewards offers, subscriptions, achievements | product copy: `features/site/server/config.ts`, `rewards.config.json` |
| featured-match background, video posters, fan avatars | no images in the feed; `/placeholders/*.svg`                  |
| a team logo the api doesn't have                | placeholder by slug                                                  |
| fans, points, comments, rooms, reminders        | ours, in the database (`supabase/migrations/`)                       |
| guest profile (Mikko Korhonen)                  | `npm run db:seed` demo fan, shown to guests unless `DEMO_PROFILE=false` |
