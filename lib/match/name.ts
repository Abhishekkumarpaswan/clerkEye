import { MATCH_CONFIG } from "./config";
import { phoneticallyEqual } from "./phonetic";
import { jaroWinkler } from "./similarity";
import { toScriptText, tokenizeName } from "./text";
import type {
  FieldLike,
  MismatchType,
  NameComparison,
  Status,
  TokenAlignment,
} from "./types";

type Token = { text: string; initial: boolean };

function tokensOf(field: FieldLike): { tokens: Token[]; latin: string | null; usedInitials: boolean } {
  const { latin } = toScriptText(field);
  if (!latin) return { tokens: [], latin: null, usedInitials: false };
  const { tokens, usedInitials } = tokenizeName(latin);
  return {
    tokens: tokens.map((text) => ({ text, initial: text.length === 1 })),
    latin,
    usedInitials,
  };
}

/**
 * True when one token is the other plus one or two trailing vowels *after a
 * consonant* — "Kumar"/"Kumari", "Dev"/"Devi", "Ram"/"Rama".
 *
 * Those are different name parts in India (often different gender), so they
 * score as a spelling variant. A vowel added after an existing vowel is just a
 * spelling wobble ("Priya"/"Priyaa") and stays a full match.
 */
function differsByTrailingVowel(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length === 0 || longer === shorter) return false;
  if (!longer.startsWith(shorter)) return false;
  if (!/[bcdfghjklmnpqrstvwxyz]$/.test(shorter)) return false;
  const suffix = longer.slice(shorter.length);
  return suffix.length <= 2 && /^[aeiou]+$/.test(suffix);
}

/** Whether two tokens are the *same name part* (exact or phonetically equal). */
function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  if (differsByTrailingVowel(a, b)) return false;
  return phoneticallyEqual(a, b);
}

/** Score a single token pair per SPEC.md §11.2. */
export function scoreTokenPair(a: Token, b: Token): { score: number; kind: TokenAlignment["kind"] } {
  if (a.text === b.text) return { score: 1, kind: "exact" };
  // An initial only ever matches the first letter of a full token — never
  // another initial (identical initials were caught by the exact check above).
  if (a.initial !== b.initial) {
    const initial = a.initial ? a.text : b.text;
    const full = a.initial ? b.text : a.text;
    if (full.startsWith(initial)) return { score: MATCH_CONFIG.initialScore, kind: "initial" };
    return { score: 0, kind: "none" };
  }
  if (phoneticallyEqual(a.text, b.text)) {
    // Phonetic equality is full credit, with one exception: a token that is the
    // other plus a trailing vowel is a different name part in India, not a
    // spelling slip — "Kumar"/"Kumari", "Dev"/"Devi", "Ram"/"Rama". Those only
    // score as a spelling variant so they surface as a WARNING.
    if (differsByTrailingVowel(a.text, b.text)) {
      return { score: MATCH_CONFIG.spellingScore, kind: "spelling" };
    }
    return { score: 1, kind: "phonetic" };
  }
  const jw = jaroWinkler(a.text, b.text);
  if (jw >= MATCH_CONFIG.jaroWinklerSpelling) {
    return { score: MATCH_CONFIG.spellingScore, kind: "spelling" };
  }
  return { score: 0, kind: "none" };
}

/**
 * Greedy best-first alignment: pick the highest-scoring unused pair repeatedly.
 * Deterministic: ties break on index order.
 */
function align(a: Token[], b: Token[]): TokenAlignment[] {
  const pairs: Array<{ i: number; j: number; score: number; kind: TokenAlignment["kind"] }> = [];
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const { score, kind } = scoreTokenPair(a[i], b[j]);
      if (score > 0) pairs.push({ i, j, score, kind });
    }
  }
  pairs.sort((x, y) => y.score - x.score || x.i - y.i || x.j - y.j);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const result: TokenAlignment[] = [];
  const assignedA = new Map<number, TokenAlignment>();

  for (const pair of pairs) {
    if (usedA.has(pair.i) || usedB.has(pair.j)) continue;
    usedA.add(pair.i);
    usedB.add(pair.j);
    const alignment: TokenAlignment = {
      token: a[pair.i].text,
      matchedWith: b[pair.j].text,
      score: pair.score,
      kind: pair.kind,
    };
    assignedA.set(pair.i, alignment);
  }

  for (let i = 0; i < a.length; i += 1) {
    result.push(
      assignedA.get(i) ?? { token: a[i].text, matchedWith: null, score: 0, kind: "none" },
    );
  }
  return result;
}

function multisetEqual(a: Token[], b: Token[]): boolean {
  if (a.length !== b.length) return false;
  const remaining = b.map((t) => t.text);
  return a.every((token) => {
    const index = remaining.findIndex((text) => sameToken(token.text, text));
    if (index === -1) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function lastNonInitial(tokens: Token[]): Token | null {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (!tokens[i].initial) return tokens[i];
  }
  return null;
}

/**
 * Compare two names.
 *
 * `a` and `b` may be plain strings or extraction fields (`{value, romanized,
 * script}`), in which case the Latin-script form is used.
 */
export function compareNames(a: FieldLike, b: FieldLike): NameComparison {
  const left = tokensOf(a);
  const right = tokensOf(b);

  const base: NameComparison = {
    status: "UNVERIFIABLE",
    score: 0,
    mismatchType: null,
    reason: "",
    tokensA: left.tokens.map((t) => t.text),
    tokensB: right.tokens.map((t) => t.text),
    alignments: [],
    surnameOk: false,
    usedInitials: left.usedInitials || right.usedInitials,
  };

  if (left.tokens.length === 0 || right.tokens.length === 0) {
    return {
      ...base,
      status: "UNVERIFIABLE",
      mismatchType: "UNREADABLE",
      reason: "One of the two names is missing or unreadable, so it cannot be compared.",
    };
  }

  // 1. Same tokens (phonetically) on both sides.
  if (multisetEqual(left.tokens, right.tokens)) {
    // Same parts in the same positions. Phonetic equality counts as "same part",
    // so "Rajesh Kumar Varma" vs "Rajesh Kumar Verma" is a MATCH, not a re-order.
    const sameOrder = left.tokens.every((token, index) => {
      const other = right.tokens[index];
      if (!other || token.initial !== other.initial) return false;
      return scoreTokenPair(token, other).score === 1;
    });
    if (sameOrder) {
      return {
        ...base,
        status: "MATCH",
        score: 1,
        reason: `The names match: "${left.latin}" and "${right.latin}".`,
        alignments: align(left.tokens, right.tokens),
        surnameOk: true,
      };
    }
    return {
      ...base,
      status: "WARNING",
      score: 1,
      mismatchType: "NAME_ORDER",
      reason: `The same name parts appear in a different order: "${left.latin}" and "${right.latin}".`,
      alignments: align(left.tokens, right.tokens),
      surnameOk: true,
    };
  }

  // 2. Align token by token.
  const alignments = align(left.tokens, right.tokens);
  const sum = alignments.reduce((total, item) => total + item.score, 0);
  const coverage = sum / Math.max(left.tokens.length, right.tokens.length);

  const surnameLeft = lastNonInitial(left.tokens);
  const surnameRight = lastNonInitial(right.tokens);
  const surnamePair = surnameLeft && surnameRight ? scoreTokenPair(surnameLeft, surnameRight) : null;
  const surnameOk = Boolean(surnamePair && surnamePair.score >= MATCH_CONFIG.surnameMinScore);

  const usedInitials = alignments.some((item) => item.kind === "initial");
  const droppedTokens = left.tokens.length !== right.tokens.length;
  const spellingVariants = alignments.some((item) => item.kind === "spelling" || item.kind === "phonetic");

  let status: Status;
  let mismatchType: MismatchType | null = null;

  // The given name must at least start with the same letter: "Rajesh Kumar" vs
  // "Suresh Kumar" shares only a surname and is a different person, not a
  // clerical variant (see DECISIONS.md D-20).
  const firstA = left.tokens[0];
  const firstB = right.tokens[0];
  const givenNameAligns = firstA && firstB ? scoreTokenPair(firstA, firstB).score >= MATCH_CONFIG.initialScore : false;

  if (coverage >= MATCH_CONFIG.matchCoverage && !usedInitials && !spellingVariants) {
    status = "MATCH";
  } else if (surnameOk && givenNameAligns && coverage >= MATCH_CONFIG.warningCoverage) {
    status = "WARNING";
    if (usedInitials) mismatchType = "NAME_ABBREVIATED";
    else if (droppedTokens) mismatchType = "NAME_MISSING_TOKEN";
    else mismatchType = "NAME_SPELLING_VARIANT";
  } else {
    status = "CRITICAL";
    mismatchType = "NAME_DIFFERENT";
  }

  // A pure spelling variant with full coverage is a match: same name parts, same
  // order, only the spelling differs phonetically.
  if (status === "WARNING" && !usedInitials && !droppedTokens && coverage === 1) {
    status = "MATCH";
    mismatchType = null;
  }

  const detail =
    status === "MATCH"
      ? `"${left.latin}" and "${right.latin}" are treated as the same name (spelling variant).`
      : status === "WARNING"
        ? describeWarning(mismatchType, left.latin, right.latin, alignments)
        : `"${left.latin}" and "${right.latin}" do not look like the same name: the surname does not match or too few name parts align.`;

  return {
    ...base,
    status,
    score: Math.round(coverage * 1000) / 1000,
    mismatchType,
    reason: detail,
    alignments,
    surnameOk,
    usedInitials,
  };
}

function describeWarning(
  type: MismatchType | null,
  left: string | null,
  right: string | null,
  alignments: TokenAlignment[],
): string {
  const missing = alignments.filter((item) => item.kind === "none").map((item) => item.token);
  switch (type) {
    case "NAME_ABBREVIATED": {
      const initials = alignments
        .filter((item) => item.kind === "initial")
        .map((item) => `${item.token} = ${item.matchedWith}`)
        .join(", ");
      return `Initials are used instead of full name parts (${initials}) between "${left}" and "${right}".`;
    }
    case "NAME_MISSING_TOKEN":
      return `One name has a part the other does not (${missing.map((m) => `"${m}"`).join(", ") || "middle name"}) between "${left}" and "${right}".`;
    case "NAME_SPELLING_VARIANT":
      return `The names look like spelling variants of each other: "${left}" and "${right}".`;
    default:
      return `"${left}" and "${right}" differ, but the surname matches.`;
  }
}
