/**
 * Server-side environment access.
 *
 * Everything here is read at request time and never exported to the client
 * bundle. The module deliberately returns *booleans* for credentials so that a
 * key can never leak into a response by accident.
 */

export type LlmProvider = "gemini" | "anthropic";

export type ServerEnv = {
  demoMode: boolean;
  provider: LlmProvider;
  model: string | null;
  geminiApiKey: string | null;
  anthropicApiKey: string | null;
  maxImageBytes: number;
  explainLlmEnabled: boolean;
};

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function readEnv(): ServerEnv {
  const provider: LlmProvider =
    (process.env.LLM_PROVIDER ?? "").trim().toLowerCase() === "anthropic"
      ? "anthropic"
      : "gemini";

  const maxBytes = Number.parseInt(process.env.MAX_IMAGE_BYTES ?? "", 10);

  return {
    demoMode: flag(process.env.DEMO_MODE, true),
    provider,
    model: process.env.LLM_MODEL?.trim() || null,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    maxImageBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 1_500_000,
    explainLlmEnabled: flag(process.env.EXPLAIN_LLM, false),
  };
}
