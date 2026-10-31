import {
  EXTRACTION_SYSTEM_PROMPT,
  EXPLAIN_SYSTEM_PROMPT,
  buildExtractionPrompt,
} from "./prompts";
import {
  extractJson,
  LlmError,
  postJson,
  type ExplainRequest,
  type ExtractionRequest,
} from "./adapter";

/**
 * Anthropic implementation of the adapter (Messages API, fetch, no SDK).
 * The model name always comes from `LLM_MODEL`.
 */

const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
};

async function call(args: {
  apiKey: string;
  model: string;
  system: string;
  content: unknown[];
  maxTokens: number;
}): Promise<unknown> {
  const data = (await postJson("https://api.anthropic.com/v1/messages", {
    headers: {
      "x-api-key": args.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      temperature: 0,
      system: args.system,
      messages: [{ role: "user", content: args.content }],
    }),
    timeoutMs: 45_000,
  })) as AnthropicResponse;

  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  if (!text) {
    throw new LlmError("SCHEMA_INVALID", "provider returned no content");
  }
  return extractJson(text);
}

export async function anthropicExtract(
  request: ExtractionRequest & { apiKey: string; model: string },
): Promise<unknown> {
  return call({
    apiKey: request.apiKey,
    model: request.model,
    system: EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 1500,
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: request.mimeType,
          data: request.imageBase64,
        },
      },
      { type: "text", text: buildExtractionPrompt(request.docType) },
    ],
  });
}

export async function anthropicExplain(
  request: ExplainRequest & { apiKey: string; model: string },
): Promise<unknown> {
  return call({
    apiKey: request.apiKey,
    model: request.model,
    system: EXPLAIN_SYSTEM_PROMPT,
    maxTokens: 800,
    content: [
      {
        type: "text",
        text: `Language: ${request.lang}\nFindings (JSON):\n${JSON.stringify(request.findings)}`,
      },
    ],
  });
}
