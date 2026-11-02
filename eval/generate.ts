/**
 * Synthetic identity and mutation generator (SPEC.md §14.1–14.2).
 *
 * Deterministic: a fixed seed produces the same 200 identities and the same
 * labelled mutations on every run, so the numbers in eval/report.md are
 * reproducible and comparable across changes.
 *
 * No real person's data is involved. Names are drawn from common Indian given
 * names and surnames; the mutations model the clerical differences that actually
 * appear across Aadhaar, certificates and passbooks.
 */

import { phoneticallyEqual } from "@/lib/match/phonetic";

export type Identity = {
  given: string;
  middle: string | null;
  surname: string;
  /** Latin full name, e.g. "Rajesh Kumar Verma". */
  latin: string;
  /** Devanagari rendering, when we have one for every part. */
  devanagari: string | null;
  latinateRomanization: string | null;
};

export type MutationType =
  | "IDENTICAL"
  | "SPELLING_VARIANT"
  | "ABBREVIATED"
  | "DROPPED_MIDDLE"
  | "REORDERED"
  | "DIFFERENT_SURNAME"
  | "DIFFERENT_GIVEN_NAME";

/** What the engine should return for a mutated pair. */
export type ExpectedClass = "MATCH" | "WARNING" | "CRITICAL";

export type Pair = {
  id: string;
  mutation: MutationType;
  a: string;
  b: string;
  expected: ExpectedClass;
};

/** mulberry32 — small, deterministic PRNG. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GIVEN_M = [
  "Rajesh", "Rakesh", "Suresh", "Mahesh", "Mukesh", "Anil", "Sunil", "Manoj", "Sanjay",
  "Deepak", "Vikram", "Ashok", "Ramesh", "Dinesh", "Naveen", "Pankaj", "Arun", "Vijay",
  "Amit", "Sumit", "Rohit", "Mohit", "Gaurav", "Saurabh", "Nitin", "Sachin", "Yogesh",
  "Krishna", "Shyam", "Ravi", "Ajay", "Vinod", "Pradeep", "Harish", "Naresh",
];

const GIVEN_F = [
  "Sunita", "Anita", "Kavita", "Meena", "Pooja", "Priya", "Neha", "Rekha", "Suman",
  "Sushma", "Aarti", "Shalini", "Kiran", "Jyoti", "Nisha", "Ritu", "Shweta", "Anjali",
  "Deepika", "Sarita", "Manisha", "Vandana", "Lata", "Asha", "Seema", "Mamta", "Babita",
  "Poonam", "Nitu", "Roshni",
];

const MIDDLE_M = ["Kumar", "Chandra", "Prasad", "Lal", "Singh", "Raj", "Dev", "Nath"];
const MIDDLE_F = ["Devi", "Kumari", "Rani", "Bala", "Kaur"];

const SURNAMES = [
  "Verma", "Sharma", "Gupta", "Yadav", "Singh", "Chaudhary", "Choudhary", "Kumar",
  "Mishra", "Pandey", "Tiwari", "Joshi", "Chauhan", "Rathore", "Meena", "Nair",
  "Reddy", "Naidu", "Patel", "Desai", "Shah", "Bansal", "Agarwal", "Jain", "Saini",
  "Kashyap", "Thakur", "Sisodia", "Malhotra", "Kapoor",
];

/**
 * Devanagari renderings for the name parts used above. Kept as an explicit table
 * rather than generated, so the eval does not silently depend on our own
 * transliteration code.
 */
const DEVANAGARI: Record<string, string> = {
  Rajesh: "राजेश", Rakesh: "राकेश", Suresh: "सुरेश", Mahesh: "महेश", Mukesh: "मुकेश",
  Anil: "अनिल", Sunil: "सुनील", Manoj: "मनोज", Sanjay: "संजय", Deepak: "दीपक",
  Vikram: "विक्रम", Ashok: "अशोक", Ramesh: "रमेश", Dinesh: "दिनेश", Naveen: "नवीन",
  Pankaj: "पंकज", Arun: "अरुण", Vijay: "विजय", Amit: "अमित", Sumit: "सुमित",
  Rohit: "रोहित", Mohit: "मोहित", Gaurav: "गौरव", Saurabh: "सौरभ", Nitin: "नितिन",
  Sachin: "सचिन", Yogesh: "योगेश", Krishna: "कृष्णा", Shyam: "श्याम", Ravi: "रवि",
  Ajay: "अजय", Vinod: "विनोद", Pradeep: "प्रदीप", Harish: "हरीश", Naresh: "नरेश",
  Sunita: "सुनीता", Anita: "अनीता", Kavita: "कविता", Meena: "मीना", Pooja: "पूजा",
  Priya: "प्रिया", Neha: "नेहा", Rekha: "रेखा", Suman: "सुमन", Sushma: "सुषमा",
  Aarti: "आरती", Shalini: "शालिनी", Kiran: "किरण", Jyoti: "ज्योति", Nisha: "निशा",
  Ritu: "रीतू", Shweta: "श्वेता", Anjali: "अंजली", Deepika: "दीपिका", Sarita: "सरिता",
  Manisha: "मनीषा", Vandana: "वंदना", Lata: "लता", Asha: "आशा", Seema: "सीमा",
  Mamta: "ममता", Babita: "बबीता", Poonam: "पूनम", Nitu: "नीतू", Roshni: "रोशनी",
  Kumar: "कुमार", Chandra: "चंद्र", Prasad: "प्रसाद", Lal: "लाल", Singh: "सिंह",
  Raj: "राज", Dev: "देव", Nath: "नाथ", Devi: "देवी", Kumari: "कुमारी", Rani: "रानी",
  Bala: "बाला", Kaur: "कौर",
  Verma: "वर्मा", Sharma: "शर्मा", Gupta: "गुप्ता", Yadav: "यादव", Chaudhary: "चौधरी",
  Choudhary: "चौधरी", Mishra: "मिश्रा", Pandey: "पांडेय", Tiwari: "तिवारी",
  Joshi: "जोशी", Chauhan: "चौहान", Rathore: "राठौर", Meena: "मीना", Nair: "नायर",
  Reddy: "रेड्डी", Naidu: "नायडू", Patel: "पटेल", Desai: "देसाई", Shah: "शाह",
  Bansal: "बंसल", Agarwal: "अग्रवाल", Jain: "जैन", Saini: "सैनी", Kashyap: "कश्यप",
  Thakur: "ठाकुर", Sisodia: "सिसोदिया", Malhotra: "मल्होत्रा", Kapoor: "कपूर",
};

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)];
}

function devanagariFor(parts: Array<string | null>): string | null {
  const words = parts.filter((part): part is string => Boolean(part));
  const rendered = words.map((word) => DEVANAGARI[word]);
  return rendered.every(Boolean) ? rendered.join(" ") : null;
}

export function generateIdentities(count = 200, seed = 20261031): Identity[] {
  const random = prng(seed);
  const identities: Identity[] = [];

  for (let index = 0; index < count; index += 1) {
    const female = random() < 0.45;
    const given = female ? pick(random, GIVEN_F) : pick(random, GIVEN_M);
    const middle = random() < 0.75 ? (female ? pick(random, MIDDLE_F) : pick(random, MIDDLE_M)) : null;
    const surname = pick(random, SURNAMES);

    const latin = [given, middle, surname].filter(Boolean).join(" ");
    const romanized = [given, middle, surname]
      .filter((part): part is string => Boolean(part))
      .join(" ");

    identities.push({
      given,
      middle,
      surname,
      latin,
      devanagari: devanagariFor([given, middle, surname]),
      // The Devanagari documents in this eval carry an LLM-style romanization,
      // which is what the extractor is asked to return (SPEC.md §10 rule 3).
      latinateRomanization: romanized,
    });
  }

  return identities;
}

// ---- mutations -------------------------------------------------------------

/** Vowel and consonant swaps that appear on real Indian documents. */
const VOWEL_SWAPS: Array<[RegExp, string]> = [
  [/ee/g, "i"],
  [/oo/g, "u"],
  [/aa/g, "a"],
  [/([bcdfghjklmnpqrstvwxyz])a/g, "$1aa"],
  [/i(?=[bcdfghjklmnpqrstvwxyz])/g, "ee"],
  [/u(?=[bcdfghjklmnpqrstvwxyz])/g, "oo"],
];

const CONSONANT_SWAPS: Array<[RegExp, string]> = [
  [/ch/g, "chh"],
  [/sh/g, "s"],
  [/v/g, "b"],
  [/th/g, "t"],
  [/([bcdfghjklmnpqrstvwxyz])/g, "$1$1"],
  [/k/g, "q"],
];

function applyOnce(word: string, swaps: Array<[RegExp, string]>): string | null {
  for (const [pattern, replacement] of swaps) {
    const next = word.replace(pattern, replacement);
    if (next !== word) return next;
  }
  return null;
}

export function spellingVariant(word: string): string {
  const vowel = applyOnce(word, VOWEL_SWAPS);
  if (vowel) return vowel;
  const consonant = applyOnce(word, CONSONANT_SWAPS);
  if (consonant) return consonant;
  // Last resort: double a consonant in the middle.
  return word.length > 2 ? `${word.slice(0, 2)}${word[2]}${word.slice(2)}` : `${word}x`;
}

/**
 * Abbreviate one part, the way a clerk actually does it: the middle name when
 * there is one, otherwise the given name ("R. Verma"). Abbreviating everything to
 * initials is not a realistic document and would make the label meaningless.
 */
function abbreviateMiddle(identity: Identity): string {
  if (!identity.middle) return `${identity.given[0]}. ${identity.surname}`;
  return `${identity.given} ${identity.middle[0]}. ${identity.surname}`;
}

function differentSurname(identity: Identity, random: () => number): string {
  // The replacement must be a genuinely different surname, not a spelling variant:
  // Chaudhary / Choudhary are the same surname, and calling that pair "CRITICAL"
  // would be a labelling mistake, not an engine mistake.
  let candidate = pick(random, SURNAMES);
  let guard = 0;
  while (
    (candidate === identity.surname || phoneticallyEqual(candidate, identity.surname)) &&
    guard < 50
  ) {
    candidate = pick(random, SURNAMES);
    guard += 1;
  }
  return [identity.given, identity.middle, candidate].filter(Boolean).join(" ");
}

function differentGiven(identity: Identity, random: () => number): string {
  let candidate = pick(random, [...GIVEN_M, ...GIVEN_F]);
  while (candidate === identity.given) candidate = pick(random, [...GIVEN_M, ...GIVEN_F]);
  return [candidate, identity.middle, identity.surname].filter(Boolean).join(" ");
}

/**
 * Build labelled pairs.
 *
 * Expected classes follow SPEC.md §11.2 and the two devised rules recorded in
 * DECISIONS.md (D-20 given-name guard, D-21 trailing-vowel name parts):
 * - a spelling variant of the same parts, same order → MATCH (phonetic equality)
 * - initials or a dropped part → WARNING
 * - reordered parts → WARNING
 * - different surname or different given name → CRITICAL
 */
export function generatePairs(identities: Identity[], seed = 7717): Pair[] {
  const random = prng(seed);
  const pairs: Pair[] = [];
  let counter = 0;

  const push = (mutation: MutationType, a: string, b: string, expected: ExpectedClass) => {
    counter += 1;
    pairs.push({ id: `P${String(counter).padStart(5, "0")}`, mutation, a, b, expected });
  };

  for (const identity of identities) {
    // 1. Identical (control).
    push("IDENTICAL", identity.latin, identity.latin, "MATCH");

    // 2. Spelling variant. The label is set independently of the engine: a
    //    one-character difference in the same name part is a typo (MATCH); a
    //    larger change to the same part is a variant a human should look at
    //    (WARNING). SPEC.md §11.2 has the same intent but is internally
    //    inconsistent for two-token names — see DECISIONS.md D-60.
    const parts = identity.latin.split(" ");
    const target = Math.floor(parts.length / 2);
    const mutate = (part: string) => spellingVariant(part);
    const variantParts = parts.map((part, index) => (index === target ? mutate(part) : part));
    const original = parts[target].toLowerCase();
    const mutated = variantParts[target].toLowerCase();
    // Independent labelling rule, stated in eval/report.md: a variant that still
    // sounds the same is the same name part (MATCH). A variant that no longer
    // sounds the same — even a single-letter change such as Dev/Deb or
    // Verma/Verman — is one a human should look at (WARNING).
    const samePart = phoneticallyEqual(original, mutated);
    push("SPELLING_VARIANT", identity.latin, variantParts.join(" "), samePart ? "MATCH" : "WARNING");

    // 3. Abbreviated (initials).
    push("ABBREVIATED", identity.latin, abbreviateMiddle(identity), "WARNING");

    // 4. Dropped middle name.
    if (identity.middle) {
      push("DROPPED_MIDDLE", identity.latin, `${identity.given} ${identity.surname}`, "WARNING");
    }

    // 5. Reordered parts.
    if (identity.middle) {
      push("REORDERED", identity.latin, `${identity.surname} ${identity.middle} ${identity.given}`, "WARNING");
    }

    // 6. Different surname (different person).
    push("DIFFERENT_SURNAME", identity.latin, differentSurname(identity, random), "CRITICAL");

    // 7. Different given name, same surname (different person).
    push("DIFFERENT_GIVEN_NAME", identity.latin, differentGiven(identity, random), "CRITICAL");
  }

  return pairs;
}

/**
 * Devanagari pairs: the same identities written in Devanagari, with and without
 * a supplied romanization. Used to check the script path end to end.
 */
export function generateScriptPairs(identities: Identity[], limit = 120): Pair[] {
  const pairs: Pair[] = [];
  let counter = 0;

  for (const identity of identities.slice(0, limit)) {
    if (!identity.devanagari) continue;
    counter += 1;
    pairs.push({
      id: `S${String(counter).padStart(4, "0")}`,
      mutation: "IDENTICAL",
      a: identity.devanagari,
      b: identity.latin,
      expected: "MATCH",
    });
    counter += 1;
    pairs.push({
      id: `S${String(counter).padStart(4, "0")}`,
      mutation: "DIFFERENT_SURNAME",
      a: identity.devanagari,
      b: [identity.given, identity.middle, "Sharma"].filter(Boolean).join(" "),
      expected: identity.surname === "Sharma" ? "MATCH" : "CRITICAL",
    });
  }

  return pairs;
}
