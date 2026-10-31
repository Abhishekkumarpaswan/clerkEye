import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level tests for /api/extract in demo mode: no API key, no network, no
 * model call. These are the paths the demo and the judge take.
 */

async function postExtract(body: unknown) {
  const { POST } = await import("@/app/api/extract/route");
  const request = new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, json: await response.json() };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/extract in demo mode", () => {
  it("returns the demo fixture for a document type", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const started = Date.now();
    const { status, json } = await postExtract({ docType: "AADHAAR" });
    const elapsed = Date.now() - started;

    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.demo).toBe(true);
    expect(json.document.docType).toBe("AADHAAR");
    expect(json.document.fields.applicantName.value).toBeTruthy();
    // The artificial delay keeps the loading states honest (SPEC.md §10).
    expect(elapsed).toBeGreaterThanOrEqual(550);
    expect(elapsed).toBeLessThan(3000);
  });

  it("serves a named packet", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const { json } = await postExtract({ docType: "BANK_PASSBOOK", fixtureId: "bank-name-mismatch" });
    expect(json.document.fields.bankAccountHolder.value).toBe("Rajesh Kumar Sharma");
    expect(json.fixtureId).toBe("bank-name-mismatch");
  });

  it("only ever returns the last 4 digits of an account", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const { json } = await postExtract({ docType: "BANK_PASSBOOK" });
    expect(json.document.fields.accountLast4.value).toMatch(/^\d{4}$/);
    expect(JSON.stringify(json)).not.toMatch(/\d{12}/);
  });

  it("rejects an unknown document type", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const { status, json } = await postExtract({ docType: "PAN_CARD" });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("reports a missing fixture instead of inventing a document", async () => {
    vi.stubEnv("DEMO_MODE", "1");
    const { status, json } = await postExtract({ docType: "AADHAAR", fixtureId: "does-not-exist" });
    expect(status).toBe(404);
    expect(json.error.code).toBe("DEMO_FIXTURE_MISSING");
  });

  it("is demo mode by default with no environment at all", async () => {
    vi.stubEnv("DEMO_MODE", "");
    const { status, json } = await postExtract({ docType: "MARKSHEET" });
    expect(status).toBe(200);
    expect(json.demo).toBe(true);
  });

  it("returns a typed error, not a stack trace, when live mode is not configured", async () => {
    vi.stubEnv("DEMO_MODE", "0");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { status, json } = await postExtract({
      docType: "AADHAAR",
      imageBase64: "aGVsbG8=",
      mimeType: "image/png",
    });
    expect(status).toBe(503);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(JSON.stringify(json)).not.toMatch(/at .*route\.ts/);
  });

  it("rejects an unsupported mime type in live mode", async () => {
    vi.stubEnv("DEMO_MODE", "0");
    vi.stubEnv("GEMINI_API_KEY", "test-key-not-used");
    vi.stubEnv("LLM_MODEL", "some-model");
    const { status, json } = await postExtract({
      docType: "AADHAAR",
      imageBase64: "aGVsbG8=",
      mimeType: "text/plain",
    });
    expect(status).toBe(415);
    expect(json.error.code).toBe("UNSUPPORTED_TYPE");
  });
});
