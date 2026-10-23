# story

Words fans can trust: the fact ledger, the LLM writer, the validator, and the components that show where every number came from.

## How it works

1. `ledger/build-ledger.ts` turns stakes' `FactInputs` into numbered facts (`F1`, `F2`, ...).
2. The writer (`writer/`) asks the LLM for sentences with placeholders like `{F5}` or `{F1:ord}`. `fill.ts` swaps in the values, so the model never types a number.
3. `validator/verify()` checks every sentence, with one file per error type in `validator/checks/`. Blocked sentences never ship. There is no LLM reviewer.
4. `scripts/pregenerate-content.ts` writes the result to `cache/`. The app only reads the cache, falling back to `templates/fallback.ts`.

## Public API

Browser-safe, `@/features/story`:

- `buildLedger(inputs)`, `verify(content, ledger)`, `contentId`, `parseContentId`, `FACT_LABELS`
- `FactChip`, `VerifiedBadge`, `StorySection`, `VerificationPanel`

Server only, `@/features/story/server`:

- `generateBrief(teamId, gameId, language)`, `generateStory(teamId, gameId, language)`, `getVerification(contentId)`

Route handlers (`server/routes/`): `content.ts` (brief and story) and `verification.ts`.

## Test alone

- `npm run dev`, then open `/dev/story`: edit the ledger, load the brief (template) or the story (cache), and re-check. The cached story shows one blocked claim.
- `npm test -- features/story`
- `npm run pregen` with `LLM_ENABLED=true` and `LLM_BASE_URL` set (the client is still a stub).

## Done when

- [ ] the validator catches all five planted error types (only `uncited_sentence` is written, the rest are `it.todo`)
- [ ] the fallback works with the LLM off
- [ ] content loads from the cache instantly

## Open question

Post-game facts (final score, winning goal time) are in the mock ledger as `F13`-`F18`, but `FactInputs` has no game result yet. Decide whether stakes or live provides them.
