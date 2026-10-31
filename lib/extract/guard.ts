/**
 * Client-side guard rails for numbers (SPEC.md §16 M6).
 *
 * Two jobs:
 * 1. Decide whether an Aadhaar card may be sent for reading at all.
 * 2. Re-check any incoming field value on the client, so even a server bug cannot
 *    put a 12-digit number into React state or onto the printed checklist.
 *
 * Pure functions, unit-tested. The server has its own guard
 * (`lib/extract/sanitize.ts`) — this is defence in depth, not a replacement.
 */

const AADHAAR_12 = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const LONG_DIGITS = /\b\d{7,}\b/;

export function containsTwelveDigitNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  AADHAAR_12.lastIndex = 0;
  return AADHAAR_12.test(text.normalize("NFKC"));
}

export function containsLongNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  LONG_DIGITS.lastIndex = 0;
  return LONG_DIGITS.test(text.normalize("NFKC"));
}

/** Mask anything that looks like an Aadhaar number or a long account number. */
export function maskNumbers(text: string): string {
  return text
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "•••• •••• ••••")
    .replace(/\b\d{7,}\b/g, (match) => `••••${match.slice(-4)}`);
}

export type GateInput = {
  docType: string;
  redacted: boolean;
  demo: boolean;
  hasImage: boolean;
};

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: "REDACT_FIRST" | "NO_IMAGE" };

/**
 * An Aadhaar card must have the number covered before it is read. This is the
 * one rule we can actually enforce without reading the card: we ask the user to
 * cover it, and we do not send the image until they have.
 */
export function canSendForExtraction(input: GateInput): GateResult {
  if (input.demo) return { allowed: true };
  if (!input.hasImage) return { allowed: false, reason: "NO_IMAGE" };
  if (input.docType === "AADHAAR" && !input.redacted) {
    return { allowed: false, reason: "REDACT_FIRST" };
  }
  return { allowed: true };
}
