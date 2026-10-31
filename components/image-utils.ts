"use client";

import { JPEG_QUALITY, MAX_LONG_SIDE, scaledDimensions } from "@/lib/extract/preprocess";

/**
 * Client-side image helpers (SPEC.md §10).
 *
 * Everything here runs in the browser: the image is resized, optionally redacted,
 * and only then sent for extraction. No image is ever written anywhere.
 */

export type PreparedImage = {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
};

export function bytesOfDataUrl(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function base64Of(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? "";
}

async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode that image."));
      image.src = url;
    });
  } finally {
    if (typeof source !== "string") {
      // The <img> keeps its own reference once decoded.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

/** Resize to a JPEG data URL with the longest side ≤ 1600 px. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const image = await loadImage(file);
  const { width, height } = scaledDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    MAX_LONG_SIDE,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    dataUrl,
    base64: base64Of(dataUrl),
    mimeType: "image/jpeg",
    width,
    height,
    bytes: bytesOfDataUrl(dataUrl),
  };
}

export type RedactionBox = { x: number; y: number; width: number; height: number };

/** Draw black boxes over an image and return the masked JPEG. */
export async function applyRedactions(
  sourceUrl: string,
  boxes: RedactionBox[],
): Promise<PreparedImage> {
  const image = await loadImage(sourceUrl);
  const { width, height } = scaledDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    MAX_LONG_SIDE,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(image, 0, 0, width, height);

  context.fillStyle = "#000000";
  for (const box of boxes) {
    context.fillRect(box.x, box.y, box.width, box.height);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    dataUrl,
    base64: base64Of(dataUrl),
    mimeType: "image/jpeg",
    width,
    height,
    bytes: bytesOfDataUrl(dataUrl),
  };
}

/**
 * Rasterise the first page of a PDF so it can be previewed and redacted like a
 * photo. Uses the browser's own PDF viewer via an <object> fallback: if the
 * browser cannot draw it, we tell the user instead of uploading a file we cannot
 * show them.
 */
export async function preparePdfFirstPage(file: File): Promise<PreparedImage | null> {
  // pdf.js is deliberately not bundled in v1 (SPEC.md §4: first page only). The
  // wizard asks the user to confirm the preview, and if the browser cannot render
  // it we return null and the UI asks for a photo instead.
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, MAX_LONG_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return {
      dataUrl,
      base64: base64Of(dataUrl),
      mimeType: "image/jpeg",
      width,
      height,
      bytes: bytesOfDataUrl(dataUrl),
    };
  } catch {
    return null;
  }
}
