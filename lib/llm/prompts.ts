import { DOC_TYPE_LABELS, type DocType } from "@/lib/extract/schemas";

/**
 * Prompts live here, never inline in a provider file, so both providers get
 * byte-identical instructions (SPEC.md §10).
 *
 * The rules below are non-negotiable product constraints, not suggestions.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You read Indian scholarship documents and return their fields as JSON.

Absolute rules:
1. Return only values that are visibly printed in the image. If a field is absent, blurred, cut off or unreadable, return {"value": null, "romanized": null, "script": "unknown", "confidence": 0}. Never guess, never infer and never complete a value from context.
2. Copy text exactly as printed, including punctuation, initials, dots and spelling mistakes. Do not correct, normalise or translate anything.
3. If a value is printed in Devanagari or any non-Latin Indian script, copy it exactly into "value", set "script" to "devanagari" (or "other"), and also give a Latin-script rendering in "romanized" using ordinary English spelling (for example राजेश कुमार वर्मा -> "Rajesh Kumar Verma").
4. For an Aadhaar card, fill "fatherName" only from a line that explicitly contains S/O, D/O, W/O or C/O. Do not take a name from any other place on the card.
5. NEVER return a full Aadhaar number (12 digits) or a full bank account number. If a full bank account number is printed, return only its last 4 digits in "accountLast4". Mask digits you redact with nothing — simply omit them.
6. If the image is blurry, cropped, rotated, handwritten or a photocopy, say so briefly in "qualityNote". Otherwise set it to null.
7. "confidence" is your own certainty from 0 to 1 for that field. Be honest: use a value below 0.7 whenever a human should double-check it.

Return one JSON object only. No prose, no markdown, no code fences.`;

/** Fields we ask for on each document type. */
const FIELD_GUIDE: Record<DocType, string> = {
  AADHAAR: `applicantName (the card holder's name), fatherName (only from an S/O / D/O / W/O / C/O line), dob, address, pin (6 digits)`,
  INCOME_CERT: `applicantName, fatherName (from a "S/O" / "D/O" / "W/O" line or a labelled father's-name field), address, pin, issueDate (the date the certificate was issued), validUntil (only if an expiry date is printed)`,
  MARKSHEET: `applicantName, fatherName, dob, issueDate (only if printed)`,
  BANK_PASSBOOK: `bankAccountHolder (the account holder's name), ifsc, accountLast4 (the last four digits of the account number only), address`,
};

export function buildExtractionPrompt(docType: DocType): string {
  const keys = [
    "applicantName",
    "fatherName",
    "dob",
    "address",
    "pin",
    "issueDate",
    "validUntil",
    "bankAccountHolder",
    "ifsc",
    "accountLast4",
  ];

  return `This image is a ${DOC_TYPE_LABELS[docType]}.

Return JSON with exactly this shape:
{
  "docType": "${docType}",
  "fields": {
${keys.map((key) => `    "${key}": {"value": string | null, "romanized": string | null, "script": "latin" | "devanagari" | "other" | "unknown", "confidence": number}`).join(",\n")}
  },
  "qualityNote": string | null
}

For this document type, look for: ${FIELD_GUIDE[docType]}.
Every field you cannot see must be returned with "value": null and "confidence": 0. Do not omit keys.`;
}

/** JSON shape handed to providers that support a schema. */
export const EXTRACTION_JSON_SHAPE = {
  type: "object",
  properties: {
    docType: { type: "string" },
    fields: {
      type: "object",
      properties: Object.fromEntries(
        [
          "applicantName",
          "fatherName",
          "dob",
          "address",
          "pin",
          "issueDate",
          "validUntil",
          "bankAccountHolder",
          "ifsc",
          "accountLast4",
        ].map((key) => [
          key,
          {
            type: "object",
            properties: {
              value: { type: "string", nullable: true },
              romanized: { type: "string", nullable: true },
              script: {
                type: "string",
                enum: ["latin", "devanagari", "other", "unknown"],
              },
              confidence: { type: "number" },
            },
            required: ["value", "script", "confidence"],
          },
        ]),
      ),
    },
    qualityNote: { type: "string", nullable: true },
  },
  required: ["docType", "fields"],
} as const;

/**
 * Explain prompt (SPEC.md §13). It receives *findings only*: no images, no
 * document text beyond the compared values, and no room to add facts.
 */
export const EXPLAIN_SYSTEM_PROMPT = `You rewrite short factual notes about document mismatches for a student in India.

Absolute rules:
1. Use ONLY the facts in the input. Do not add rules, sources, remedies, deadlines, fees, phone numbers or office names.
2. Do not promise an outcome. Never say an application "will be accepted" or "will be rejected"; say "may be flagged" or "may cause a delay".
3. Do not give advice beyond what the input already contains.
4. Write 1-2 short sentences per finding, plain language, no legal jargon, no markdown.
5. Reply in the requested language ("en" = English, "hi" = Hindi in Devanagari script).
6. Return JSON only, exactly: {"explanations":[{"ruleId":"...","text":"..."}]} using only the ruleIds given in the input.`;
