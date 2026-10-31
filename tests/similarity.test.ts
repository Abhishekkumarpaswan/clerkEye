import { describe, expect, it } from "vitest";
import { jaccard, jaro, jaroWinkler } from "@/lib/match/similarity";
import { phoneticallyEqual, phoneticKeys } from "@/lib/match/phonetic";

describe("jaro / jaroWinkler", () => {
  it("scores identical strings as 1", () => {
    expect(jaro("verma", "verma")).toBe(1);
    expect(jaroWinkler("verma", "verma")).toBe(1);
  });

  it("scores unrelated strings low", () => {
    expect(jaroWinkler("verma", "sharma")).toBeLessThan(0.85);
  });

  it("is symmetric and bounded", () => {
    const pairs: Array<[string, string]> = [
      ["kumar", "kumr"],
      ["anita", "aneeta"],
      ["chaudhary", "choudhary"],
      ["", "abc"],
    ];
    for (const [a, b] of pairs) {
      const ab = jaroWinkler(a, b);
      expect(ab).toBeGreaterThanOrEqual(0);
      expect(ab).toBeLessThanOrEqual(1);
      expect(ab).toBeCloseTo(jaroWinkler(b, a), 10);
    }
  });

  it("rewards a shared prefix", () => {
    expect(jaroWinkler("verma", "vermaa")).toBeGreaterThan(jaro("verma", "vermaa"));
  });
});

describe("jaccard", () => {
  it("handles overlap, empties and disjoint sets", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3, 10);
    expect(jaccard([], [])).toBe(1);
    expect(jaccard(["a"], ["b"])).toBe(0);
  });
});

describe("phonetic keys", () => {
  it("collapses common Indian spelling variants", () => {
    expect(phoneticallyEqual("chaudhary", "choudhary")).toBe(true);
    expect(phoneticallyEqual("verma", "varma")).toBe(true);
    expect(phoneticallyEqual("krishna", "krisna")).toBe(true);
    expect(phoneticallyEqual("lakshmi", "laxmi")).toBe(true);
    expect(phoneticallyEqual("yadav", "jadav")).toBe(true);
  });

  it("keeps clearly different names apart", () => {
    expect(phoneticallyEqual("verma", "sharma")).toBe(false);
    expect(phoneticallyEqual("devi", "kumari")).toBe(false);
    expect(phoneticallyEqual("rajesh", "rakesh")).toBe(false);
  });

  it("returns an empty key for empty input", () => {
    expect(phoneticKeys("")).toEqual({ primary: "", secondary: "" });
  });
});
