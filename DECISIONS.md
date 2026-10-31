# DECISIONS.md — ClerkEye

Every choice that the spec left open, and every deviation, is recorded here with a
short reason. Newest milestone at the bottom.

## Legend

- **D-nn** — decision id.
- "Spec" refers to `SPEC.md`; section numbers match it.

---

## M0 — Scaffold

**D-01 — Next.js 16.4 App Router, TypeScript strict, Tailwind v4.**
Created with `create-next-app@latest` (Next 16.4.3, React 19.3, Turbopack, Tailwind 4).
Strict mode is on, `paths: {"@/*": ["./*"]}` so all imports use the `@/` alias.

**D-02 — shadcn/ui with the `base-nova` style and Base UI primitives.**
`shadcn@latest init` on this stack installs `@base-ui/react` rather than Radix.
Components added: button, card, input, label, checkbox, badge, table, alert,
skeleton, dialog, sheet, separator, textarea, select, accordion.
The `Button` component is a Base UI primitive, so it is not a `<button>` in the DOM
tree; every interactive element still renders an accessible native control.

**D-03 — Fonts: Inter + Noto Sans Devanagari via `next/font/google`.**
DESIGN.md asks for Inter and Noto Sans Devanagari. Both are self-hosted by Next at
build time (no runtime request to Google), which also keeps the app usable offline
after `pnpm build`. Hindi line-height is forced to ≥ 1.6 through a `:lang(hi)` rule.

**D-04 — Light mode only.**
DESIGN.md: "Support light mode only for v1." The shadcn dark tokens remain in
`globals.css` but no `.dark` class is ever applied.

**D-05 — Status colours are CSS custom properties, not utility classes.**
`--status-match`, `--status-warning`, `--status-critical`, `--status-unverifiable`
(plus `-bg` and `-border` variants) are defined once and exposed through the Tailwind
`@theme` block. Every status is *also* rendered with an icon and a text label, so
colour is never the only signal (AGENTS.md rule 10 / DESIGN.md).

**D-06 — `zod` v4, `date-fns` v4, `fastest-levenshtein` v1.**
All three install and import cleanly under this stack and are used exactly as the
spec suggests. Two spec-listed matcher dependencies were **not** used:

- `@indic-transliteration/sanscript` — deferred; see D-07 in the M1 section for what
  replaced it.
- `natural` / a Double Metaphone package — replaced by our own implementation
  (`lib/match/metaphone.ts`) to avoid a heavy, unmaintained dependency
  (AGENTS.md rule 8).

**D-07 — Vitest 5 with `vite-tsconfig-paths`.**
`pnpm test` runs `vitest run` over `tests/**/*.test.ts` (node environment). A second
config, `vitest.eval.config.ts`, runs only `eval/**/*.eval.ts` so the benchmark files
do not execute as part of the normal test suite.

**D-08 — ESLint runs on explicit directories.**
`pnpm lint` = `eslint app components lib tests eval scripts
--no-error-on-unmatched-pattern`. Linting the repo root made ESLint walk
`tools/` and `uploads/` (local-only folders), which is slow and noisy; explicit
paths keep `pnpm lint` reproducible. `.next`, `node_modules` and `out` stay ignored
by the generated `eslint.config.mjs`.

**D-09 — `/api/health` reports configuration booleans only.**
It returns `demoMode`, `provider`, `providerConfigured`, `modelConfigured` and
`explainLlmEnabled` — never a key, a model name from source, or any document data.

**D-10 — `lib/env.ts` is the single server-side env reader.**
It parses `DEMO_MODE`, `LLM_PROVIDER`, `LLM_MODEL`, `GEMINI_API_KEY`,
`ANTHROPIC_API_KEY`, `MAX_IMAGE_BYTES` and `EXPLAIN_LLM` with safe defaults
(demo mode **on**, max image 1.5 MB, LLM explanations **off**). Defaults are chosen so
that a fresh clone runs fully offline with no API key.

**D-11 — Ambiguity: the starter pack's `schemes/` and `fixtures/` folders were missing.**
`START_HERE.md` says the pack contains `schemes/nsp-post-matric.json`,
`fixtures/packets/*.json` and `.env.example`, but only the `.md` files arrived.
I recreated `.env.example` from SPEC.md §8 and will author the scheme file (§12.1) and
the three demo packets (§16 M3) from the spec text. **Human action required:** the
scheme rules still need a real source review — every rule keeps its spec-provided
`verified` flag, and remedies ship `reviewed: false`.

**D-12 — `tools/` and `uploads/` are local, not part of the app.**
`tools/` holds a local pnpm binary (the sandbox could not write to a global prefix);
`uploads/` holds the original starter-pack files. Both are gitignored.

**D-13 — `cacheComponents` (Next 16 Cache Components / PPR) turned off.**
The create-next-app default enables `cacheComponents`, which rejects the per-route
`export const dynamic = "force-dynamic"` segment config with a 500 error. Our API routes
must read env and request bodies per request, so `cacheComponents` and
`partialPrefetching` are removed from `next.config.ts`, `reactStrictMode` is enabled, and
`/api/*` responses are sent with `Cache-Control: no-store` plus
`X-Content-Type-Options: nosniff`. `Referrer-Policy: no-referrer` is set globally so
source links never leak anything.

---

## M1 — Matching engine

All of `lib/match` is pure TypeScript with no I/O, no `Date.now()`, and no randomness, so
every decision is reproducible and unit-tested (108 tests at the end of this milestone).

**D-14 — Double Metaphone: `double-metaphone` (small, dependency-free) behind a wrapper.**
`lib/match/phonetic.ts` wraps it so the engine never sees the library API, and so we can
apply Indian-English spelling folds before keying: `ph→f`, `gh→g`, `kh→k`, `th→t`,
`dh→d`, `bh→b`, `ksh→ks`, `sh→s`, `chh→ch`, doubled consonants collapse, `w→v`, `z→j`,
`q→k`, `x→ks`, and both the primary and secondary keys are compared. Verified behaviour:
Chaudhary≡Choudhary, Verma≡Varma, Yadav≡Jadav, Krishna≡Krisna, Lakshmi≡Laxmi,
but Verma≢Sharma, Devi≢Kumari, Rajesh≢Rakesh.
Writing our own Metaphone was rejected: it is ~400 lines of edge cases and gaining nothing
over a 6 kB maintained package (AGENTS.md rule 8).

**D-15 — Jaro-Winkler and Jaccard are our own code.**
`lib/match/similarity.ts` — about 60 lines, standard prefix scale 0.1 capped at 4
characters, unit-tested for symmetry, bounds and the prefix bonus. No dependency needed.

**D-16 — Devanagari → Latin: `@indic-transliteration/sanscript` with a schwa rule.**
Extraction's `romanized` field is always preferred (SPEC.md §11.1.6); transliteration is
only a fallback. Implemented as Harvard-Kyoto (its long vowels are uppercase, which lets
us delete the word-final schwa *before* folding `A→a`): राजेश → `rAjez` → `rajesh`,
कुमार → `kumar`, सुनीता → `sunita`. The fallback is imperfect for consonant clusters
(असलम → `asalam`), which is exactly why the phonetic layer and the `romanized` field
exist; recorded as a known limitation, covered by tests.

**D-17 — Only honorifics are stripped, and only at the start of a name.**
`shri, shree, sri, smt, shrimati, mr, mrs, ms, miss, dr, late` (SPEC.md §11.1.3).
`kumar, kumari, devi, singh, kaur` are kept — tested explicitly, because stripping them
would silently turn "Sunita Devi" vs "Sunita Kumari" into a match.

**D-18 — Abbreviation map is small and conservative.**
`mohd, md, mohamad, muhammed → mohammad`, `kr → kumar`. Two speculative entries
(`km → kumar`, `dev → devi`, `ash → ashok`) are marked with `TODO(human)` in
`lib/match/config.ts` and need a human decision before the demo — "Dev" is also a
standalone surname.

**D-19 — Names are compared after transliteration, on tokens, using greedy best-first alignment.**
Ties break on index order so results are deterministic. Coverage = Σ scores ÷ the longer
token count, exactly as SPEC.md §11.2 specifies.

**D-20 — Devised rule: a surname-only match is not a WARNING.**
SPEC.md §11.2 makes any pair with `surnameOK && coverage ≥ 0.5` a WARNING. Taken
literally, "Rajesh Kumar" vs "Suresh Kumar" (a completely different person who shares a
very common surname) would be amber rather than red. Under-flagging is the failure mode
this product exists to prevent, so a WARNING additionally requires the **given name** to
align at ≥ 0.6 (initial or better). Deviating from the spec text is recorded here, as
AGENTS.md rule 9 requires. Required spec rows still pass unchanged.

**D-21 — Devised rule: a trailing vowel after a consonant is a different name part.**
"Kumar" vs "Kumari", "Dev" vs "Devi", "Ram" vs "Rama" share a Metaphone key but are
different name parts (often different gender). Such a pair scores 0.9 (spelling variant)
instead of 1.0, so "Sonu Kumar" vs "Sonu Kumari" is a WARNING instead of a silent MATCH.
A trailing vowel after an existing vowel is only a spelling wobble ("Priya"/"Priyaa") and
stays a full match. Without this, Double Metaphone alone conflates them.

**D-22 — Phonetic equality is a full match; a one-letter typo is not necessarily.**
"Chaudhary"/"Choudhary", "Krishna"/"Krisna", "Rajesh Kumr Verma"/"Rajesh Kumar Verma" all
share a Metaphone key and are MATCH. "Rajesh Kumr" spellings that break the phonetic key
fall to Jaro-Winkler and become NAME_SPELLING_VARIANT warnings. This matches the intent
of SPEC.md §11.2 (phonetic canonicalisation before comparison).

**D-23 — Dates: DD/MM is the assumed order; ambiguity is surfaced, not hidden.**
`parseIndianDate` keeps a `swapped` reading whenever both parts are ≤ 12, which is what
makes `12/03/2004` vs `03/12/2004` a DOB_SWAPPED warning. `03/25/2004` falls back to
MM/DD only because DD/MM is impossible. A year-only value on either side gives
UNVERIFIABLE (DOB_PARTIAL) when the years agree and CRITICAL (DOB_DIFFERENT) when they do
not — symmetric in both argument orders.

**D-24 — Address mismatch can only reach CRITICAL if the rule raises the ceiling.**
`compareAddress(a, b, { maxSeverity })` caps at WARNING by default (SPEC.md §11.4). A
different PIN becomes CRITICAL only when a rule passes `maxSeverity: "CRITICAL"`. No rule
in `schemes/nsp-post-matric.json` does that today.

**D-25 — Validity never invents a limit.**
`checkValidity` returns UNVERIFIABLE whenever the rule's `maxAgeMonths` is null, which is
the case in the shipped scheme file. A printed `validUntil` date always decides over the
age rule. The reference date is injected, so the function stays pure and testable.
