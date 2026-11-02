import { doubleMetaphone } from "double-metaphone";

/**
 * Phonetic key wrapper around Double Metaphone.
 *
 * `double-metaphone` is a small, dependency-free implementation. We wrap it so
 * that (a) the rest of the engine never sees the library API and (b) we can apply
 * Indian-English spelling folds (v/w, z/j, ph/f, doubled consonants) before
 * keying. Both the primary and secondary key are kept: two tokens count as
 * phonetically equal when *any* of their keys agree.
 */
export type PhoneticKeys = { primary: string; secondary: string };

const FOLDS: Array<[RegExp, string]> = [
  [/ph/g, "f"],
  [/gh/g, "g"],
  [/kh/g, "k"],
  [/th/g, "t"],
  [/dh/g, "d"],
  [/bh/g, "b"],
  [/chh/g, "ch"],
  [/ksh/g, "ks"],
  [/sh/g, "s"],
  [/([bcdfgjklmnpqrstvwxz])\1+/g, "$1"], // collapsed double consonants
  [/w/g, "v"],
  [/z/g, "j"],
  [/q/g, "k"],
  [/x/g, "ks"],
  [/ng$/g, "n"],
  [/nh$/g, "n"],
];

export function foldConsonants(token: string): string {
  let out = token.toLowerCase();
  for (const [pattern, replacement] of FOLDS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function phoneticKeys(token: string): PhoneticKeys {
  const folded = foldConsonants(token);
  if (!folded) return { primary: "", secondary: "" };
  const [primary, secondary] = doubleMetaphone(folded);
  return { primary: primary || folded, secondary: secondary || primary || folded };
}

/** True when two tokens share at least one phonetic key. */
export function phoneticallyEqual(a: string, b: string): boolean {
  const ka = phoneticKeys(a);
  const kb = phoneticKeys(b);
  if (!ka.primary || !kb.primary) return false;
  const keysA = new Set([ka.primary, ka.secondary].filter(Boolean));
  const keysB = [kb.primary, kb.secondary].filter(Boolean);
  return keysB.some((key) => keysA.has(key));
}
