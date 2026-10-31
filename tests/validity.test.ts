import { describe, expect, it } from "vitest";
import { certificateAgeMonths, checkValidity } from "@/lib/match/validity";

describe("checkValidity", () => {
  const asOf = "2026-10-31";

  it("returns UNVERIFIABLE when the rule has no verified limit", () => {
    const result = checkValidity({ issueDate: "01/01/2024", asOf, maxAgeMonths: null });
    expect(result.status).toBe("UNVERIFIABLE");
    expect(result.reason).toMatch(/not confirmed/i);
  });

  it("MATCH when inside the window", () => {
    const result = checkValidity({ issueDate: "01/01/2026", asOf, maxAgeMonths: 12 });
    expect(result.status).toBe("MATCH");
    expect(result.issueDate).toBe("2026-01-01");
  });

  it("CRITICAL (CERT_EXPIRED) when outside the window", () => {
    const result = checkValidity({ issueDate: "01/01/2023", asOf, maxAgeMonths: 12 });
    expect(result.status).toBe("CRITICAL");
    expect(result.mismatchType).toBe("CERT_EXPIRED");
  });

  it("an explicit validUntil date decides over the age rule", () => {
    expect(
      checkValidity({ issueDate: "01/01/2020", validUntil: "31/12/2027", asOf, maxAgeMonths: 12 })
        .status,
    ).toBe("MATCH");
    expect(
      checkValidity({ issueDate: "01/01/2026", validUntil: "31/12/2025", asOf, maxAgeMonths: 12 })
        .status,
    ).toBe("CRITICAL");
  });

  it("returns UNVERIFIABLE when the issue date is unreadable", () => {
    const result = checkValidity({ issueDate: null, asOf, maxAgeMonths: 12 });
    expect(result.status).toBe("UNVERIFIABLE");
    expect(result.mismatchType).toBe("UNREADABLE");
  });

  it("counts age in whole months", () => {
    expect(certificateAgeMonths("2025-10-31", "2026-10-31")).toBe(12);
    expect(certificateAgeMonths("2026-09-01", "2026-10-31")).toBe(1);
  });
});
