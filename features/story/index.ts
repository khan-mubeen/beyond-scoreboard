// story public api, browser-safe. other features import only from here
// (or from @/features/story/server inside their own server/ folder)
export { FactChip } from "./components/FactChip";
export { StorySection } from "./components/StorySection";
export { VerificationPanel } from "./components/VerificationPanel";
export { VerifiedBadge } from "./components/VerifiedBadge";
export { contentId, parseContentId } from "./content-id";
export { buildLedger, FACT_LABELS } from "./ledger/build-ledger";
export { verify } from "./validator/validator";
// finnish case forms of team names ("Kärppien"), for any finnish wording
export { teamCase } from "./i18n/fi-team-names";
export type { Content, Fact, FactInputs, VerificationReport } from "@/shared/types";
