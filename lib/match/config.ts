/**
 * Calibrated thresholds and lookup tables for the matching engine.
 *
 * Every number here is a *starting point* taken from SPEC.md §11 and is
 * re-checked by the eval harness (`pnpm eval:matcher`). Change a value here and
 * you must update the tests and DECISIONS.md (AGENTS.md rule 11).
 */

export const MATCH_CONFIG = {
  /** Jaro-Winkler at or above this counts as a spelling variant (score 0.9). */
  jaroWinklerSpelling: 0.92,
  /** Score awarded to a spelling variant. */
  spellingScore: 0.9,
  /** Score awarded when one side is only an initial of the other. */
  initialScore: 0.6,
  /** Coverage needed for MATCH (and no initials involved). */
  matchCoverage: 0.95,
  /** Coverage needed for a WARNING once the surname aligns. */
  warningCoverage: 0.5,
  /** A surname "aligns" at or above this score. */
  surnameMinScore: 0.9,
  /** Token Jaccard needed for addresses with the same PIN. */
  addressJaccardMin: 0.5,
} as const;

/**
 * Honorifics that are *never* part of a name. Everything else — including
 * kumar, kumari, devi, singh, kaur, lal, chand — is kept, because those are real
 * name parts (SPEC.md §11.1.3).
 */
export const HONORIFICS = [
  "shri",
  "shree",
  "sri",
  "smt",
  "shrimati",
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "late",
] as const;

/**
 * Common abbreviations on Indian certificates. Keep this map small and
 * conservative: every entry is a spelling of the same name, not an inference.
 */
export const ABBREVIATIONS: Record<string, string> = {
  mohd: "mohammad",
  md: "mohammad",
  mohamad: "mohammad",
  muhammed: "mohammad",
  kr: "kumar",
  sing: "singh",
};

/**
 * Deliberately NOT in the map, because expanding them would be an inference:
 * "km" (could be Kumar), "dev" (usually a real middle name or surname, not Devi),
 * "ash" (could be Ashok or Asha). Removing them was a correction found by the eval
 * harness — see DECISIONS.md D-61.
 */

/** Honorifics are matched only at the start of a name, and only as whole tokens. */
export const NAME_SEPARATORS = /[.,\-_/\\|()]+/g;

/**
 * Devanagari → Latin fallback tweaks, applied after Harvard-Kyoto
 * transliteration. Only used when extraction did not supply `romanized`.
 */
export const TRANSLITERATION_MAP: Array<[RegExp, string]> = [
  [/\bksh/g, "ksh"],
  [/c/g, "ch"], // Harvard-Kyoto uses c for च and C for छ
  [/R/g, "ri"], // HK uses R for ऋ
  [/S/g, "sh"], // HK uses S for ष
  [/T/g, "t"], // retroflex ट
  [/D/g, "d"], // retroflex ड
  [/N/g, "n"], // retroflex ण
  [/z/g, "sh"], // HK uses z for श
  [/M/g, "n"], // anusvara
  [/A/g, "a"],
  [/I/g, "i"],
  [/U/g, "u"],
  [/\bw/g, "v"],
  [/q/g, "k"],
  [/x/g, "ksh"],
  [/chh/g, "ch"],
];

/** Words that are dropped from address comparison. */
export const ADDRESS_STOPWORDS = new Set([
  "near",
  "opp",
  "opposite",
  "behind",
  "po",
  "post",
  "ps",
  "dist",
  "district",
  "tehsil",
  "teh",
  "village",
  "vill",
  "ward",
  "house",
  "no",
  "hno",
  "h",
  "sector",
  "block",
  "the",
  "of",
  "and",
]);

/** Address tokens that carry no discriminating power on their own. */
export const ADDRESS_WEAK_TOKENS = new Set(["india", "indian", "state"]);

export const DOB_FORMATS_HINT = [
  "DD/MM/YYYY",
  "DD-MM-YYYY",
  "YYYY-MM-DD",
  "DD Mon YYYY",
] as const;
