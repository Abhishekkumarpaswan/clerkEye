import {
  DOC_TYPE_LABELS,
  type DocType,
  type ExtractedDocument,
  type FieldName,
} from "@/lib/extract/schemas";
import { compareAddress } from "@/lib/match/address";
import { compareDob } from "@/lib/match/dob";
import { compareNames } from "@/lib/match/name";
import { matchFieldText } from "@/lib/match/generic";
import { SEVERITY_RANK, Status } from "@/lib/match/types";
import { checkValidity } from "@/lib/match/validity";
import type {
  CheckContext,
  FieldMatchRule,
  Finding,
  FindingSide,
  Rule,
  RuleSource,
  Scheme,
  UnverifiableRule,
  ValidityRule,
} from "./types";

const NAME_FIELDS = new Set(["applicantName", "fatherName", "bankAccountHolder"]);
const DATE_FIELDS = new Set(["dob", "issueDate", "validUntil"]);

function fieldValue(doc: ExtractedDocument, field: string): string | null {
  const fields = doc.fields as unknown as Record<string, { value: string | null } | undefined>;
  return fields[field]?.value ?? null;
}

function sideOf(docType: DocType, field: string, doc: ExtractedDocument): FindingSide {
  return { doc: docType, field, value: fieldValue(doc, field) };
}

function missingDocumentFinding(rule: FieldMatchRule, missing: DocType, presentDocs: DocType[]): Finding {
  return {
    ruleId: rule.id,
    rowKey: `${rule.id}:${missing}`,
    check: rule.label,
    documents: presentDocs,
    status: "UNVERIFIABLE",
    score: null,
    mismatchType: null,
    reason: `The ${DOC_TYPE_LABELS[missing]} was not uploaded, so this check could not run.`,
    source: rule.source,
  };
}

function unreadableFinding(rule: FieldMatchRule, left: FindingSide, right: FindingSide): Finding {
  return {
    ruleId: rule.id,
    rowKey: `${rule.id}:${left.doc}>${right.doc}`,
    check: rule.label,
    documents: [left.doc, right.doc],
    left,
    right,
    status: "UNVERIFIABLE",
    score: null,
    mismatchType: "UNREADABLE",
    reason: `This value could not be read on the ${DOC_TYPE_LABELS[left.doc]} or the ${DOC_TYPE_LABELS[right.doc]}, so the check could not run.`,
    source: rule.source,
  };
}

/** Compare one pair of sides for a `field_match` rule. */
function compareSides(
  rule: FieldMatchRule,
  leftDoc: ExtractedDocument,
  rightDoc: ExtractedDocument,
  leftField: string,
  rightField: string,
): Finding {
  const left = sideOf(leftDoc.docType, leftField, leftDoc);
  const right = sideOf(rightDoc.docType, rightField, rightDoc);

  if (!left.value || !right.value) return unreadableFinding(rule, left, right);

  let status: Status;
  let score: number | null = null;
  let mismatchType: string | null = null;
  let reason: string;

  if (NAME_FIELDS.has(leftField)) {
    const result = compareNames(left.value, right.value);
    status = result.status;
    score = result.score;
    mismatchType = result.mismatchType;
    reason = result.reason;
  } else if (DATE_FIELDS.has(leftField)) {
    const result = compareDob(left.value, right.value);
    status = result.status;
    mismatchType = result.mismatchType;
    reason = result.reason;
  } else if (leftField === "address" || leftField === "pin") {
    // The PIN is often printed on its own line, so include it when comparing
    // addresses — otherwise a correct address looks like it has no PIN at all.
    const withPin = (doc: ExtractedDocument, value: string) => {
      const pin = fieldValue(doc, "pin");
      return pin && !value.includes(pin) ? `${value} ${pin}` : value;
    };
    const result = compareAddress(
      withPin(leftDoc, left.value),
      withPin(rightDoc, right.value),
      {
        maxSeverity: rule.maxSeverity ?? "WARNING",
      },
    );
    status = result.status;
    score = result.score;
    mismatchType = result.mismatchType;
    reason = result.reason;
  } else {
    const result = matchFieldText(left.value, right.value);
    status = result.status;
    score = result.score;
    mismatchType = result.mismatchType;
    reason = result.reason;
  }

  // A rule decides how bad a failure is; MATCH and UNVERIFIABLE pass through.
  if (status === "WARNING" || status === "CRITICAL") {
    status = rule.failSeverity;
  }
  if (rule.maxSeverity && SEVERITY_RANK[status] > SEVERITY_RANK[rule.maxSeverity]) {
    status = rule.maxSeverity;
  }

  return {
    ruleId: rule.id,
    rowKey: `${rule.id}:${left.doc}>${right.doc}`,
    check: rule.label,
    documents: [left.doc, right.doc],
    left,
    right,
    status,
    score,
    mismatchType,
    reason,
    source: rule.source,
  };
}

function runFieldMatch(
  rule: FieldMatchRule,
  byDoc: Map<DocType, ExtractedDocument>,
): Finding[] {
  const findings: Finding[] = [];
  const present = [...byDoc.keys()];

  const pairs: Array<[DocType, string, DocType, string]> = [];
  if (rule.left && rule.right) {
    pairs.push([rule.left.doc, rule.left.field, rule.right.doc, rule.right.field]);
  }
  if (rule.pairs && rule.field) {
    for (const [a, b] of rule.pairs) {
      pairs.push([a, rule.field, b, rule.field]);
    }
  }

  for (const [docA, fieldA, docB, fieldB] of pairs) {
    const leftDoc = byDoc.get(docA);
    const rightDoc = byDoc.get(docB);
    if (!leftDoc) {
      findings.push(missingDocumentFinding(rule, docA, present));
      continue;
    }
    if (!rightDoc) {
      findings.push(missingDocumentFinding(rule, docB, present));
      continue;
    }
    findings.push(compareSides(rule, leftDoc, rightDoc, fieldA, fieldB));
  }

  return findings;
}

function runValidity(rule: ValidityRule, byDoc: Map<DocType, ExtractedDocument>, ctx: CheckContext): Finding {
  const doc = byDoc.get(rule.doc);
  const left = doc ? sideOf(rule.doc, rule.field, doc) : undefined;

  if (!doc) {
    return {
      ruleId: rule.id,
      rowKey: `${rule.id}:${rule.doc}`,
      check: rule.label,
      documents: [],
      status: "UNVERIFIABLE",
      score: null,
      mismatchType: null,
      reason: `The ${DOC_TYPE_LABELS[rule.doc]} was not uploaded, so this check could not run.`,
      source: rule.source,
    };
  }

  const result = checkValidity({
    issueDate: { value: left?.value ?? null, script: "unknown" },
    validUntil: { value: fieldValue(doc, "validUntil"), script: "unknown" },
    asOf: ctx.asOf,
    maxAgeMonths: rule.max_age_months,
  });

  return {
    ruleId: rule.id,
    rowKey: `${rule.id}:${rule.doc}`,
    check: rule.label,
    documents: [rule.doc],
    left,
    status: result.status,
    score: null,
    mismatchType: result.mismatchType,
    reason: result.reason,
    source: rule.source,
  };
}

function runNote(rule: UnverifiableRule): Finding {
  return {
    ruleId: rule.id,
    rowKey: `${rule.id}:note`,
    check: rule.label,
    documents: [],
    status: "UNVERIFIABLE",
    score: null,
    mismatchType: null,
    reason: "This cannot be seen from the documents you upload.",
    howToCheck: rule.howToCheck,
    source: rule.source,
  };
}

function runRule(rule: Rule, byDoc: Map<DocType, ExtractedDocument>, ctx: CheckContext): Finding[] {
  switch (rule.type) {
    case "field_match":
      return runFieldMatch(rule, byDoc);
    case "validity":
      return [runValidity(rule, byDoc, ctx)];
    case "unverifiable_note":
      return [runNote(rule)];
    default: {
      const exhaustive: never = rule;
      return exhaustive;
    }
  }
}

const STATUS_ORDER: Record<Status, number> = {
  CRITICAL: 0,
  WARNING: 1,
  UNVERIFIABLE: 2,
  MATCH: 3,
};

/**
 * Run every rule in a scheme against a set of extracted documents.
 *
 * Pure: no I/O, no clock (the reference date comes from `ctx`), no randomness.
 * The result is sorted worst-first so the UI can render it directly.
 */
export function runChecks(
  documents: ExtractedDocument[],
  scheme: Scheme,
  ctx: CheckContext,
): Finding[] {
  const byDoc = new Map<DocType, ExtractedDocument>();
  for (const doc of documents) {
    byDoc.set(doc.docType, doc);
  }

  const findings = scheme.rules.flatMap((rule) => runRule(rule, byDoc, ctx));

  return findings.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

/** Counts per status, for the summary line and the print sheet. */
export function summariseFindings(findings: Finding[]): Record<Status, number> {
  const counts: Record<Status, number> = {
    MATCH: 0,
    WARNING: 0,
    CRITICAL: 0,
    UNVERIFIABLE: 0,
  };
  for (const finding of findings) {
    counts[finding.status] += 1;
  }
  return counts;
}

export function findFinding(findings: Finding[], ruleId: string): Finding | undefined {
  return findings.find((finding) => finding.ruleId === ruleId);
}

export type { Finding, FindingSide, RuleSource, Scheme, CheckContext, FieldName };
