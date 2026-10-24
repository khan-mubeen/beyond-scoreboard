import type { Check } from "./types";

// injuries, health, contracts, transfers, discipline and private life are not in the match data
const OFF_ICE = [
  /\binjur\w*/i,
  /\bhurt\b/i,
  /\bconcuss\w*/i,
  /\b(ill|illness|sick|surgery|hospital\w*)\b/i,
  /\bsuspen\w*/i,
  /\b(contract|transfer\w*|signed|signing|traded|fired|sacked|arrest\w*|police|divorce|personal)\b/i,
  /\bloukkaan\w*|\bloukkaantu\w*|\bsairas\w*|\bvamma\w*|\bsopimu\w*|\bsiirto\w*|\berotet\w*|\bpidätet\w*/i,
];

export const offIceClaim: Check = (sentence) => {
  for (const re of OFF_ICE) {
    const m = re.exec(sentence.text);
    if (m) return { errorType: "off_ice_claim", reason: `"${m[0]}" is an off-ice claim the match data can't back` };
  }
  return null;
};
