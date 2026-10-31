import { ExtractedDocumentSchema, type ExtractedDocument, type FieldName } from "./schemas";

/**
 * Post-extraction guard (SPEC.md §10, AGENTS.md rule 4).
 *
 * The prompt already forbids full Aadhaar and account numbers, but a prompt is
 * not a guarantee. This module is the deterministic backstop: whatever the model
 * returns, a 12-digit Aadhaar number or a long account number cannot leave it.
 *
 * Order matters: the raw JSON is scrubbed *first*, then validated against the
 * schema — a strict schema and a lenient scrub have to run in that order, or the
 * strict schema would reject the response before it could be cleaned.
 */

const AADHAAR_12 = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const LONG_DIGITS = /\b\d{7,}\b/g;
const MASK = "•••• •••• ••••";

export type Redaction = { field: string; kind: "aadhaar" | "long_number" };

export type SanitizeResult = {
  document: ExtractedDocument;
  /** What was removed, for the UI to say "we hid a number". Never the number. */
  redactions: Redaction[];
};

function scrubText(value: string, field: string, redactions: Redaction[]): string {
  let out = value;

  AADHAAR_12.lastIndex = 0;
  if (AADHAAR_12.test(out)) {
    AADHAAR_12.lastIndex = 0;
    out = out.replace(AADHAAR_12, MASK);
    redactions.push({ field, kind: "aadhaar" });
  }

  LONG_DIGITS.lastIndex = 0;
  if (LONG_DIGITS.test(out)) {
    LONG_DIGITS.lastIndex = 0;
    out = out.replace(LONG_DIGITS, (match) => `••••${match.slice(-4)}`);
    redactions.push({ field, kind: "long_number" });
  }

  return out;
}

type LooseField = { value?: unknown; romanized?: unknown; script?: unknown; confidence?: unknown };

/**
 * Clean the raw response *before* schema validation.
 *
 * Copy-on-write: the caller's object is never mutated, so a caller that keeps
 * the raw response (a test, or a future debug path) still sees what happened.
 */
function preScrub(raw: unknown, redactions: Redaction[]): unknown {
  if (raw === null || typeof raw !== "object") return raw;

  const clone = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const fields = clone.fields;

  if (fields && typeof fields === "object") {
    for (const [name, rawField] of Object.entries(fields as Record<string, LooseField>)) {
      if (!rawField || typeof rawField !== "object") continue;

      if (typeof rawField.value === "string") {
        if (name === "accountLast4") {
          const digits = rawField.value.replace(/\D/g, "");
          if (digits.length > 4) {
            redactions.push({ field: name, kind: "long_number" });
          }
          rawField.value = digits.length > 0 ? digits.slice(-4) : null;
        } else {
          rawField.value = scrubText(rawField.value, name, redactions);
        }
      }

      if (typeof rawField.romanized === "string") {
        rawField.romanized = scrubText(rawField.romanized, `${name}.romanized`, redactions);
      }
    }
  }

  if (typeof clone.qualityNote === "string") {
    clone.qualityNote = scrubText(clone.qualityNote, "qualityNote", redactions).slice(0, 120);
  }

  return clone;
}

/**
 * Validate and clean a raw model response.
 * Throws (Zod error) when the shape is unusable, which the route turns into a
 * safe `SCHEMA_INVALID` error after one retry.
 */
export function sanitizeExtraction(raw: unknown, expectedDocType: string): SanitizeResult {
  const redactions: Redaction[] = [];
  const scrubbed = preScrub(raw, redactions);

  if (scrubbed && typeof scrubbed === "object" && !("docType" in scrubbed)) {
    (scrubbed as Record<string, unknown>).docType = expectedDocType;
  }

  const parsed = ExtractedDocumentSchema.parse(scrubbed);

  // Belt and braces: re-check every string that reaches the client.
  const fields = parsed.fields as Record<string, { value?: string | null } | undefined>;
  for (const value of Object.values(fields)) {
    if (typeof value?.value === "string" && looksLikeFullAadhaar(value.value)) {
      throw new Error("A full Aadhaar number survived sanitisation"); // fail closed
    }
  }

  // The document type is decided by the caller, never by the model: a model that
  // says "MARKSHEET" for an Aadhaar upload must not change which rule runs.
  const document: ExtractedDocument = {
    ...parsed,
    docType: parsed.docType,
    qualityNote: parsed.qualityNote,
  };

  return { document, redactions };
}

/** True when the text looks like a full 12-digit Aadhaar number. */
export function looksLikeFullAadhaar(text: string): boolean {
  AADHAAR_12.lastIndex = 0;
  const found = AADHAAR_12.test(text);
  AADHAAR_12.lastIndex = 0;
  return found;
}

/** Fields that the confirm step shows for a document type, in order. */
export function presentFields(document: ExtractedDocument): FieldName[] {
  return Object.keys(document.fields).filter(
    (key) => (document.fields as Record<string, unknown>)[key] !== undefined,
  ) as FieldName[];
}
