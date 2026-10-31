import { normalizeUnicode, stripDiacritics } from "./text";
import type { MismatchType, Status } from "./types";

export type TextComparison = {
  status: Status;
  score: number | null;
  mismatchType: MismatchType | null;
  reason: string;
};

function canonical(input: string): string {
  return normalizeUnicode(stripDiacritics(input)).replace(/[^a-z0-9]/g, "");
}

/**
 * Exact comparison for short identifier-like fields (IFSC, PIN code, roll
 * number). No fuzzy matching: these are codes, not names, so a single wrong
 * character is a real failure.
 */
export function matchFieldText(a: string | null, b: string | null): TextComparison {
  if (!a || !b) {
    return {
      status: "UNVERIFIABLE",
      score: null,
      mismatchType: "UNREADABLE",
      reason: "One of the two values is missing or unreadable, so it cannot be compared.",
    };
  }

  const left = canonical(a);
  const right = canonical(b);

  if (left === right) {
    return {
      status: "MATCH",
      score: 1,
      mismatchType: null,
      reason: `Both documents show ${a.trim()}.`,
    };
  }

  return {
    status: "CRITICAL",
    score: 0,
    mismatchType: "FIELD_DIFFERENT",
    reason: `The values are different: ${a.trim()} and ${b.trim()}.`,
  };
}
