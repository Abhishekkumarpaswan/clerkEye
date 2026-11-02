import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { compareNames } from "@/lib/match/name";
import { MATCH_CONFIG } from "@/lib/match/config";
import { distance } from "fastest-levenshtein";
import { generateIdentities, generatePairs, generateScriptPairs, type Pair } from "./generate";

/**
 * Matcher evaluation (SPEC.md §14.3–14.5).
 *
 *   pnpm eval:matcher
 *
 * Runs every labelled pair through `compareNames`, computes per-class precision,
 * recall and F1 plus a 4-class confusion matrix, and compares the engine with two
 * baselines on the same pairs. Writes eval/report.md and eval/report.html.
 *
 * The engine never sees the mutation label: it only gets two strings.
 */

const CLASSES = ["MATCH", "WARNING", "CRITICAL", "UNVERIFIABLE"] as const;
type Class = (typeof CLASSES)[number];

type Row = {
  id: string;
  mutation: string;
  a: string;
  b: string;
  expected: Class;
  actual: Class;
  mismatchType: string | null;
  baselineExact: Class;
  baselineLevenshtein: Class;
};

/** Baseline (a): the strings are equal or they are not. */
function exactBaseline(a: string, b: string): Class {
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? "MATCH" : "CRITICAL";
}

/**
 * Baseline (b): plain Levenshtein distance on the whole string.
 * Distance ≤ 2 → MATCH, otherwise CRITICAL. This is the check a developer writes
 * in five minutes, and it is what the app has to beat.
 */
function levenshteinBaseline(a: string, b: string, threshold = 2): Class {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return distance(left, right) <= threshold ? "MATCH" : "CRITICAL";
}

function confusion(rows: Row[], key: "actual" | "baselineExact" | "baselineLevenshtein") {
  const matrix: Record<string, Record<string, number>> = {};
  for (const expected of CLASSES) {
    matrix[expected] = {};
    for (const actual of CLASSES) matrix[expected][actual] = 0;
  }
  for (const row of rows) {
    const predicted = key === "actual" ? row.actual : row[key];
    matrix[row.expected][predicted] += 1;
  }
  return matrix;
}

function perClass(matrix: Record<string, Record<string, number>>) {
  return CLASSES.map((label) => {
    const truePositive = matrix[label]?.[label] ?? 0;
    const predictedTotal = CLASSES.reduce((total, expected) => total + (matrix[expected]?.[label] ?? 0), 0);
    const actualTotal = CLASSES.reduce((total, predicted) => total + (matrix[label]?.[predicted] ?? 0), 0);

    const precision = predictedTotal === 0 ? 0 : truePositive / predictedTotal;
    const recall = actualTotal === 0 ? 0 : truePositive / actualTotal;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    return { label, support: actualTotal, precision, recall, f1 };
  });
}

function accuracy(rows: Row[], key: "actual" | "baselineExact" | "baselineLevenshtein"): number {
  const correct = rows.filter((row) => {
    const predicted = key === "actual" ? row.actual : row[key];
    return predicted === row.expected;
  }).length;
  return rows.length === 0 ? 0 : correct / rows.length;
}

function macroF1(matrix: Record<string, Record<string, number>>): number {
  const scores = perClass(matrix).filter((row) => row.support > 0);
  return scores.reduce((total, row) => total + row.f1, 0) / scores.length;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function toRows(pairs: Pair[]): Row[] {
  return pairs.map((pair) => {
    const result = compareNames(pair.a, pair.b);
    return {
      id: pair.id,
      mutation: pair.mutation,
      a: pair.a,
      b: pair.b,
      expected: pair.expected,
      actual: result.status,
      mismatchType: result.mismatchType,
      baselineExact: exactBaseline(pair.a, pair.b),
      baselineLevenshtein: levenshteinBaseline(pair.a, pair.b),
    };
  });
}

function bar(value: number, max = 1, width = 24): string {
  const filled = Math.round((value / max) * width);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function htmlReport(
  rows: Row[],
  engineMatrix: Record<string, Record<string, number>>,
  baselines: Array<{ name: string; accuracy: number; macroF1: number }>,
  byMutation: Array<{ mutation: string; n: number; engine: number; exact: number; lev: number }>,
  config: Record<string, number>,
): string {
  const bars = byMutation
    .map(
      (row) => `
      <tr>
        <th scope="row">${row.mutation}<br><span class="muted">n = ${row.n}</span></th>
        <td><div class="bar"><span style="width:${(row.engine * 100).toFixed(1)}%"></span></div>${pct(row.engine)}</td>
        <td><div class="bar base"><span style="width:${(row.exact * 100).toFixed(1)}%"></span></div>${pct(row.exact)}</td>
        <td><div class="bar base"><span style="width:${(row.lev * 100).toFixed(1)}%"></span></div>${pct(row.lev)}</td>
      </tr>`,
    )
    .join("");

  const summary = baselines
    .map(
      (baseline) => `
      <tr>
        <th scope="row">${baseline.name}</th>
        <td>${pct(baseline.accuracy)}</td>
        <td>${baseline.macroF1.toFixed(3)}</td>
      </tr>`,
    )
    .join("");

  const matrixRows = CLASSES.map(
    (expected) =>
      `<tr><th scope="row">${expected}</th>${CLASSES.map(
        (actual) =>
          `<td class="${expected === actual ? "diag" : engineMatrix[expected][actual] > 0 ? "off" : ""}">${engineMatrix[expected][actual]}</td>`,
      ).join("")}</tr>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClerkEye — matcher benchmark</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Inter, system-ui, sans-serif; margin: 2rem auto; max-width: 860px; padding: 0 1rem; color: #1b2430; }
  h1 { font-size: 1.5rem; margin-bottom: .25rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  p.lead, .muted { color: #5b6673; font-size: .9rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .75rem; font-size: .9rem; }
  th, td { border: 1px solid #d8dee6; padding: .5rem .6rem; text-align: left; vertical-align: middle; }
  thead th { background: #f4f6f9; }
  .bar { display: inline-block; width: 140px; height: 10px; background: #e8ecf2; border-radius: 5px; margin-right: .5rem; overflow: hidden; vertical-align: middle; }
  .bar span { display: block; height: 100%; background: #2f5aa8; }
  .bar.base span { background: #9aa6b5; }
  td.diag { background: #e9f5ec; font-weight: 600; }
  td.off { background: #fdf1ef; }
  code { background: #f4f6f9; padding: .1rem .3rem; border-radius: 3px; }
</style>
</head>
<body>
  <h1>ClerkEye — matching engine benchmark</h1>
  <p class="lead">${rows.length} labelled name pairs, ${new Set(rows.map((row) => row.mutation)).size} mutation types.
  The engine only ever sees two strings; the labels are used for scoring.</p>

  <h2>Overall</h2>
  <table>
    <thead><tr><th>Method</th><th>Accuracy (4 classes)</th><th>Macro F1</th></tr></thead>
    <tbody>${summary}</tbody>
  </table>

  <h2>Accuracy per mutation type</h2>
  <table>
    <thead><tr><th>Mutation</th><th>ClerkEye</th><th>Exact match</th><th>Levenshtein ≤ 2</th></tr></thead>
    <tbody>${bars}</tbody>
  </table>

  <h2>Confusion matrix (engine)</h2>
  <table>
    <thead><tr><th>expected ↓ / predicted →</th>${CLASSES.map((label) => `<th>${label}</th>`).join("")}</tr></thead>
    <tbody>${matrixRows}</tbody>
  </table>

  <h2>Thresholds in force</h2>
  <p class="muted">From <code>lib/match/config.ts</code>:
  ${Object.entries(config)
    .map(([key, value]) => `${key} = ${value}`)
    .join(" · ")}</p>
</body>
</html>`;
}

describe("matcher evaluation", () => {
  it("beats the baselines on the labelled mutation set", async () => {
    const identities = generateIdentities(200);
    const pairs = [...generatePairs(identities), ...generateScriptPairs(identities)];
    expect(pairs.length).toBeGreaterThanOrEqual(1000);

    const rows = toRows(pairs);

    const engineMatrix = confusion(rows, "actual");
    const exactMatrix = confusion(rows, "baselineExact");
    const levMatrix = confusion(rows, "baselineLevenshtein");

    const engine = {
      accuracy: accuracy(rows, "actual"),
      macroF1: macroF1(engineMatrix),
      perClass: perClass(engineMatrix),
    };
    const exact = { accuracy: accuracy(rows, "baselineExact"), macroF1: macroF1(exactMatrix) };
    const lev = {
      accuracy: accuracy(rows, "baselineLevenshtein"),
      macroF1: macroF1(levMatrix),
    };

    const mutations = [...new Set(rows.map((row) => row.mutation))];
    const byMutation = mutations.map((mutation) => {
      const subset = rows.filter((row) => row.mutation === mutation);
      return {
        mutation,
        n: subset.length,
        engine: accuracy(subset, "actual"),
        exact: accuracy(subset, "baselineExact"),
        lev: accuracy(subset, "baselineLevenshtein"),
      };
    });

    // Per-mismatch-type detection quality for the types the engine can emit.
    const types = [...new Set(rows.map((row) => row.mismatchType).filter(Boolean))] as string[];
    const byType = types.map((type) => {
      const subset = rows.filter((row) => row.mismatchType === type);
      const subsetCorrect = subset.filter((row) => row.actual === row.expected).length;
      return {
        type,
        n: subset.length,
        correct: subsetCorrect,
        precision: subset.length === 0 ? 0 : subsetCorrect / subset.length,
      };
    });

    const report = [
      "# ClerkEye — matcher benchmark",
      "",
      `Generated by \`pnpm eval:matcher\`. ${rows.length} labelled pairs from 200 synthetic`,
      "identities and 7 mutation types (SPEC.md §14). The engine only ever sees the two",
      "strings; the labels are used for scoring only.",
      "",
      "## Headline",
      "",
      "| Method | Accuracy (4 classes) | Macro F1 |",
      "|---|---|---|",
      `| **ClerkEye engine** | **${pct(engine.accuracy)}** | **${engine.macroF1.toFixed(3)}** |`,
      `| Baseline: exact string match | ${pct(exact.accuracy)} | ${exact.macroF1.toFixed(3)} |`,
      `| Baseline: Levenshtein ≤ 2 | ${pct(lev.accuracy)} | ${lev.macroF1.toFixed(3)} |`,
      "",
      `Improvement over exact match: **+${pct(engine.accuracy - exact.accuracy)}** accuracy.`,
      `Improvement over Levenshtein ≤ 2: **+${pct(engine.accuracy - lev.accuracy)}** accuracy.`,
      "",
      "## Per-class quality (engine)",
      "",
      "| Class | Support | Precision | Recall | F1 |",
      "|---|---|---|---|---|",
      ...engine.perClass.map(
        (row) =>
          `| ${row.label} | ${row.support} | ${pct(row.precision)} | ${pct(row.recall)} | ${row.f1.toFixed(3)} |`,
      ),
      "",
      "## Confusion matrix (engine)",
      "",
      `| expected ↓ / predicted → | ${CLASSES.join(" | ")} |`,
      `|${CLASSES.map(() => "---").join("|")}|`,
      ...CLASSES.map(
        (expected) =>
          `| **${expected}** | ${CLASSES.map((actual) => engineMatrix[expected][actual]).join(" | ")} |`,
      ),
      "",
      "## Accuracy per mutation type",
      "",
      "| Mutation | n | ClerkEye | Exact match | Levenshtein ≤ 2 |",
      "|---|---|---|---|---|",
      ...byMutation.map(
        (row) => `| ${row.mutation} | ${row.n} | ${pct(row.engine)} | ${pct(row.exact)} | ${pct(row.lev)} |`,
      ),
      "```",
      "ClerkEye vs baselines (accuracy)",
      ...byMutation.map(
        (row) =>
          `${row.mutation.padEnd(22)} ${bar(row.engine)} ${pct(row.engine).padStart(6)}   (exact ${pct(row.exact)}, lev ${pct(row.lev)})`,
      ),
      "```",
      "",
      "## Mismatch taxonomy as emitted",
      "",
      "| Mismatch type | n | Correct | Precision |",
      "|---|---|---|---|",
      ...byType.map((row) => `| ${row.type} | ${row.n} | ${row.correct} | ${pct(row.precision)} |`),
      "",
      "## Thresholds in force (`lib/match/config.ts`)",
      "",
      "```json",
      JSON.stringify(MATCH_CONFIG, null, 2),
      "```",
      "",
      "## Notes and honest limits",
      "",
      "- Mutation labels are defined independently of the engine and are stated here so",
      "  nothing is tuned silently: a spelling variant is labelled MATCH when the changed",
      "  name part is a one-character edit **or** still sounds the same (Double Metaphone",
      "  key equality), and WARNING otherwise.",
      "- The mutation set is synthetic. Real documents also contain OCR misreads, mixed",
      "  scripts and handwriting that this benchmark does not model.",
      "- `UNVERIFIABLE` has no support here: this benchmark is about name comparison only.",
      "  The unverifiable path is covered by the rule-engine tests.",
      "- Mutation labels are the *spec-intended* answer. Two devised rules widen the gap",
      "  between intention and behaviour and are recorded in DECISIONS.md: D-20 (a",
      "  different given name is CRITICAL even when the surname matches) and D-21 (a",
      "  trailing vowel makes a different name part, e.g. Kumar/Kumari).",
      "- The LLM baseline from SPEC.md §14.4(c) is optional and not run here: it needs an",
      "  API key, and the point of the engine is that it needs none.",
      "",
    ].join("\n");

    await writeFile(path.join(process.cwd(), "eval", "report.md"), report, "utf8");
    await writeFile(
      path.join(process.cwd(), "eval", "report.html"),
      htmlReport(
        rows,
        engineMatrix,
        [
          { name: "ClerkEye engine", ...engine },
          { name: "Baseline: exact string match", ...exact },
          { name: "Baseline: Levenshtein ≤ 2", ...lev },
        ],
        byMutation,
        MATCH_CONFIG as unknown as Record<string, number>,
      ),
      "utf8",
    );

    // Guard rails for CI: the engine must beat both baselines, and must never
    // claim two different people are the same.
    expect(engine.accuracy).toBeGreaterThan(exact.accuracy);
    expect(engine.accuracy).toBeGreaterThan(lev.accuracy);
    expect(engine.accuracy).toBeGreaterThan(0.85);

    const falseMatches = rows.filter(
      (row) =>
        row.expected !== "MATCH" &&
        row.actual === "MATCH",
    );
    // Missing a real difference is the failure this product exists to prevent.
    expect(falseMatches.map((row) => `${row.mutation}: ${row.a} / ${row.b}`)).toEqual([]);
  });
});
