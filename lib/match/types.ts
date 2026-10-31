/**
 * Shared domain types for the deterministic matching engine.
 *
 * These types are the single source of truth for statuses across the app: the
 * extraction schemas, the rule engine and the UI all import from here.
 */

export const Status = {
  MATCH: "MATCH",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  UNVERIFIABLE: "UNVERIFIABLE",
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export const SCRIPT = ["latin", "devanagari", "other", "unknown"] as const;
export type Script = (typeof SCRIPT)[number];

/** Ordered by severity, used when a rule caps the severity of a comparison. */
export const SEVERITY_RANK: Record<Status, number> = {
  MATCH: 0,
  WARNING: 1,
  CRITICAL: 2,
  UNVERIFIABLE: 3,
};

/**
 * A field as it comes out of extraction, or a plain string when the value was
 * typed by the user in the confirm step.
 */
export type FieldLike =
  | string
  | null
  | undefined
  | {
      value: string | null;
      romanized?: string | null;
      script?: Script;
      confidence?: number;
    };

export type ScriptText = {
  /** Best available Latin-script form (romanized → transliterated → original). */
  latin: string | null;
  /** Exactly what was printed. */
  printed: string | null;
  /** Script of the printed value. */
  script: Script;
  /** True when we had to transliterate ourselves (lower confidence). */
  transliterated: boolean;
};

/** Name mismatch taxonomy — SPEC.md §11.2 and §12.2. */
export const MismatchType = {
  NAME_ABBREVIATED: "NAME_ABBREVIATED",
  NAME_SPELLING_VARIANT: "NAME_SPELLING_VARIANT",
  NAME_MISSING_TOKEN: "NAME_MISSING_TOKEN",
  NAME_ORDER: "NAME_ORDER",
  NAME_DIFFERENT: "NAME_DIFFERENT",
  DOB_SWAPPED: "DOB_SWAPPED",
  DOB_DIFFERENT: "DOB_DIFFERENT",
  DOB_PARTIAL: "DOB_PARTIAL",
  ADDRESS_VARIATION: "ADDRESS_VARIATION",
  CERT_EXPIRED: "CERT_EXPIRED",
  UNREADABLE: "UNREADABLE",
} as const;

export type MismatchType = (typeof MismatchType)[keyof typeof MismatchType];

export type TokenAlignment = {
  token: string;
  matchedWith: string | null;
  score: number;
  kind: "exact" | "phonetic" | "spelling" | "initial" | "none";
};

export type NameComparison = {
  status: Status;
  score: number;
  mismatchType: MismatchType | null;
  /** Machine-generated, factual sentence. Never speculative. */
  reason: string;
  tokensA: string[];
  tokensB: string[];
  alignments: TokenAlignment[];
  surnameOk: boolean;
  usedInitials: boolean;
};

export type DateComparison = {
  status: Status;
  mismatchType: MismatchType | null;
  reason: string;
  /** ISO `yyyy-MM-dd` when the value was parseable. */
  left: string | null;
  right: string | null;
  partial: boolean;
};

export type AddressComparison = {
  status: Status;
  score: number;
  mismatchType: MismatchType | null;
  reason: string;
  pinA: string | null;
  pinB: string | null;
  sharedTokens: string[];
};

export type ValidityResult = {
  status: Status;
  mismatchType: MismatchType | null;
  reason: string;
  issueDate: string | null;
  validUntil: string | null;
  maxAgeMonths: number | null;
};
