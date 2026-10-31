import { z } from "zod";
import { SCRIPT, Status } from "@/lib/match/types";

/**
 * Data contracts from SPEC.md §9.
 *
 * These schemas are the boundary between the LLM (untrusted) and the rest of the
 * app (trusted, deterministic). Everything that reaches the matcher must have
 * been through `ExtractedDocumentSchema.parse`.
 */

export const DocTypeSchema = z.enum([
  "AADHAAR",
  "INCOME_CERT",
  "MARKSHEET",
  "BANK_PASSBOOK",
]);
export type DocType = z.infer<typeof DocTypeSchema>;

export const DOC_TYPES = DocTypeSchema.options;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  AADHAAR: "Aadhaar",
  INCOME_CERT: "Income certificate",
  MARKSHEET: "Marksheet",
  BANK_PASSBOOK: "Bank passbook",
};

export const FieldSchema = z.object({
  /** Exactly as printed; null when unreadable or absent. */
  value: z.string().nullable(),
  /** Latin-script rendering when the source script is not Latin. */
  romanized: z.string().nullable().default(null),
  script: z.enum(SCRIPT).default("unknown"),
  confidence: z.number().min(0).max(1).default(0),
});
export type ExtractedField = z.infer<typeof FieldSchema>;

/** Field names on a document, in the order they are shown in the confirm table. */
export const FIELD_NAMES = [
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
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

/**
 * The last four digits of the account number. Modelled as a Field for
 * consistency, but the value is validated so a full account number can never
 * travel further than the extraction boundary.
 */
const AccountLast4Field = FieldSchema.refine(
  (field) => field.value == null || /^\d{4}$/.test(field.value),
  { message: "only the last 4 digits of an account number may be stored" },
);

export const DocumentFieldsSchema = z.object({
  /**
   * Optional in practice: a bank passbook does not print an "applicant name" and
   * we must not invent one (SPEC.md §10 rule 1). Documented as D-28.
   */
  applicantName: FieldSchema.optional(),
  /** Aadhaar: parsed only from an explicit S/O, D/O, W/O line. */
  fatherName: FieldSchema.optional(),
  dob: FieldSchema.optional(),
  address: FieldSchema.optional(),
  pin: FieldSchema.optional(),
  issueDate: FieldSchema.optional(),
  validUntil: FieldSchema.optional(),
  bankAccountHolder: FieldSchema.optional(),
  ifsc: FieldSchema.optional(),
  accountLast4: AccountLast4Field.optional(),
});

export const ExtractedDocumentSchema = z.object({
  docType: DocTypeSchema,
  fields: DocumentFieldsSchema,
  qualityNote: z.string().nullable().default(null),
});
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;
export type DocumentFields = z.infer<typeof DocumentFieldsSchema>;

/** Which fields each document type is expected to carry. */
export const EXPECTED_FIELDS: Record<DocType, FieldName[]> = {
  AADHAAR: ["applicantName", "fatherName", "dob", "address", "pin"],
  INCOME_CERT: ["applicantName", "fatherName", "address", "pin", "issueDate"],
  MARKSHEET: ["applicantName", "fatherName", "dob"],
  BANK_PASSBOOK: ["bankAccountHolder", "ifsc", "accountLast4"],
};

/** A short, factual sentence about a document's image quality. */
export const QUALITY_NOTE_MAX = 120;

export const ExtractionSuccessSchema = z.object({
  ok: z.literal(true),
  document: ExtractedDocumentSchema,
  /** Set when DEMO_MODE served a fixture instead of calling a model. */
  demo: z.boolean().default(false),
  fixtureId: z.string().nullable().default(null),
});

export const ExtractionErrorCode = z.enum([
  "BAD_REQUEST",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_ERROR",
  "SCHEMA_INVALID",
  "UNREADABLE",
  "RATE_LIMITED",
  "DEMO_FIXTURE_MISSING",
]);

export const ExtractionFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ExtractionErrorCode,
    /** Safe, user-facing message; never raw provider text. */
    message: z.string(),
  }),
});

export const ExtractionResponseSchema = z.discriminatedUnion("ok", [
  ExtractionSuccessSchema,
  ExtractionFailureSchema,
]);
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export const StatusSchema = z.enum(Status);
