import { describe, expect, it } from "vitest";
import { LANGS, dictKeys, dictFor, isLang, ruleLabel, t, translator } from "@/lib/i18n";
import { ALL_REMEDIES, remedyKeys } from "@/lib/remedies/remedies";

describe("i18n dictionaries", () => {
  it("has exactly the same keys in English and Hindi", () => {
    const en = new Set(dictKeys("en"));
    const hi = new Set(dictKeys("hi"));
    const missingInHi = [...en].filter((key) => !hi.has(key));
    const extraInHi = [...hi].filter((key) => !en.has(key));
    expect(missingInHi, "missing Hindi strings").toEqual([]);
    expect(extraInHi, "Hindi strings with no English source").toEqual([]);
  });

  it("has no empty strings", () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(dictFor(lang))) {
        expect(value.trim(), `${lang}:${key}`).not.toBe("");
      }
    }
  });

  it("translates, interpolates and falls back", () => {
    expect(t("en", "status.MATCH")).toBe("Matches");
    expect(t("hi", "status.MATCH")).toMatch(/[\u0900-\u097F]/);
    expect(t("en", "a11y.stepIndicator", { current: 2, total: 4 })).toBe("Step 2 of 4");
    expect(t("en", "does.not.exist")).toBe("does.not.exist");
    expect(translator("hi")("common.back")).toMatch(/[\u0900-\u097F]/);
  });

  it("recognises languages", () => {
    expect(isLang("hi")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
  });

  it("has a translated label for every rule in the scheme", async () => {
    const { NSP_POST_MATRIC } = await import("@/lib/rules");
    for (const rule of NSP_POST_MATRIC.rules) {
      expect(ruleLabel("en", rule.id, rule.label)).toBe(rule.label);
      const hindi = ruleLabel("hi", rule.id, rule.label);
      expect(hindi, `hi:${rule.id}`).not.toBe(rule.label);
      expect(hindi, `hi:${rule.id}`).toMatch(/[\u0900-\u097F]/);
    }
  });

  it("has bilingual text for every remedy", () => {
    for (const remedy of Object.values(ALL_REMEDIES)) {
      const keys = remedyKeys(remedy);
      for (const lang of LANGS) {
        for (const key of Object.values(keys)) {
          const text = t(lang, key);
          expect(text, `${lang}:${key}`).not.toBe(key);
          expect(text.trim()).not.toBe("");
        }
      }
    }
  });
});
