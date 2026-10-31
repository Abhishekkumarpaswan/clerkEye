import { afterEach, describe, expect, it, vi } from "vitest";

async function postExplain(body: unknown) {
  const { POST } = await import("@/app/api/explain/route");
  const response = await POST(
    new Request("http://localhost/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, json: await response.json() };
}

const FINDINGS = [
  {
    ruleId: "R-001:bank-name-mismatch",
    check: "Bank account holder name must match applicant name",
    status: "CRITICAL",
    reason: "The names do not match.",
    leftValue: "Rajesh Kumar Sharma",
    rightValue: "Rajesh Kumar Verma",
    mismatchType: "NAME_DIFFERENT",
  },
  {
    ruleId: "R-002:note",
    check: "Bank account must be Aadhaar-seeded / NPCI-mapped for payment",
    status: "UNVERIFIABLE",
    reason: "This cannot be seen from the documents you upload.",
    howToCheck: "Ask the bank branch.",
  },
];

afterEach(() => vi.unstubAllEnvs());

describe("/api/explain", () => {
  it("returns templates when the LLM is disabled (the default)", async () => {
    vi.stubEnv("EXPLAIN_LLM", "0");
    const { status, json } = await postExplain({ lang: "en", findings: FINDINGS });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("template");
    expect(json.explanations).toHaveLength(2);
    expect(json.explanations[0].ruleId).toBe(FINDINGS[0].ruleId);
    expect(json.explanations[0].text.length).toBeGreaterThan(10);
  });

  it("returns Hindi templates in Devanagari", async () => {
    vi.stubEnv("EXPLAIN_LLM", "0");
    const { json } = await postExplain({ lang: "hi", findings: FINDINGS });
    expect(json.explanations[0].text).toMatch(/[\u0900-\u097F]/);
  });

  it("falls back to templates when the provider is not configured", async () => {
    vi.stubEnv("EXPLAIN_LLM", "1");
    vi.stubEnv("GEMINI_API_KEY", "");
    const { json } = await postExplain({ lang: "en", findings: FINDINGS });
    expect(json.source).toBe("template");
    expect(json.ok).toBe(true);
  });

  it("rejects a malformed request", async () => {
    const { status } = await postExplain({ lang: "fr", findings: [] });
    expect(status).toBe(400);
  });

  it("rejects more than 20 findings", async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      ...FINDINGS[0],
      ruleId: `R-001:${index}`,
    }));
    const { status } = await postExplain({ lang: "en", findings: many });
    expect(status).toBe(400);
  });

  it("never echoes an over-long value", async () => {
    const { status } = await postExplain({
      lang: "en",
      findings: [{ ...FINDINGS[0], leftValue: "x".repeat(400) }],
    });
    expect(status).toBe(400);
  });
});
