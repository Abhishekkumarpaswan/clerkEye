import { describe, expect, it } from "vitest";
import { PACKETS } from "@/lib/fixtures";
import { explainAll, summaryLine } from "@/lib/explain/templates";
import { NSP_POST_MATRIC, loadScheme, runChecks, summariseFindings } from "@/lib/rules";
import { remedyForFinding } from "@/lib/remedies/remedies";
import type { ExtractedDocument } from "@/lib/extract/schemas";

const CTX = { asOf: "2026-10-31" };

describe("scheme file", () => {
  it("validates and contains the four required rules plus consistency checks", () => {
    expect(NSP_POST_MATRIC.scheme).toBe("nsp-post-matric");
    const ids = NSP_POST_MATRIC.rules.map((rule) => rule.id);
    for (const id of ["R-001", "R-002", "R-003", "R-004"]) {
      expect(ids).toContain(id);
    }
  });

  it("never claims a source it does not have", () => {
    for (const rule of NSP_POST_MATRIC.rules) {
      if (rule.source.verified) {
        expect(rule.source.url, `${rule.id} is verified but has no URL`).not.toBe("");
      } else {
        expect(rule.source.note.length, `${rule.id} needs a note or a TODO`).toBeGreaterThan(0);
      }
    }
  });

  it("rejects a malformed scheme", () => {
    expect(() => loadScheme({ scheme: "x", lastReviewed: "y", rules: [] })).toThrow();
    expect(() =>
      loadScheme({ scheme: "x", lastReviewed: "y", rules: [{ id: "R", type: "nope" }] }),
    ).toThrow();
  });

  it("keeps the income-certificate validity rule unverified (null limit)", () => {
    const rule = NSP_POST_MATRIC.rules.find((r) => r.id === "R-004");
    expect(rule?.type).toBe("validity");
    if (rule?.type === "validity") {
      expect(rule.max_age_months).toBeNull();
    }
  });
});

describe("runChecks against the demo packets", () => {
  for (const packet of PACKETS) {
    it(`${packet.id}: matches its documented expectations`, () => {
      const findings = runChecks(packet.documents, NSP_POST_MATRIC, CTX);
      expect(findings.length).toBeGreaterThan(0);

      for (const expected of packet.expected) {
        const match = findings.find(
          (finding) =>
            finding.ruleId === expected.ruleId &&
            (!expected.documents ||
              (finding.left !== undefined &&
                finding.right !== undefined &&
                expected.documents.includes(finding.left.doc) &&
                expected.documents.includes(finding.right.doc))),
        );
        expect(
          match,
          `no finding for ${expected.ruleId} ${expected.documents?.join("+") ?? ""}`,
        ).toBeDefined();
        expect(
          match?.status,
          `${expected.ruleId} ${expected.documents?.join("+") ?? ""} → ${match?.status}: ${match?.reason}`,
        ).toBe(expected.status);
      }
    });
  }

  it("produces one row per rule, and one per document pair", () => {
    const packet = PACKETS[0];
    const findings = runChecks(packet.documents, NSP_POST_MATRIC, CTX);
    const keys = findings.map((finding) => finding.rowKey);
    expect(new Set(keys).size).toBe(keys.length);
    // R-003 runs on two pairs.
    expect(findings.filter((f) => f.ruleId === "R-003")).toHaveLength(2);
  });

  it("sorts the worst findings first", () => {
    const packet = PACKETS.find((p) => p.id === "bank-name-mismatch");
    const findings = runChecks(packet!.documents, NSP_POST_MATRIC, CTX);
    expect(findings[0].status).toBe("CRITICAL");
    expect(findings[findings.length - 1].status).toBe("MATCH");
  });

  it("marks a missing document as UNVERIFIABLE rather than guessing", () => {
    const aadhaar = PACKETS[0].documents.find((doc) => doc.docType === "AADHAAR")!;
    const findings = runChecks([aadhaar], NSP_POST_MATRIC, CTX);
    const bank = findings.find((finding) => finding.ruleId === "R-001")!;
    expect(bank.status).toBe("UNVERIFIABLE");
    expect(bank.reason).toContain("was not uploaded");
  });

  it("carries howToCheck for the unverifiable portal notes", () => {
    const findings = runChecks(PACKETS[0].documents, NSP_POST_MATRIC, CTX);
    for (const ruleId of ["R-002", "R-008"]) {
      const finding = findings.find((f) => f.ruleId === ruleId)!;
      expect(finding.status).toBe("UNVERIFIABLE");
      expect(finding.howToCheck).toBeTruthy();
      expect(finding.documents).toHaveLength(0);
    }
  });

  it("summarises counts", () => {
    const findings = runChecks(PACKETS[0].documents, NSP_POST_MATRIC, CTX);
    const counts = summariseFindings(findings);
    expect(counts.MATCH + counts.WARNING + counts.CRITICAL + counts.UNVERIFIABLE).toBe(
      findings.length,
    );
    expect(counts.CRITICAL).toBe(0);
  });

  it("is pure: the same input gives the same output", () => {
    const first = runChecks(PACKETS[2].documents, NSP_POST_MATRIC, CTX);
    const second = runChecks(PACKETS[2].documents, NSP_POST_MATRIC, CTX);
    expect(second).toEqual(first);
  });

  it("does not mutate its input", () => {
    const docs: ExtractedDocument[] = JSON.parse(JSON.stringify(PACKETS[2].documents));
    const snapshot = JSON.parse(JSON.stringify(docs));
    runChecks(docs, NSP_POST_MATRIC, CTX);
    expect(docs).toEqual(snapshot);
  });
});

describe("remedies", () => {
  it("gives every non-match finding a fix that has not been human-reviewed", () => {
    for (const packet of PACKETS) {
      const findings = runChecks(packet.documents, NSP_POST_MATRIC, CTX);
      for (const finding of findings) {
        const remedy = remedyForFinding(finding);
        if (finding.howToCheck) {
          expect(remedy, `${finding.ruleId} is a portal note`).toBeNull();
          continue;
        }
        expect(remedy, `${finding.ruleId} has no remedy`).not.toBeNull();
        expect(remedy!.reviewed).toBe(false);
      }
    }
  });

  it("sends bank-name problems to the bank branch", () => {
    const findings = runChecks(PACKETS[2].documents, NSP_POST_MATRIC, CTX);
    const bank = findings.find((f) => f.ruleId === "R-001")!;
    expect(remedyForFinding(bank)?.id).toBe("REM-NAME-BANK");
  });
});

describe("explanation templates", () => {
  const findings = runChecks(PACKETS[2].documents, NSP_POST_MATRIC, CTX);

  for (const lang of ["en", "hi"] as const) {
    it(`produces non-empty ${lang} explanations for every finding`, () => {
      const explanations = explainAll(lang, findings);
      expect(explanations).toHaveLength(findings.length);
      for (const explanation of explanations) {
        expect(explanation.text.length).toBeGreaterThan(10);
        expect(explanation.source).toBe("template");
        expect(explanation.text).not.toContain("undefined");
      }
    });
  }

  it("writes Hindi explanations in Devanagari", () => {
    const [first] = explainAll("hi", findings);
    expect(first.text).toMatch(/[\u0900-\u097F]/);
  });

  it("summarises in both languages", () => {
    const counts = summariseFindings(findings);
    expect(summaryLine("en", counts)).toContain(String(counts.CRITICAL));
    expect(summaryLine("hi", counts)).toMatch(/[\u0900-\u097F]/);
  });
});
