// english a/an by sound, for generated text: "an 85% chance", "an 11th", "an HIFK goal",
// "a 64% chance", "a one-goal game", "an hour". pure, browser-safe

/** acronyms are read letter by letter: these letters' names start with a vowel sound */
const VOWEL_LETTERS = new Set(["A", "E", "F", "H", "I", "L", "M", "N", "O", "R", "S", "X"]);
/** words spelled with a vowel that start with a consonant sound, and the other way round */
const CONSONANT_SOUND = /^(uni|use|usu|uti|ure|eu|one|once|ufo)/i;
const SILENT_H = /^(hour|honest|honou?r|heir)/i;

/** true when "an" goes before this word or number */
export function takesAn(word: string): boolean {
  const w = word.replace(/^[^\p{L}\d]+/u, "");
  if (!w) return false;
  const digits = /^\d[\d,.]*/.exec(w)?.[0].replace(/[,.].*$/, "");
  if (digits) {
    // eight, eighty, eight hundred; eleven, eighteen (and 11,000 / 18,000)
    if (digits.startsWith("8")) return true;
    return /^(11|18)$/.test(digits) || /^(11|18)\d{3}$/.test(digits);
  }
  // an all-caps acronym (HIFK, TPS): the first letter's name
  if (/^[A-Z]{2,}\b/.test(w) && !/^[A-Z][a-z]/.test(w)) return VOWEL_LETTERS.has(w[0]);
  if (SILENT_H.test(w)) return true;
  if (CONSONANT_SOUND.test(w)) return false;
  return /^[aeiouäöå]/i.test(w);
}

/** "a"/"an" for the word that follows */
export const aOrAn = (word: string, capital = false) => {
  const a = takesAn(word) ? "an" : "a";
  return capital ? a[0].toUpperCase() + a.slice(1) : a;
};

/** corrects every "a"/"an" in an english text to the word after it ("a 85%" -> "an 85%") */
export function fixArticles(text: string): string {
  return text.replace(/\b(a|an|A|An)(\s+)([\p{L}\d][^\s]*)/gu, (whole, art: string, space: string, next: string) => {
    // "A" as a letter or an initial ("Grade A", "A. Smith") isn't an article
    if (/^\./.test(next)) return whole;
    return `${aOrAn(next, art[0] === "A")}${space}${next}`;
  });
}
