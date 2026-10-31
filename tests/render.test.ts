import { describe, expect, it, vi } from "vitest";
// The landing page navigates with the App Router, which has no context in a
// node render. Stub it so the markup can be inspected.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/components/lang-provider";
import { Landing } from "@/components/landing";
import { CheckWizard } from "@/components/check-wizard";
import { ResultMatrixStub } from "./helpers/result-matrix-stub";

/**
 * Render smoke tests. There is no browser in CI here, so these render the client
 * components to static markup: they catch crashes, missing i18n keys and broken
 * ARIA wiring, which is where this app is most likely to break.
 */

function render(node: React.ReactElement, lang: "en" | "hi" = "en") {
  return renderToStaticMarkup(createElement(LangProvider, { initialLang: lang }, node));
}

describe("landing page", () => {
  it("renders the value proposition, the limits box and the consent gate", () => {
    const html = render(createElement(Landing));
    expect(html).toContain("Find the spelling mismatch before the portal does");
    expect(html).toContain("What ClerkEye cannot see");
    expect(html).toContain("Try with sample packet");
    expect(html).toContain('type="checkbox"');
    // No raw i18n keys leak into the output.
    expect(html).not.toMatch(/landing\.cta|limits\.title/);
  });

  it("renders in Hindi with Devanagari text", () => {
    const html = render(createElement(Landing), "hi");
    expect(html).toMatch(/[\u0900-\u097F]/);
    expect(html).not.toMatch(/landing\.cta|limits\.title/);
  });
});

describe("check wizard", () => {
  it("starts on the upload step with four document cards", () => {
    const html = render(createElement(CheckWizard, { autoLoadSample: false }));
    expect(html).toContain("Upload your documents");
    expect(html).toContain("Aadhaar");
    expect(html).toContain("Income certificate");
    expect(html).toContain("Marksheet");
    expect(html).toContain("Bank passbook");
    expect(html).toContain("Step 1 of 4");
    expect(html).not.toMatch(/upload\.title|wizard\.step\.upload/);
  });

  it("marks the first step as current for assistive technology", () => {
    const html = render(createElement(CheckWizard, { autoLoadSample: false }));
    expect(html).toContain('aria-current="step"');
  });
});

describe("result matrix", () => {
  it("renders a row per finding with a status label, not just a colour", () => {
    const html = renderToStaticMarkup(createElement(ResultMatrixStub));
    expect(html).toContain("Likely rejection");
    expect(html).toContain("Can&#x27;t check");
    expect(html).toContain("Unverified rule");
  });
});
