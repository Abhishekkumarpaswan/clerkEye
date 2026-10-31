import { z } from "zod";
import { DocTypeSchema, FieldName, StatusSchema } from "@/lib/extract/schemas";
import { Status } from "@/lib/match/types";

/** A source for a rule. `verified: false` means "a human still has to confirm this". */
export const RuleSourceSchema = z.object({
  url: z.string().default(""),
  note: z.string().default(""),
  verified: z.boolean().default(false),
});
export type RuleSource = z.infer<typeof RuleSourceSchema>;

const FieldRefSchema = z.object({
  doc: DocTypeSchema,
  field: z.string(),
});
export type FieldRef = z.infer<typeof FieldRefSchema>;

/** Compare one field on two documents, or the same field across several pairs. */
export const FieldMatchRuleSchema = z.object({
  id: z.string().min(1),
  type: z.literal("field_match"),
  label: z.string().min(1),
  left: FieldRefSchema.optional(),
  right: FieldRefSchema.optional(),
  pairs: z.array(z.tuple([DocTypeSchema, DocTypeSchema])).optional(),
  field: z.string().optional(),
  /** Status to use when the comparison fails (MATCH/UNVERIFIABLE pass through). */
  failSeverity: StatusSchema.default("WARNING"),
  /** Optional ceiling applied to the produced status. */
  maxSeverity: StatusSchema.optional(),
  source: RuleSourceSchema,
});

export const UnverifiableRuleSchema = z.object({
  id: z.string().min(1),
  type: z.literal("unverifiable_note"),
  label: z.string().min(1),
  howToCheck: z.string().min(1),
  source: RuleSourceSchema,
});

export const ValidityRuleSchema = z.object({
  id: z.string().min(1),
  type: z.literal("validity"),
  label: z.string().min(1),
  doc: DocTypeSchema,
  field: z.string().default("issueDate"),
  /** null = not verified → the check reports UNVERIFIABLE. */
  max_age_months: z.number().int().positive().nullable().default(null),
  source: RuleSourceSchema,
});

export const RuleSchema = z.discriminatedUnion("type", [
  FieldMatchRuleSchema,
  UnverifiableRuleSchema,
  ValidityRuleSchema,
]);
export type Rule = z.infer<typeof RuleSchema>;
export type FieldMatchRule = z.infer<typeof FieldMatchRuleSchema>;
export type UnverifiableRule = z.infer<typeof UnverifiableRuleSchema>;
export type ValidityRule = z.infer<typeof ValidityRuleSchema>;

export const SchemeSchema = z.object({
  scheme: z.string().min(1),
  lastReviewed: z.string().min(1),
  notes: z.string().optional(),
  rules: z.array(RuleSchema).min(1),
});
export type Scheme = z.infer<typeof SchemeSchema>;

export type FindingSide = {
  doc: z.infer<typeof DocTypeSchema>;
  field: string;
  value: string | null;
};

/**
 * A single row in the result matrix (SPEC.md §9).
 *
 * Deviation from the spec's contract, recorded as D-27: `left`/`right` are
 * optional and `documents` lists every document a finding touches. Portal-level
 * notes (rules of type `unverifiable_note`) have no left/right side at all, and
 * forcing a fake document into `left` would have been misleading.
 */
export type Finding = {
  ruleId: string;
  /** Stable React/table key: a rule can produce one row per document pair. */
  rowKey: string;
  check: string;
  documents: z.infer<typeof DocTypeSchema>[];
  left?: FindingSide;
  right?: FindingSide;
  status: Status;
  score: number | null;
  mismatchType: string | null;
  reason: string;
  source?: RuleSource;
  /** Only for unverifiable_note rules: what the student should do instead. */
  howToCheck?: string;
};

export type CheckContext = {
  /** ISO date used by validity checks. Injected so `runChecks` stays pure. */
  asOf: string;
};

export type { FieldName };
