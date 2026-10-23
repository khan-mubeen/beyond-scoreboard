import type { Check } from "./types";

/**
 * todo: every number in the text (digits, "13th", "58:51", "three") must equal
 * a value of one of the cited facts. catches numbers the model typed itself
 */
export const modelTypedNumber: Check = () => null;
