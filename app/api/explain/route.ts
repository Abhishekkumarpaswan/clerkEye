import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { explainAll } from "@/lib/explain/templates";
import { getAdapter, LlmError } from "@/lib/llm/adapter";
import type { Finding } from "@/lib/rules/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/explain
 *
 * Receives findings only — no images, no document text beyond the two compared
 * values — and returns one short explanation per finding (SPEC.md §13).
 *
 * The route always answers `ok: true`. When the model is disabled, slow, or
 * returns something that fails validation, it returns the deterministic
 * templates instead, with `source: "template"`. The client therefore never has to
 * handle a failure case here.
 */

const MAX_FINDINGS = 20;
const MAX_FIELD_CHARS = 300;

const RequestSchema = z.object({
  lang: z.enum(["en", "hi"]),
  findings: z
    .array(
      z.object({
        ruleId: z.string().min(1).max(120),
        check: z.string().min(1).max(300),
        status: z.enum(["MATCH", "WARNING", "CRITICAL", "UNVERIFIABLE"]),
        reason: z.string().max(600).default(""),
        leftValue: z.string().max(MAX_FIELD_CHARS).nullable().optional(),
        rightValue: z.string().max(MAX_FIELD_CHARS).nullable().optional(),
        mismatchType: z.string().max(60).nullable().optional(),
        howToCheck: z.string().max(300).nullable().optional(),
      }),
    )
    .min(1)
    .max(MAX_FINDINGS),
});

const ResponseSchema = z.object({
  explanations: z
    .array(
      z.object({
        ruleId: z.string().min(1),
        text: z.string().min(1).max(600),
      }),
    )
    .min(1),
});

/** Rebuild just enough of a Finding for the template writer. */
function toFinding(item: z.infer<typeof RequestSchema>["findings"][number]): Finding {
  const leftDoc =
    item.check.toLowerCase().includes("bank")
      ? "BANK_PASSBOOK"
      : item.check.toLowerCase().includes("marksheet")
        ? "MARKSHEET"
        : item.check.toLowerCase().includes("income")
          ? "INCOME_CERT"
          : "AADHAAR";

  return {
    ruleId: item.ruleId.split(":")[0],
    rowKey: item.ruleId,
    check: item.check,
    documents: [],
    left: item.leftValue ? { doc: leftDoc, field: "value", value: item.leftValue } : undefined,
    right: item.rightValue ? { doc: "AADHAAR", field: "value", value: item.rightValue } : undefined,
    status: item.status,
    score: null,
    mismatchType: item.mismatchType ?? null,
    reason: item.reason,
    howToCheck: item.howToCheck ?? undefined,
  };
}

/** Templates for the *original* rule ids (the client sends `rowKey` ids). */
function templatesFor(
  lang: "en" | "hi",
  items: z.infer<typeof RequestSchema>["findings"],
): Array<{ ruleId: string; text: string }> {
  return items.map((item) => {
    const [first] = explainAll(lang, [toFinding(item)]);
    return { ruleId: item.ruleId, text: first.text };
  });
}

export async function POST(request: Request) {
  const parsedRequest = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "That request could not be read." } },
      { status: 400 },
    );
  }

  const { lang, findings } = parsedRequest.data;
  const templateAnswer = { ok: true as const, source: "template" as const, explanations: templatesFor(lang, findings) };

  const env = readEnv();
  if (!env.explainLlmEnabled) {
    return NextResponse.json(templateAnswer, { headers: { "Cache-Control": "no-store" } });
  }

  let adapter;
  try {
    adapter = getAdapter();
  } catch {
    return NextResponse.json(templateAnswer, { headers: { "Cache-Control": "no-store" } });
  }

  const knownRuleIds = new Set(findings.map((item) => item.ruleId));

  try {
    const raw = await adapter.explain({
      lang,
      findings: findings.map((item) => ({
        ruleId: item.ruleId,
        check: item.check,
        status: item.status,
        reason: item.reason,
        leftValue: item.leftValue ?? null,
        rightValue: item.rightValue ?? null,
        mismatchType: item.mismatchType ?? null,
        howToCheck: item.howToCheck ?? null,
      })),
    });

    const validated = ResponseSchema.safeParse(raw);
    if (!validated.success) {
      return NextResponse.json(templateAnswer, { headers: { "Cache-Control": "no-store" } });
    }

    // Every ruleId must be one we sent; anything else is discarded, and the
    // templates fill the gaps (SPEC.md §13).
    const templates = new Map(templateAnswer.explanations.map((item) => [item.ruleId, item.text]));
    const merged = new Map<string, string>();
    for (const item of validated.data.explanations) {
      if (!knownRuleIds.has(item.ruleId)) continue;
      if (/\b(will be (accepted|rejected)|guaranteed|www\.|http)/i.test(item.text)) continue;
      merged.set(item.ruleId, item.text.trim());
    }

    if (merged.size === 0) {
      return NextResponse.json(templateAnswer, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      {
        ok: true,
        source: merged.size === findings.length ? "llm" : "mixed",
        explanations: findings.map((item) => ({
          ruleId: item.ruleId,
          text: merged.get(item.ruleId) ?? templates.get(item.ruleId) ?? item.reason,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const rateLimited = error instanceof LlmError && error.code === "RATE_LIMITED";
    return NextResponse.json(
      { ...templateAnswer, note: rateLimited ? "rate_limited" : "provider_error" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
