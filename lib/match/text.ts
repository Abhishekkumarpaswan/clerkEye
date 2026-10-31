import sanscript from "@indic-transliteration/sanscript";
import {
  ABBREVIATIONS,
  HONORIFICS,
  NAME_SEPARATORS,
  TRANSLITERATION_MAP,
} from "./config";
import type { FieldLike, Script, ScriptText } from "./types";

const DEVANAGARI = /[\u0900-\u097F]/;
const OTHER_INDIC = /[\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;

export function detectScript(input: string): Script {
  if (!input.trim()) return "unknown";
  if (DEVANAGARI.test(input)) return "devanagari";
  if (OTHER_INDIC.test(input)) return "other";
  if (/[A-Za-z]/.test(input)) return "latin";
  return "unknown";
}

/** Remove combining marks so `rājeśa` → `rajesa`. */
export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");
}

/** NFKC + lowercase, the first step of every comparison. */
export function normalizeUnicode(input: string): string {
  return input.normalize("NFKC").toLowerCase();
}

/**
 * Devanagari → Latin fallback.
 *
 * Extraction is asked to return a `romanized` value; this is only used when it
 * did not. Harvard-Kyoto is used because its long vowels are uppercase, which
 * lets us delete the word-final schwa (the `a` Hindi does not pronounce) before
 * folding `A` → `a`.
 */
export function transliterateDevanagari(input: string): string {
  let out: string;
  try {
    out = sanscript.t(input, "devanagari", "hk");
  } catch {
    return input;
  }

  const words = out.split(/\s+/).filter(Boolean).map((word) => {
    const trimmed = /[a-z]$/.test(word) ? word.slice(0, -1) : word;
    return trimmed;
  });

  let latin = words.join(" ");
  for (const [pattern, replacement] of TRANSLITERATION_MAP) {
    latin = latin.replace(pattern, replacement);
  }
  return stripDiacritics(latin.toLowerCase());
}

/**
 * Resolve any field-like value to a comparable Latin form.
 * Order of preference: printed Latin value → LLM `romanized` → our transliteration.
 */
export function toScriptText(field: FieldLike): ScriptText {
  if (field == null) {
    return { latin: null, printed: null, script: "unknown", transliterated: false };
  }

  if (typeof field === "string") {
    const printed = field.trim() || null;
    if (!printed) {
      return { latin: null, printed: null, script: "unknown", transliterated: false };
    }
    const script = detectScript(printed);
    if (script === "latin") {
      return { latin: printed, printed, script, transliterated: false };
    }
    if (script === "devanagari") {
      return {
        latin: transliterateDevanagari(printed),
        printed,
        script,
        transliterated: true,
      };
    }
    return { latin: printed, printed, script, transliterated: false };
  }

  const printed = field.value?.trim() || null;
  const declared = field.script ?? (printed ? detectScript(printed) : "unknown");
  const romanized = field.romanized?.trim() || null;

  if (declared === "latin" || (!romanized && printed && detectScript(printed) === "latin")) {
    return {
      latin: printed ?? romanized,
      printed,
      script: declared === "unknown" ? "latin" : declared,
      transliterated: false,
    };
  }

  if (romanized) {
    return { latin: romanized, printed, script: declared, transliterated: false };
  }

  if (printed && detectScript(printed) === "devanagari") {
    return {
      latin: transliterateDevanagari(printed),
      printed,
      script: declared,
      transliterated: true,
    };
  }

  return { latin: printed, printed, script: declared, transliterated: false };
}

const HONORIFIC_SET = new Set<string>(HONORIFICS);

/** Expand a single token using the configurable abbreviation map. */
export function expandToken(token: string): string {
  return ABBREVIATIONS[token] ?? token;
}

/**
 * Split a name into comparable tokens.
 * - punctuation/underscores become spaces
 * - honorifics are dropped, but only at the start of the name
 * - abbreviations are expanded
 * - a one-character token is an initial
 */
export function tokenizeName(input: string): { tokens: string[]; usedInitials: boolean } {
  const cleaned = normalizeUnicode(stripDiacritics(input))
    .replace(NAME_SEPARATORS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return { tokens: [], usedInitials: false };

  let raw = cleaned.split(" ").filter(Boolean);
  while (raw.length > 1 && HONORIFIC_SET.has(raw[0])) {
    raw = raw.slice(1);
  }

  const tokens: string[] = [];
  let usedInitials = false;
  for (const token of raw) {
    if (token.length === 1) {
      usedInitials = true;
      tokens.push(token);
      continue;
    }
    const expanded = expandToken(token);
    tokens.push(expanded);
  }

  return { tokens, usedInitials };
}

/** Latin, lowercase, punctuation-free form of an address line. */
export function normalizeAddressText(input: string): string {
  return normalizeUnicode(stripDiacritics(input))
    .replace(NAME_SEPARATORS, " ")
    .replace(/\s+/g, " ")
    .trim();
}
