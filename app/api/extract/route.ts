import { NextResponse } from "next/server";
import { readEnv } from "@/lib/env";
import { getPacket, DEFAULT_PACKET_ID } from "@/lib/fixtures";
import {
  DocTypeSchema,
  ExtractedDocumentSchema,
  type DocType,
} from "@/lib/extract/schemas";
import { base64Bytes, isAllowedMimeType } from "@/lib/extract/preprocess";
import { sanitizeExtraction } from "@/lib/extract/sanitize";
import { getAdapter, LlmError } from "@/lib/llm/adapter";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/extract
 *
 * One image per call, one document type per call. The client runs the four calls
 * in parallel.
 *
 * Privacy:
 * - The image is held in memory for the duration of the request only.
 * - Nothing is logged: not the bytes, not the extracted values, not the errors.
 * - The response carries fields, never an image, never a full Aadhaar or account
 *   number (see lib/extract/sanitize.ts).
 *
 * Body: multipart/form-data with `file` + `docType` (+ optional `fixtureId`), or
 * JSON `{ docType, imageBase64, mimeType, fixtureId? }`.
 */

type Incoming = {
  docType: DocType;
  imageBase64: string | null;
  mimeType: string | null;
  fixtureId: string | null;
};

async function readIncoming(request: Request): Promise<Incoming | { error: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const docTypeRaw = String(form.get("docType") ?? "");
    const parsed = DocTypeSchema.safeParse(docTypeRaw);
    if (!parsed.success) return { error: "BAD_REQUEST" };

    const file = form.get("file");
    if (!(file instanceof File)) return { error: "BAD_REQUEST" };

    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      docType: parsed.data,
      imageBase64: buffer.toString("base64"),
      mimeType: file.type || null,
      fixtureId: form.get("fixtureId") ? String(form.get("fixtureId")) : null,
    };
  }

  const json = (await request.json().catch(() => null)) as
    | { docType?: string; imageBase64?: string; mimeType?: string; fixtureId?: string }
    | null;
  if (!json) return { error: "BAD_REQUEST" };

  const parsed = DocTypeSchema.safeParse(json.docType);
  if (!parsed.success) return { error: "BAD_REQUEST" };

  return {
    docType: parsed.data,
    imageBase64: json.imageBase64 ?? null,
    mimeType: json.mimeType ?? null,
    fixtureId: json.fixtureId ?? null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const env = readEnv();
  const incoming = await readIncoming(request);
  if ("error" in incoming) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "We could not read that request." } },
      { status: 400 },
    );
  }

  // ---- Demo mode: fixtures, no model, no key, no network ----
  if (env.demoMode || incoming.fixtureId) {
    const packet = getPacket(incoming.fixtureId ?? DEFAULT_PACKET_ID);
    const document = packet?.documents.find((doc) => doc.docType === incoming.docType) ?? null;
    if (!document) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DEMO_FIXTURE_MISSING",
            message: "This sample packet has no document of that type.",
          },
        },
        { status: 404 },
      );
    }
    // 600–900 ms so the demo shows the loading states honestly.
    await sleep(600 + Math.floor(Math.random() * 300));
    return NextResponse.json(
      {
        ok: true,
        document: ExtractedDocumentSchema.parse(document),
        demo: true,
        fixtureId: packet?.id ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ---- Live extraction ----
  if (!incoming.imageBase64 || !incoming.mimeType) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "No image was sent." } },
      { status: 400 },
    );
  }

  if (!isAllowedMimeType(incoming.mimeType)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "UNSUPPORTED_TYPE", message: "Please use a JPG, PNG or PDF file." },
      },
      { status: 415 },
    );
  }

  if (base64Bytes(incoming.imageBase64) > env.maxImageBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "This file is too large. Please use an image under 1.5 MB.",
        },
      },
      { status: 413 },
    );
  }

  let adapter;
  try {
    adapter = getAdapter();
  } catch (error) {
    const code = error instanceof LlmError ? error.code : "PROVIDER_NOT_CONFIGURED";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message:
            "Live reading is not configured on this server. Set DEMO_MODE=1 or add an API key.",
        },
      },
      { status: 503 },
    );
  }

  // One retry on a schema failure (SPEC.md §10), then a typed error.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await adapter.extract({
        docType: incoming.docType,
        imageBase64: incoming.imageBase64,
        mimeType: incoming.mimeType,
      });

      const { document, redactions } = sanitizeExtraction(raw, incoming.docType);

      return NextResponse.json(
        {
          ok: true,
          document: { ...document, docType: incoming.docType },
          demo: false,
          fixtureId: null,
          // Signal only — the removed numbers are never included.
          redactions: redactions.length,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const isSchema = error instanceof LlmError && error.code === "SCHEMA_INVALID";
      const isZod = error instanceof Error && error.name === "ZodError";

      if ((isSchema || isZod) && attempt === 0) {
        continue;
      }

      if (error instanceof LlmError && error.code === "RATE_LIMITED") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "The reading service is busy. Please try again in a moment.",
            },
          },
          { status: 429 },
        );
      }

      if (isSchema || isZod) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "SCHEMA_INVALID",
              message:
                "We couldn't read this document reliably. Try again with better light, or type the values yourself in the next step.",
            },
          },
          { status: 422 },
        );
      }

      // Never forward the provider's own message.
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PROVIDER_ERROR",
            message:
              "We couldn't read this document. Try again with better light, or type the values yourself in the next step.",
          },
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: { code: "PROVIDER_ERROR", message: "We couldn't read this document." },
    },
    { status: 502 },
  );
}

export async function GET() {
  // A friendly 405 rather than a stack trace: this route takes POST only.
  return NextResponse.json(
    { ok: false, error: { code: "BAD_REQUEST", message: "Use POST to send a document." } },
    { status: 405 },
  );
}
