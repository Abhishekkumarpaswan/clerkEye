import type { DocType, ExtractedDocument } from "@/lib/extract/schemas";

/**
 * Wizard state. Lives in React state only — never in localStorage, sessionStorage,
 * a cookie, IndexedDB or a URL (AGENTS.md rule 3). A page reload clears it, which
 * is the point.
 */

export type UploadStatus = "idle" | "reading" | "ready" | "error";

export type UploadEntry = {
  docType: DocType;
  status: UploadStatus;
  /** Object URL or data URL for the preview. Never leaves the browser. */
  previewUrl: string | null;
  fileName: string | null;
  /** Base64 payload actually sent for extraction (already resized + redacted). */
  imageBase64: string | null;
  mimeType: string | null;
  /** True once the user has covered the number, or for a sample document. */
  redacted: boolean;
  /** Set when DEMO_MODE served a fixture. */
  demo: boolean;
  fixtureId: string | null;
  /** Confirmed/edited values. This is what the matcher receives. */
  document: ExtractedDocument | null;
  /** Which fields the user edited in the confirm step. */
  editedFields: string[];
  errorCode: string | null;
};

export type Step = "upload" | "confirm" | "results" | "fix";

export const STEP_ORDER: Step[] = ["upload", "confirm", "results", "fix"];

export function emptyEntry(docType: DocType): UploadEntry {
  return {
    docType,
    status: "idle",
    previewUrl: null,
    fileName: null,
    imageBase64: null,
    mimeType: null,
    redacted: false,
    demo: false,
    fixtureId: null,
    document: null,
    editedFields: [],
    errorCode: null,
  };
}

export function readyEntries(entries: UploadEntry[]): UploadEntry[] {
  return entries.filter((entry) => entry.status === "ready" && entry.document !== null);
}

/** Documents that can actually be compared (SPEC.md §15: minimum 2). */
export function documentsForCheck(entries: UploadEntry[]): ExtractedDocument[] {
  return readyEntries(entries)
    .map((entry) => entry.document)
    .filter((doc): doc is ExtractedDocument => doc !== null);
}

export function canRunChecks(entries: UploadEntry[]): boolean {
  return documentsForCheck(entries).length >= 2;
}

export function stepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

/** Immutably set one field of one document (confirm-step editing). */
export function withEditedField(
  entry: UploadEntry,
  field: string,
  value: string,
): UploadEntry {
  if (!entry.document) return entry;
  const fields = { ...entry.document.fields } as Record<string, unknown>;
  const existing = fields[field] as
    | { value: string | null; romanized?: string | null; script?: string; confidence?: number }
    | undefined;

  fields[field] = {
    value: value.trim() === "" ? null : value,
    romanized: existing?.romanized ?? null,
    script: existing?.script ?? "latin",
    // A value the user typed by hand is as good as confirmed.
    confidence: 1,
  };

  return {
    ...entry,
    document: { ...entry.document, fields: fields as ExtractedDocument["fields"] },
    editedFields: entry.editedFields.includes(field)
      ? entry.editedFields
      : [...entry.editedFields, field],
  };
}

/** Low confidence is worth highlighting in the confirm table. */
export const LOW_CONFIDENCE = 0.75;

export function isLowConfidence(confidence: number | undefined): boolean {
  return typeof confidence === "number" && confidence < LOW_CONFIDENCE;
}
