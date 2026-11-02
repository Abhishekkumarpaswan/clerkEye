import { it } from "vitest";
import { compareNames } from "@/lib/match/name";
import { generateIdentities, generatePairs, generateScriptPairs } from "../eval/generate";

it("diag", () => {
  const ids = generateIdentities(200);
  const rows = [...generatePairs(ids), ...generateScriptPairs(ids)].map((p) => ({ p, r: compareNames(p.a, p.b) }));
  const bad = rows.filter(({ p, r }) => r.status !== p.expected);
  const byType: Record<string, number> = {};
  for (const b of bad) byType[b.p.mutation] = (byType[b.p.mutation] ?? 0) + 1;
  console.log(byType, "total bad", bad.length);
  for (const b of bad.slice(0, 12)) console.log(`${b.p.mutation} | ${b.p.a} / ${b.p.b} → ${b.r.status} (${b.r.mismatchType}) exp ${b.p.expected}`);
});
