import { ADDRESS_STOPWORDS, ADDRESS_WEAK_TOKENS, MATCH_CONFIG } from "./config";
import { jaccard } from "./similarity";
import { normalizeAddressText, toScriptText } from "./text";
import type { AddressComparison, FieldLike, Status } from "./types";

const PIN_RE = /\b(\d{6})\b/g;

/** Pull the first 6-digit PIN code out of a free-text address. */
export function extractPin(input: string | null | undefined): string | null {
  if (!input) return null;
  const matches = normalizeAddressText(input).match(PIN_RE);
  return matches && matches.length > 0 ? matches[0] : null;
}

export function addressTokens(input: string | null | undefined): string[] {
  if (!input) return [];
  return normalizeAddressText(input)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .filter((token) => !ADDRESS_STOPWORDS.has(token))
    .filter((token) => !/^\d{6}$/.test(token))
    .filter((token) => !ADDRESS_WEAK_TOKENS.has(token));
}

const SEVERITY: Status[] = ["MATCH", "WARNING", "CRITICAL"];

function capSeverity(status: Status, maxSeverity: Status | null): Status {
  if (!maxSeverity || maxSeverity === "UNVERIFIABLE") return status;
  const statusRank = SEVERITY.indexOf(status as (typeof SEVERITY)[number]);
  const maxRank = SEVERITY.indexOf(maxSeverity as (typeof SEVERITY)[number]);
  if (maxRank === -1 || statusRank === -1) return status;
  return statusRank > maxRank ? maxSeverity : status;
}

/**
 * Compare two addresses (SPEC.md §11.4): same PIN and token Jaccard ≥ 0.5 →
 * MATCH, otherwise WARNING. Address differences never exceed WARNING unless a
 * rule explicitly raises `maxSeverity` (many schemes do not require address
 * equality).
 */
export function compareAddress(
  a: FieldLike,
  b: FieldLike,
  options: { maxSeverity?: Status | null } = {},
): AddressComparison {
  const latinA = toScriptText(a).latin;
  const latinB = toScriptText(b).latin;

  if (!latinA || !latinB) {
    return {
      status: "UNVERIFIABLE",
      score: 0,
      mismatchType: "UNREADABLE",
      reason: "One of the addresses is missing or unreadable, so it cannot be compared.",
      pinA: extractPin(latinA),
      pinB: extractPin(latinB),
      sharedTokens: [],
    };
  }

  const pinA = extractPin(latinA);
  const pinB = extractPin(latinB);
  const tokensA = addressTokens(latinA);
  const tokensB = addressTokens(latinB);
  const similarity = jaccard(tokensA, tokensB);
  const sharedTokens = tokensA.filter((token) => tokensB.includes(token));

  const samePin = Boolean(pinA && pinB && pinA === pinB);

  let status: Status;
  let reason: string;

  if (samePin && similarity >= MATCH_CONFIG.addressJaccardMin) {
    status = "MATCH";
    reason = `Both addresses are in PIN ${pinA} and share ${sharedTokens.length} of ${Math.max(tokensA.length, tokensB.length)} address words.`;
  } else if (!pinA || !pinB) {
    status = "WARNING";
    reason = "The PIN code is missing on one of the documents, so the addresses can only be compared loosely.";
  } else if (!samePin) {
    // A different PIN is the only address problem severe enough to reach CRITICAL,
    // and only when the scheme rule explicitly raises the ceiling.
    status = options.maxSeverity === "CRITICAL" ? "CRITICAL" : "WARNING";
    reason = `The PIN codes differ: ${pinA} and ${pinB}.`;
  } else {
    status = "WARNING";
    reason = `Both addresses are in PIN ${pinA}, but the wording differs (${sharedTokens.length} of ${Math.max(tokensA.length, tokensB.length)} words in common).`;
  }

  return {
    status: capSeverity(status, options.maxSeverity ?? "WARNING"),
    score: Math.round(similarity * 1000) / 1000,
    mismatchType: status === "MATCH" ? null : "ADDRESS_VARIATION",
    reason,
    pinA,
    pinB,
    sharedTokens,
  };
}
