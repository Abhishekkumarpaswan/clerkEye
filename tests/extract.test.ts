import { describe, expect, it } from "vitest";
import {
  ExtractedDocumentSchema,
  DocumentFieldsSchema,
  FieldSchema,
} from "@/lib/extract/schemas";
import { sanitizeExtraction, looksLikeFullAadhaar } from "@/lib/extract/sanitize";
import {
  base64Bytes,
  checkUploadable,
  isAllowedMimeType,
  scaledDimensions,
} from "@/lib/extract/preprocess";
import { extractJson, LlmError } from "@/lib/llm/adapter";
import { PACKETS } from "@/lib/fixtures";

const field = (value: string | null, extra: Record<string, unknown> = {}) => ({
  value,
  romanized: null,
  script: "latin",
  ...extra,
});

describe("extraction schemas", () => {
  it("validates every demo packet document", () => {
    for (const packet of PACKETS) {
      for (const doc of packet.documents) {
        expect(ExtractedDocumentSchema.safeParse(doc).success, doc.docType).toBe(true);
      }
    }
  });

  it("never accepts more than the last 4 digits of an account number", () => {
    expect(
      DocumentFieldsSchema.safeParse({
        bankAccountHolder: field("Rajesh Kumar Verma"),
        accountLast4: field("1234"),
      }).success,
    ).toBe(true);

    expect(
      DocumentFieldsSchema.safeParse({
        bankAccountHolder: field("Rajesh Kumar Verma"),
        accountLast4: field("123456789012"),
      }).success,
    ).toBe(false);
  });

  it("requires a confidence between 0 and 1", () => {
    expect(FieldSchema.safeParse({ value: "x", script: "latin", confidence: 1.4 }).success).toBe(false);
    expect(FieldSchema.safeParse({ value: "x", script: "latin", confidence: 0.5 }).success).toBe(true);
  });

  it("rejects an unknown document type", () => {
    expect(ExtractedDocumentSchema.safeParse({ docType: "PAN", fields: {} }).success).toBe(false);
  });
});

describe("sanitizeExtraction", () => {
  it("removes a 12-digit Aadhaar number that slipped through", () => {
    const raw = {
      docType: "AADHAAR",
      fields: { applicantName: field("Rajesh Kumar Verma 1234 5678 9012") },
      qualityNote: null,
    };
    const { document, redactions } = sanitizeExtraction(raw, "AADHAAR");
    expect(document.fields.applicantName?.value).not.toMatch(/\d{12}/);
    expect(document.fields.applicantName?.value).not.toMatch(/1234/);
    expect(redactions.some((r) => r.kind === "aadhaar")).toBe(true);
  });

  it("removes an unspaced 12-digit number", () => {
    const raw = {
      docType: "AADHAAR",
      fields: { address: field("H.No 42 123456789012 Kurukshetra") },
      qualityNote: null,
    };
    const { document } = sanitizeExtraction(raw, "AADHAAR");
    expect(document.fields.address?.value).not.toMatch(/123456789012/);
  });

  it("truncates a long account number to its last four digits", () => {
    const raw = {
      docType: "BANK_PASSBOOK",
      fields: {
        bankAccountHolder: field("Rajesh Kumar Verma"),
        accountLast4: field("123456789012"),
      },
      qualityNote: null,
    };
    const { document, redactions } = sanitizeExtraction(raw, "BANK_PASSBOOK");
    expect(document.fields.accountLast4?.value).toBe("9012");
    // The holder's name is not a number, so it is left exactly as printed.
    expect(document.fields.bankAccountHolder?.value).toBe("Rajesh Kumar Verma");
    expect(redactions).toEqual([{ field: "accountLast4", kind: "long_number" }]);
  });

  it("keeps a clean document untouched", () => {
    const raw = {
      docType: "MARKSHEET",
      fields: { applicantName: field("Rajesh Kumar Verma"), dob: field("12/03/2004") },
      qualityNote: "Handwritten name",
    };
    const { document, redactions } = sanitizeExtraction(raw, "MARKSHEET");
    expect(redactions).toHaveLength(0);
    expect(document.fields.applicantName?.value).toBe("Rajesh Kumar Verma");
  });

  it("truncates a very long quality note", () => {
    const raw = {
      docType: "AADHAAR",
      fields: { applicantName: field("Rajesh") },
      qualityNote: "x".repeat(500),
    };
    const { document } = sanitizeExtraction(raw, "AADHAAR");
    expect((document.qualityNote ?? "").length).toBeLessThanOrEqual(120);
  });

  it("detects full Aadhaar numbers", () => {
    expect(looksLikeFullAadhaar("1234 5678 9012")).toBe(true);
    expect(looksLikeFullAadhaar("123456789012")).toBe(true);
    expect(looksLikeFullAadhaar("PIN 136118")).toBe(false);
    expect(looksLikeFullAadhaar("4821")).toBe(false);
  });
});

describe("preprocess helpers", () => {
  it("accepts JPG, PNG and PDF and rejects others", () => {
    expect(checkUploadable({ type: "image/jpeg", size: 1000 }, 1_000_000).ok).toBe(true);
    expect(checkUploadable({ type: "image/png", size: 1000 }, 1_000_000).ok).toBe(true);
    expect(checkUploadable({ type: "application/pdf", size: 1000 }, 1_000_000).ok).toBe(true);
    expect(checkUploadable({ type: "image/gif", size: 1000 }, 1_000_000)).toEqual({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
    expect(isAllowedMimeType("text/plain")).toBe(false);
  });

  it("rejects files over the limit", () => {
    expect(checkUploadable({ type: "image/png", size: 2_000_000 }, 1_000_000)).toEqual({
      ok: false,
      code: "FILE_TOO_LARGE",
    });
  });

  it("scales the longest side to 1600 px without upscaling", () => {
    expect(scaledDimensions(3200, 1600)).toEqual({ width: 1600, height: 800 });
    expect(scaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("estimates base64 size", () => {
    expect(base64Bytes("aGVsbG8=")).toBe(5);
  });
});

describe("provider JSON handling", () => {
  it("parses JSON wrapped in a markdown fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON with surrounding prose", () => {
    expect(extractJson('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  it("throws a typed error on garbage", () => {
    expect(() => extractJson("not json at all")).toThrow(LlmError);
  });
});
