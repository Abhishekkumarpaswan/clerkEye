import type { DocType } from "@/lib/extract/schemas";
import type { Finding } from "@/lib/rules/types";

/**
 * Remedies: the "what to fix / where to go / what to carry" triple shown for
 * every finding (SPEC.md §12.2).
 *
 * Rules for this file:
 * - No invented facts, deadlines, fees or numeric limits. Not one.
 * - Every entry ships `reviewed: false` and the UI always adds "check what your
 *   office accepts".
 * - The text itself lives in `lib/i18n/*.json` under `remedy.<id>.*`, so each
 *   remedy is bilingual by construction.
 */

export type RemedyId =
  | "REM-NAME-BANK"
  | "REM-NAME-AADHAAR"
  | "REM-NAME-MARKSHEET"
  | "REM-NAME-INCOME"
  | "REM-DOB"
  | "REM-CERT-EXPIRED"
  | "REM-CODE"
  | "REM-ADDRESS"
  | "REM-UNREADABLE"
  | "REM-MISSING"
  | "REM-OK";

export type Remedy = {
  id: RemedyId;
  /**
   * Always false in v1. A human has to confirm the wording against the official
   * process before this can be presented as reviewed advice.
   */
  reviewed: false;
  /** i18n key prefix holding `what` / `where` / `carry`. */
  textKey: string;
};

function make(id: RemedyId): Remedy {
  return { id, reviewed: false, textKey: `remedy.${id}` };
}

const REMEDIES: Record<RemedyId, Remedy> = {
  "REM-NAME-BANK": make("REM-NAME-BANK"),
  "REM-NAME-AADHAAR": make("REM-NAME-AADHAAR"),
  "REM-NAME-MARKSHEET": make("REM-NAME-MARKSHEET"),
  "REM-NAME-INCOME": make("REM-NAME-INCOME"),
  "REM-DOB": make("REM-DOB"),
  "REM-CERT-EXPIRED": make("REM-CERT-EXPIRED"),
  "REM-CODE": make("REM-CODE"),
  "REM-ADDRESS": make("REM-ADDRESS"),
  "REM-UNREADABLE": make("REM-UNREADABLE"),
  "REM-MISSING": make("REM-MISSING"),
  "REM-OK": make("REM-OK"),
};

const NAME_TYPES = new Set([
  "NAME_ABBREVIATED",
  "NAME_SPELLING_VARIANT",
  "NAME_MISSING_TOKEN",
  "NAME_ORDER",
  "NAME_DIFFERENT",
]);

function docsOf(finding: Finding): DocType[] {
  const docs = new Set<DocType>(finding.documents);
  if (finding.left) docs.add(finding.left.doc);
  if (finding.right) docs.add(finding.right.doc);
  return [...docs];
}

/**
 * Pick the remedy for a finding.
 *
 * Returns `null` for portal-level notes: those are not fixable with a document,
 * so the UI shows the `howToCheck` guidance instead of a fix card.
 */
export function remedyForFinding(finding: Finding): Remedy | null {
  const docs = docsOf(finding);
  const type = finding.mismatchType ?? "";

  if (finding.status === "MATCH") return REMEDIES["REM-OK"];

  // A rule that could not run because a document is missing.
  if (finding.status === "UNVERIFIABLE" && docs.length === 0 && finding.howToCheck) {
    return null;
  }
  if (finding.status === "UNVERIFIABLE" && type === "" && docs.length < 2 && finding.left) {
    return REMEDIES["REM-MISSING"];
  }
  if (type === "UNREADABLE") return REMEDIES["REM-UNREADABLE"];

  if (NAME_TYPES.has(type)) {
    // The bank passbook is the document whose name usually has to be corrected,
    // because Aadhaar is the identity document the portal compares against.
    if (docs.includes("BANK_PASSBOOK")) return REMEDIES["REM-NAME-BANK"];
    if (docs.includes("MARKSHEET")) return REMEDIES["REM-NAME-MARKSHEET"];
    if (docs.includes("INCOME_CERT")) return REMEDIES["REM-NAME-INCOME"];
    return REMEDIES["REM-NAME-AADHAAR"];
  }

  if (type === "DOB_SWAPPED" || type === "DOB_DIFFERENT" || type === "DOB_PARTIAL") {
    return REMEDIES["REM-DOB"];
  }
  if (type === "CERT_EXPIRED") return REMEDIES["REM-CERT-EXPIRED"];
  if (type === "ADDRESS_VARIATION") return REMEDIES["REM-ADDRESS"];
  if (type === "FIELD_DIFFERENT") return REMEDIES["REM-CODE"];

  // Anything unmapped still gets honest, generic guidance rather than nothing.
  return REMEDIES["REM-UNREADABLE"];
}

/** Text keys for a remedy, ready for `t(lang, ...)`. */
export function remedyKeys(remedy: Remedy): { what: string; where: string; carry: string } {
  return {
    what: `${remedy.textKey}.what`,
    where: `${remedy.textKey}.where`,
    carry: `${remedy.textKey}.carry`,
  };
}

export const ALL_REMEDIES = REMEDIES;
