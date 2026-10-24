# story

Words fans can trust: the fact ledger, templates, the LLM writer, the validator, and the components that show where every number came from.

## How it works

1. `ledger/match-ledger.ts` turns a match's facts (score, goals, chance before and after, table position) into numbered facts (`F1`, `F2`, ...). `ledger/build-ledger.ts` does the same for the watch party's `FactInputs`.
2. The LLM writer (`writer/llm-writer.ts`) gets only the ledger and returns sentences with placeholders like `{F5}`. `fill()` swaps in the values, so the model never types a number.
3. `validator/verify()` checks every sentence, one file per error type in `validator/checks/`: uncited sentence, a typed number, an unknown name, a quote, an off-ice claim, betting language. Blocked sentences never ship. There is no LLM reviewer.
4. `npm run pregen -- --match <id>` writes stories that pass into `content_cache`. The site reads the cache, re-verifies it against the current ledger, and otherwise uses the templates (`templates/match.ts`), which pass the same validator.
5. `npm run pregen:phrases` asks for other wordings of each call it! question and stores them in `phrase_bank`, approved only when they pass `phraseProblem` (live) and the guardrails.

The LLM client (`llm/client.ts`) is openai-compatible, off by default (`LLM_ENABLED=false`), and returns null on any error or timeout, so nothing waits on it.

## Public API

Browser-safe, `@/features/story`:

- `buildLedger(inputs)`, `verify(content, ledger)`, `contentId`, `parseContentId`, `FACT_LABELS`
- `FactChip`, `VerifiedBadge`, `StorySection`, `VerificationPanel`

Server only, `@/features/story/server`:

- `matchStory(facts)`, `whatItMeansText(facts)`, `buildMatchLedger`, `contentKey`
- watch party: `generateBrief`, `generateStory`, `getVerification`

Route handlers (`server/routes/`): `content.ts` (brief and story) and `verification.ts`.

## Test alone

- `npm test -- features/story`: each error type is caught, and the templates pass.
- `npm run pregen -- --match 2027-2701404` with `LLM_ENABLED=true` and `LLM_BASE_URL` set.
- `npm run dev`, then open `/dev/story` (the watch party's ledger and verification panel).
