import { readEnv, type LlmProvider } from "@/lib/env";
import type { DocType } from "@/lib/extract/schemas";
import { anthropicExtract, anthropicExplain } from "./anthropic";
import { geminiExtract, geminiExplain } from "./gemini";

/**
 * Provider adapter (SPEC.md §6, §10).
 *
 * The rest of the app talks to this interface only. Adding a provider means
 * adding a file here plus one case, never touching a route.
 *
 * No model name, key or endpoint is hardcoded: everything comes from env.
 */

export type ExtractionRequest = {
  docType: DocType;
  imageBase64: string;
  mimeType: string;
};

export type ExplainRequest = {
  lang: "en" | "hi";
  findings: Array<{
    ruleId: string;
    check: string;
    status: string;
    reason: string;
    leftValue?: string | null;
    rightValue?: string | null;
    mismatchType?: string | null;
    howToCheck?: string | null;
  }>;
};

export type LlmAdapter = {
  provider: LlmProvider;
  /** Returns raw JSON from the model; the caller validates it with Zod. */
  extract(request: ExtractionRequest): Promise<unknown>;
  /** Returns raw JSON from the model; the caller validates it with Zod. */
  explain(request: ExplainRequest): Promise<unknown>;
};

/** Errors we are willing to surface (as a code, never a raw provider message). */
export class LlmError extends Error {
  code: "PROVIDER_NOT_CONFIGURED" | "PROVIDER_ERROR" | "RATE_LIMITED" | "SCHEMA_INVALID";

  constructor(code: LlmError["code"], message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

export function getAdapter(): LlmAdapter {
  const env = readEnv();

  if (env.provider === "anthropic") {
    if (!env.anthropicApiKey) {
      throw new LlmError("PROVIDER_NOT_CONFIGURED", "anthropic key missing");
    }
    if (!env.model) {
      throw new LlmError("PROVIDER_NOT_CONFIGURED", "LLM_MODEL is not set");
    }
    return {
      provider: "anthropic",
      extract: (request) =>
        anthropicExtract({ apiKey: env.anthropicApiKey!, model: env.model!, ...request }),
      explain: (request) =>
        anthropicExplain({ apiKey: env.anthropicApiKey!, model: env.model!, ...request }),
    };
  }

  if (!env.geminiApiKey) {
    throw new LlmError("PROVIDER_NOT_CONFIGURED", "gemini key missing");
  }
  if (!env.model) {
    throw new LlmError("PROVIDER_NOT_CONFIGURED", "LLM_MODEL is not set");
  }
  return {
    provider: "gemini",
    extract: (request) => geminiExtract({ apiKey: env.geminiApiKey!, model: env.model!, ...request }),
    explain: (request) => geminiExplain({ apiKey: env.geminiApiKey!, model: env.model!, ...request }),
  };
}

/** Non-sensitive configuration summary for /api/health. */
export function llmStatus() {
  const env = readEnv();
  return {
    demoMode: env.demoMode,
    provider: env.provider,
    configured:
      env.provider === "gemini" ? Boolean(env.geminiApiKey) : Boolean(env.anthropicApiKey),
    modelConfigured: Boolean(env.model),
    explainLlmEnabled: env.explainLlmEnabled,
  };
}

/** Strip markdown fences and surrounding prose that models sometimes add. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmError("SCHEMA_INVALID", "model did not return JSON");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new LlmError("SCHEMA_INVALID", "model returned invalid JSON");
  }
}

/** Shared fetch wrapper: short timeout, no logging of request contents. */
export async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: string; timeoutMs?: number },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 45_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: init.body,
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new LlmError("RATE_LIMITED", "provider rate limit");
    }
    if (!response.ok) {
      // Deliberately discard the provider body: it can echo the image or fields.
      throw new LlmError("PROVIDER_ERROR", `provider responded ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof LlmError) throw error;
    throw new LlmError("PROVIDER_ERROR", "provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}
