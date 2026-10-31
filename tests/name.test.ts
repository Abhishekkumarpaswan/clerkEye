import { describe, expect, it } from "vitest";
import { compareNames } from "@/lib/match/name";
import { tokenizeName, transliterateDevanagari } from "@/lib/match/text";

/**
 * SPEC.md §11.6 — the required rows.
 */
describe("compareNames — required cases (SPEC.md §11.6)", () => {
  const required: Array<[string, string, string, string | null]> = [
    ["Rajesh Kumar Verma", "Rajesh Kumar Verma", "MATCH", null],
    ["Mohd. Aslam", "Mohammad Aslam", "MATCH", null],
    ["Chaudhary Ram", "Choudhary Ram", "MATCH", null],
    ["R.K. Verma", "Rajesh Kumar Verma", "WARNING", "NAME_ABBREVIATED"],
    ["Rajesh Kumar Verma", "Rajesh Verma", "WARNING", "NAME_MISSING_TOKEN"],
    ["Verma Rajesh Kumar", "Rajesh Kumar Verma", "WARNING", "NAME_ORDER"],
    ["Rajesh Kumar Verma", "Rajesh Kumar Sharma", "CRITICAL", "NAME_DIFFERENT"],
    ["Sunita Devi", "Sunita Kumari", "CRITICAL", "NAME_DIFFERENT"],
  ];

  for (const [a, b, status, type] of required) {
    it(`${a} vs ${b} → ${status}${type ? ` (${type})` : ""}`, () => {
      const result = compareNames(a, b);
      expect(result.status).toBe(status);
      expect(result.mismatchType).toBe(type);
    });
  }

  it("Devanagari with a romanized form matches the Latin spelling", () => {
    const result = compareNames(
      { value: "राजेश कुमार वर्मा", romanized: "Rajesh Kumar Varma", script: "devanagari", confidence: 0.8 },
      "Rajesh Kumar Verma",
    );
    expect(result.status).toBe("MATCH");
  });

  it("is symmetric for the required warning cases", () => {
    for (const [a, b] of [
      ["R.K. Verma", "Rajesh Kumar Verma"],
      ["Rajesh Kumar Verma", "Rajesh Verma"],
      ["Verma Rajesh Kumar", "Rajesh Kumar Verma"],
      ["Rajesh Kumar Verma", "Rajesh Kumar Sharma"],
    ]) {
      expect(compareNames(a, b).status).toBe(compareNames(b, a).status);
    }
  });
});

/**
 * 30+ additional pairs: vowel variants, double consonants, one-letter typos,
 * honorifics, expansions and Devanagari.
 */
describe("compareNames — spelling variants and phonetics", () => {
  const same: Array<[string, string]> = [
    ["Rajesh", "Raajesh"],
    ["Anita", "Aneeta"],
    ["Sunita", "Suneeta"],
    ["Deepak", "Dipak"],
    ["Meena", "Mina"],
    ["Pooja", "Puja"],
    ["Gaurav", "Gourav"],
    ["Sanjay", "Sanjei"],
    ["Ashok", "Ashokk"],
    ["Kiran", "Kirann"],
    ["Kavita", "Kaveeta"],
    ["Naveen", "Navin"],
    ["Manoj", "Manojj"],
    ["Priya", "Priyaa"],
    ["Aarti", "Arti"],
    ["Sunil", "Sunill"],
    ["Amit Kumar Sharma", "Ameet Kumar Sharma"],
    ["Neha Gupta", "Nehaa Gupta"],
    ["Ramesh Chandra Yadav", "Ramesh Chandra Jadhav"],
    ["Bhavna Patel", "Bhavana Patel"],
    ["Sushma Devi", "Sushmaa Devi"],
    ["Devinder Singh", "Devendra Singh"],
    ["Mohammad Aslam", "Md. Aslam"],
    ["Kumar Rajesh", "Kumar Rajesh"],
    ["SHRI Rajesh Kumar Verma", "Rajesh Kumar Verma"],
    ["Smt. Sunita Devi", "Sunita Devi"],
    ["Dr. Ramesh Gupta", "Ramesh Gupta"],
    ["late Mohan Lal", "Mohan Lal"],
    ["Rajesh   Kumar   Verma", "Rajesh Kumar Verma"],
    ["Rajesh Kumar Verma", "rajesh kumar verma"],
    ["R. K. Verma", "R.K. Verma"],
    ["Kr. Rajesh", "Kumar Rajesh"],
    ["Rajesh Kumr Verma", "Rajesh Kumar Verma"],
    ["Krishna Kumar", "Krisna Kumar"],
    ["Lakshmi Nair", "Laxmi Nair"],
  ];

  for (const [a, b] of same) {
    it(`${a} ≙ ${b} → MATCH`, () => {
      const result = compareNames(a, b);
      expect(result.status, result.reason).toBe("MATCH");
    });
  }
});

describe("compareNames — partial and different names", () => {
  const warnings: Array<[string, string, string]> = [
    ["Rajesh Kumar Verma", "Rajesh K. Verma", "NAME_ABBREVIATED"],
    ["Anil Kumar Gupta", "Anil K. Gupta", "NAME_ABBREVIATED"],
    ["S. K. Sharma", "Sunil Kumar Sharma", "NAME_ABBREVIATED"],
    ["Rajesh Kumar Verma", "Rajesh K Verma", "NAME_ABBREVIATED"],
    ["Kumar Rajesh", "Rajesh Kumar", "NAME_ORDER"],
    ["Chaudhary Ram", "Ram Chaudhary", "NAME_ORDER"],
    ["Rajesh Kumar Verma", "Rajesh Verma", "NAME_MISSING_TOKEN"],
    ["Sunita Devi Sharma", "Sunita Sharma", "NAME_MISSING_TOKEN"],
    ["Rajesh Kumar Verman", "Rajesh Kumar Verma", "NAME_SPELLING_VARIANT"],
    ["Sonu Kumar", "Sonu Kumari", "NAME_SPELLING_VARIANT"],
  ];

  for (const [a, b, type] of warnings) {
    it(`${a} vs ${b} → WARNING (${type})`, () => {
      const result = compareNames(a, b);
      expect(result.status, result.reason).toBe("WARNING");
      expect(result.mismatchType).toBe(type);
    });
  }

  const critical: Array<[string, string]> = [
    ["Sunita Devi", "Sunita Kumari"],
    ["Rajesh Kumar Verma", "Rajesh Kumar Sharma"],
    ["Anil Gupta", "Anil Sharma"],
    ["Vandana", "Bandana"],
    ["Rajesh Kumar", "Suresh Kumar"],
    ["Mohd Aslam", "Mohammad Aslam Ansari"],
    ["Kiran Devi", "Kiran Singh"],
  ];

  for (const [a, b] of critical) {
    it(`${a} vs ${b} → CRITICAL`, () => {
      const result = compareNames(a, b);
      expect(result.status, result.reason).toBe("CRITICAL");
      expect(result.mismatchType).toBe("NAME_DIFFERENT");
    });
  }

  it("does not strip kumar / kumari / devi / singh / kaur as honorifics", () => {
    expect(tokenizeName("Kumar Rajesh").tokens).toEqual(["kumar", "rajesh"]);
    expect(tokenizeName("Kaur Simran").tokens).toEqual(["kaur", "simran"]);
    expect(tokenizeName("Devi Sunita").tokens).toEqual(["devi", "sunita"]);
    expect(tokenizeName("Shri Kumar Rajesh").tokens).toEqual(["kumar", "rajesh"]);
  });

  it("returns UNVERIFIABLE when a name is missing", () => {
    expect(compareNames(null, "Rajesh Kumar Verma").status).toBe("UNVERIFIABLE");
    expect(compareNames("", "").status).toBe("UNVERIFIABLE");
    expect(compareNames({ value: null, script: "unknown" }, "Rajesh").status).toBe("UNVERIFIABLE");
  });

  it("never claims a match with an empty token list", () => {
    const result = compareNames("   ", "Rajesh Kumar");
    expect(result.status).toBe("UNVERIFIABLE");
    expect(result.mismatchType).toBe("UNREADABLE");
  });
});

describe("Devanagari handling", () => {
  it("transliterates with word-final schwa deletion", () => {
    expect(transliterateDevanagari("राजेश कुमार वर्मा")).toBe("rajesh kumar varma");
    expect(transliterateDevanagari("सुनीता देवी")).toBe("sunita devi");
    expect(transliterateDevanagari("मोहम्मद असलम")).toContain("mohammad");
  });

  it("matches Devanagari against Latin without a romanized field", () => {
    const result = compareNames("राजेश कुमार वर्मा", "Rajesh Kumar Verma");
    expect(result.status).toBe("MATCH");
  });

  it("matches a purely Devanagari pair", () => {
    expect(compareNames("सुनीता देवी", "सुनीता देवी").status).toBe("MATCH");
    expect(compareNames("सुनीता देवी", "सुनीता कुमारी").status).toBe("CRITICAL");
  });

  it("prefers the extraction romanized value over our transliteration", () => {
    const result = compareNames(
      { value: "राजेश", romanized: "Rajesh", script: "devanagari" },
      "Rajesh",
    );
    expect(result.status).toBe("MATCH");
    expect(result.tokensA).toEqual(["rajesh"]);
  });
});
