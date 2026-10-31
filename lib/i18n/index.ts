import en from "./en.json";
import hi from "./hi.json";

/**
 * Tiny i18n layer.
 *
 * Every user-facing string lives in `en.json` / `hi.json` as a flat
 * dot-notation key. Both files must contain exactly the same keys — a unit test
 * enforces it, so a missing Hindi string fails the build rather than silently
 * falling back to English.
 */

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिंदी",
};

/** BCP-47 tags used for speech synthesis and the `<html lang>` attribute. */
export const LANG_TAGS: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

export type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = {
  en: en as Dict,
  hi: hi as Dict,
};

export type TranslateVars = Record<string, string | number>;

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * Translate a key. Falls back to English when a Hindi key is missing (never
 * happens in a passing build) and to the key itself when neither exists, so a
 * typo is visible instead of crashing the UI.
 */
export function t(lang: Lang, key: string, vars?: TranslateVars): string {
  const dict = DICTS[lang] ?? DICTS.en;
  const value = dict[key] ?? DICTS.en[key] ?? key;
  return interpolate(value, vars);
}

/** Translator bound to one language, for use inside components. */
export function translator(lang: Lang) {
  return (key: string, vars?: TranslateVars) => t(lang, key, vars);
}

export type TFunction = ReturnType<typeof translator>;

export function dictFor(lang: Lang): Dict {
  return DICTS[lang] ?? DICTS.en;
}

export function dictKeys(lang: Lang): string[] {
  return Object.keys(dictFor(lang));
}

/** Rule labels are English in `schemes/*.json`; this prefers a translation. */
export function ruleLabel(lang: Lang, ruleId: string, fallback: string): string {
  const key = `rule.${ruleId}.label`;
  const translated = dictFor(lang)[key];
  return translated ?? fallback;
}

export function isLang(value: string | null | undefined): value is Lang {
  return value === "en" || value === "hi";
}
