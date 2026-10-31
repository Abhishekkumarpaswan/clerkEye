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
