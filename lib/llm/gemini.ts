import { EXTRACTION_JSON_SHAPE, EXPLAIN_SYSTEM_PROMPT, EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from "./prompts";
import {
  extractJson,
  LlmError,
  postJson,
  type ExplainRequest,
  type ExtractionRequest,
} from "./adapter";

/**
 * Gemini implementation of the adapter.
 *
 * Uses the REST endpoint directly (fetch) rather than an SDK: one fewer
 * dependency, no bundled client, and the response is still untrusted input that
 * the caller validates with Zod.
 *
 * The model name always comes from `LLM_MODEL`.
 */

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

function endpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
}

async function call(args: {
  apiKey: string;
  model: string;
  body: unknown;
}): Promise<unknown> {
  const data = (await postJson(endpoint(args.model), {
    headers: { "x-goog-api-key": args.apiKey },
    body: JSON.stringify(args.body),
    timeoutMs: 45_000,
  })) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new LlmError("PROVIDER_ERROR", "request blocked by provider policy");
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    throw new LlmError("SCHEMA_INVALID", "provider returned no content");
  }
  return extractJson(text);
}

export async function geminiExtract(
  request: ExtractionRequest & { apiKey: string; model: string },
): Promise<unknown> {
  return call({
    apiKey: request.apiKey,
    model: request.model,
    body: {
      systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: buildExtractionPrompt(request.docType) },
            { inlineData: { mimeType: request.mimeType, data: request.imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_JSON_SHAPE,
      },
    },
  });
}

export async function geminiExplain(
  request: ExplainRequest & { apiKey: string; model: string },
): Promise<unknown> {
  return call({
    apiKey: request.apiKey,
    model: request.model,
    body: {
      systemInstruction: { parts: [{ text: EXPLAIN_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Language: ${request.lang}\nFindings (JSON):\n${JSON.stringify(request.findings)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    },
  });
}
