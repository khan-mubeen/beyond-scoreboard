# Judge Q&A

Short answers to the questions we expect.

**Isn't this gambling?**
No. Calls are for points only, with no prizes, no money and no odds formats. User-facing text says "chance". `shared/guardrails.ts` checks the copy.

**How do you know the AI didn't make things up?**
The model never types numbers. It writes placeholders that are filled from a fact ledger. A deterministic validator blocks any sentence it can't trace to a fact, and blocked sentences never ship.

**Where do the chances come from?**
A season simulation over the remaining fixtures, using official Liiga standings and rules. (Only claim this once the gate 0 check, our table against the official one, has passed.)

**Does it work live, not just on replays?**
The replay uses the same interface as a live feed would: game time in, state out. Swapping the source is the next step.

**What would Kaleva need to run it?**
One Node server per event, the Liiga data feed, and an LLM endpoint for pre-generating content. No database is needed for a single event.
