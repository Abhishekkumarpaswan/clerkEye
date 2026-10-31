import { DOC_TYPE_LABELS, type DocType } from "@/lib/extract/schemas";
import { t, type Lang } from "@/lib/i18n";
import type { Finding } from "@/lib/rules/types";

/**
 * Deterministic, bilingual explanations.
 *
 * These are the fallback the app always has: `/api/explain` may rewrite them in
 * friendlier language, but if the model is unavailable, slow, or returns
 * something that fails validation, these strings are what the user sees. No
 * explanation is ever required for the app to work (SPEC.md §13).
 */

export type ExplanationSource = "template" | "llm";

export type Explanation = {
  ruleId: string;
  text: string;
  source: ExplanationSource;
};

function docLabel(lang: Lang, doc: DocType): string {
  // Document names are proper nouns in both languages but keep them translatable.
  return t(lang, `docs.${doc}`) || DOC_TYPE_LABELS[doc];
}

function value(value: string | null | undefined, lang: Lang): string {
  if (value == null || value.trim() === "") return t(lang, "confirm.unreadable");
  return value.trim();
}

/** Build the bilingual explanation for one finding from its structured parts. */
export function explainFinding(lang: Lang, finding: Finding): Explanation {
  const parts: string[] = [];

  if (finding.left && finding.right) {
    const both = finding.left.value && finding.left.value === finding.right.value;
    parts.push(
      t(
        lang,
        both ? "explain.pairSame" : "explain.pair",
        {
          leftDoc: docLabel(lang, finding.left.doc),
          left: value(finding.left.value, lang),
          rightDoc: docLabel(lang, finding.right.doc),
          right: value(finding.right.value, lang),
        },
      ),
    );
  } else if (finding.left) {
    parts.push(
      t(lang, "explain.singleDoc", {
        doc: docLabel(lang, finding.left.doc),
        value: value(finding.left.value, lang),
      }),
    );
  }

  if (finding.howToCheck) {
    parts.push(t(lang, "explain.portal"));
    const localized = t(lang, `rule.${finding.ruleId}.howToCheck`);
    parts.push(localized === `rule.${finding.ruleId}.howToCheck` ? finding.howToCheck : localized);
  } else if (finding.mismatchType) {
    const key = `explain.type.${finding.mismatchType}`;
    const text = t(lang, key);
    if (text !== key) parts.push(text);
  } else if (finding.status === "MATCH") {
    parts.push(t(lang, "explain.type.MATCH_OK"));
  }

  if (finding.source && !finding.source.verified) {
    parts.push(t(lang, "explain.unverifiedRule"));
  }

  return { ruleId: finding.ruleId, text: parts.join(" ").trim(), source: "template" };
}

/** Explain every finding (used by the print sheet and by the fallback path). */
export function explainAll(lang: Lang, findings: Finding[]): Explanation[] {
  return findings.map((finding) => explainFinding(lang, finding));
}

/** One-line summary used above the results matrix. */
export function summaryLine(
  lang: Lang,
  counts: { MATCH: number; WARNING: number; CRITICAL: number; UNVERIFIABLE: number },
): string {
  return t(lang, "explain.summary", {
    critical: counts.CRITICAL,
    warning: counts.WARNING,
    unverifiable: counts.UNVERIFIABLE,
    match: counts.MATCH,
  });
}

/** Declaration block: uses only what the user confirmed. */
export function declarationText(
  lang: Lang,
  input: { applicantName: string | null; fatherName: string | null; institute: string },
): string {
  return (
    t(lang, "declaration.intro", {
      applicantName: input.applicantName ?? "________________",
      fatherName: input.fatherName ?? "________________",
      institute: input.institute,
    }) + t(lang, "declaration.outro")
  );
}
