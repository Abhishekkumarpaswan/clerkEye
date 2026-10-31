import { formatIndianDate, monthsBetweenIso, parseIndianDate } from "./dob";
import { toScriptText } from "./text";
import type { FieldLike, ValidityResult } from "./types";

export type ValidityInput = {
  issueDate: FieldLike;
  validUntil?: FieldLike;
  /** Today, as `yyyy-MM-dd` (injected so the function stays pure and testable). */
  asOf: string;
  /** Rule value. `null` means the rule is not verified → UNVERIFIABLE. */
  maxAgeMonths: number | null;
};

/** Whole months between the issue date and `asOf`. */
export function certificateAgeMonths(issueIso: string, asOf: string): number | null {
  return monthsBetweenIso(issueIso, asOf);
}

/**
 * Certificate validity (SPEC.md §11.5).
 *
 * - No verified `maxAgeMonths` → UNVERIFIABLE (we never invent a limit).
 * - A printed `validUntil` decides first when present.
 * - Otherwise the age in months is measured from the issue date.
 */
export function checkValidity(input: ValidityInput): ValidityResult {
  const issueText = toScriptText(input.issueDate).latin;
  const issue = parseIndianDate(issueText);
  const validUntilText = toScriptText(input.validUntil).latin;
  const validUntil = parseIndianDate(validUntilText);
  const asOf = parseIndianDate(input.asOf);

  const base: ValidityResult = {
    status: "UNVERIFIABLE",
    mismatchType: null,
    reason: "",
    issueDate: issue?.iso ?? null,
    validUntil: validUntil?.iso ?? null,
    maxAgeMonths: input.maxAgeMonths,
  };

  if (!issue) {
    return {
      ...base,
      mismatchType: "UNREADABLE",
      reason: "The issue date on this certificate could not be read, so its validity cannot be checked.",
    };
  }

  if (!asOf) {
    return { ...base, reason: "The reference date for the validity check is unavailable." };
  }

  // An explicit "valid until" date always wins.
  if (validUntil) {
    if (validUntil.iso >= asOf.iso) {
      return {
        ...base,
        status: "MATCH",
        reason: `The certificate is valid until ${formatIndianDate(validUntil.iso)}.`,
      };
    }
    return {
      ...base,
      status: "CRITICAL",
      mismatchType: "CERT_EXPIRED",
      reason: `The certificate expired on ${formatIndianDate(validUntil.iso)}.`,
    };
  }

  if (input.maxAgeMonths == null) {
    return {
      ...base,
      status: "UNVERIFIABLE",
      reason:
        "This scheme's validity limit for the certificate is not confirmed in our sources, so we cannot check it.",
    };
  }

  const age = certificateAgeMonths(issue.iso, asOf.iso);
  if (age == null) {
    return { ...base, reason: "The certificate age could not be calculated." };
  }

  if (age <= input.maxAgeMonths) {
    return {
      ...base,
      status: "MATCH",
      reason: `Issued ${formatIndianDate(issue.iso)} — ${age} month(s) old, within the ${input.maxAgeMonths}-month limit.`,
    };
  }

  return {
    ...base,
    status: "CRITICAL",
    mismatchType: "CERT_EXPIRED",
    reason: `Issued ${formatIndianDate(issue.iso)} — ${age} month(s) old, beyond the ${input.maxAgeMonths}-month limit.`,
  };
}
