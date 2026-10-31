import { NextResponse } from "next/server";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health probe. Reports only non-sensitive configuration booleans — never key
 * values, never document data.
 */
export async function GET() {
  const env = readEnv();
  const configured =
    env.provider === "gemini" ? Boolean(env.geminiApiKey) : Boolean(env.anthropicApiKey);

  return NextResponse.json({
    ok: true,
    app: "clerkeye",
    time: new Date().toISOString(),
    demoMode: env.demoMode,
    provider: env.provider,
    providerConfigured: configured,
    modelConfigured: Boolean(env.model),
    explainLlmEnabled: env.explainLlmEnabled,
  });
}
