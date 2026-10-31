/**
 * Client-side image preprocessing constants and helpers (SPEC.md §10).
 *
 * The actual resize happens in the browser with a canvas (see
 * `components/image-utils.ts`). Everything here is pure and testable.
 */

export const MAX_LONG_SIDE = 1600;
export const JPEG_QUALITY = 0.8;
export const DEFAULT_MAX_BYTES = 1_500_000;

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"] as const;

export type PreprocessCheck =
  | { ok: true }
  | { ok: false; code: "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE" };

export function checkUploadable(file: { type: string; size: number; name?: string }, maxBytes: number): PreprocessCheck {
  const byType = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  const byExtension =
    !file.type && file.name
      ? ACCEPTED_EXTENSIONS.some((extension) => file.name!.toLowerCase().endsWith(extension))
      : false;

  if (!byType && !byExtension) {
    return { ok: false, code: "UNSUPPORTED_TYPE" };
  }
  if (file.size > maxBytes) {
    return { ok: false, code: "FILE_TOO_LARGE" };
  }
  return { ok: true };
}

/** Target dimensions for an image, keeping the aspect ratio and never upscaling. */
export function scaledDimensions(
  width: number,
  height: number,
  maxLongSide = MAX_LONG_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxLongSide) return { width, height };
  const ratio = maxLongSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Approximate decoded size of a base64 string, in bytes. */
export function base64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * PDFs are reduced to their first page on the client (SPEC.md §4). We accept the
 * file, then the upload step asks the user to confirm the preview before it is
 * read. No server-side PDF rasterisation in v1: keeping the image work in the
 * browser is what lets the document data stay off the server after extraction.
 */
export const PDF_FIRST_PAGE_ONLY = true;
