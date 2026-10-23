# Contributing

Three people, three folders, 36 hours. These rules keep us from stepping on each other.

- **Work only in your own feature folder** (`features/stakes`, `features/live` or `features/story`). Reach other features only through their `index.ts` or `server/index.ts`. Lint will stop you otherwise.
- **Announce any change to `shared/` first** (types, mock data, ui, tokens, guardrails). Everyone builds against it.
- **Merge to `main` at least every 2 hours.** Small merges, fewer surprises.
- **`main` must always build.** Before you merge, run `npm run lint && npm run typecheck && npm test && npm run build`.
- **Branch names:** `stakes/...`, `live/...`, `story/...`, e.g. `live/answer-scoring`.
- Test alone on your `/dev/<part>` page with mock data before wiring into the rooms.
- User-facing text says "chance", never "odds". No prizes, no betting words. `shared/guardrails.ts` checks copy.
- Never commit `.env`. Add new variables to `.env.example`.
