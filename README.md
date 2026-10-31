# ClerkEye

**Check your scholarship documents before you submit them.**

ClerkEye reads photos or PDFs of an application packet (Aadhaar, income certificate,
marksheet, bank passbook), extracts the key fields, lets you confirm them, then compares
them with deterministic, unit-tested code and tells you which mismatches are likely to
get your application rejected — and how to fix each one.

> Possible issues only — not a guarantee of acceptance or rejection. Some of the most
> common rejection causes (bank account not Aadhaar-seeded, institute not verifying in
> time) cannot be seen in documents and are shown as *UNVERIFIABLE* with instructions on
> how to check them yourself.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | done |
| M1 Matching engine | pending |
| M2 Rules + remedies | pending |
| M3 Extraction + API + fixtures | pending |
| M4 Wizard UI | pending |
| M5 Results + fixes | pending |
| M6 Privacy hardening | pending |
| M7 Eval harness | pending |
| M8 Polish + deploy | pending |

## Requirements

- Node 20+
- pnpm 9 (`npm i -g pnpm@9`)

## Run locally

```bash
pnpm install
cp .env.example .env.local     # leave DEMO_MODE=1: no API key needed
pnpm dev                       # http://localhost:3000
```

Health check: <http://localhost:3000/api/health>

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build and start |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm eval:matcher` | Matcher benchmark → `eval/report.md` |
| `pnpm eval:pipeline` | Optional end-to-end benchmark |

Before every commit: `pnpm typecheck && pnpm lint && pnpm test`.

## Environment variables

See `.env.example`. Keys are read only in server routes and are never sent to the
browser.

| Variable | Meaning |
|---|---|
| `DEMO_MODE` | `1` = `/api/extract` returns fixtures, no LLM call |
| `LLM_PROVIDER` | `gemini` or `anthropic` |
| `LLM_MODEL` | Model name (never hardcoded in source) |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Provider credentials (server only) |
| `MAX_IMAGE_BYTES` | Reject uploads larger than this |
| `EXPLAIN_LLM` | `1` = allow `/api/explain` to call the LLM (templates otherwise) |

## Privacy

- Document images and extracted values are processed in memory and are never stored,
  logged or sent anywhere except the extraction call you configure.
- No accounts, no database, no analytics, no cookies for data.
- Only the last 4 digits of a bank account are ever requested or displayed; full Aadhaar
  numbers must be covered with the redaction tool before upload (and upload is blocked
  if a 12-digit number is detected).
- Use **synthetic or sample documents only** in a demo. Never upload real Aadhaar or
  bank documents to a shared or public instance.

## Repository layout

```
app/            pages and API routes (/, /check, /api/*)
components/     upload cards, redaction canvas, fields table, result matrix, fix cards
lib/match/      pure matching engine (names, DOB, address, validity)
lib/rules/      scheme-rule engine → Finding[]
lib/remedies/   "what to fix / where / what to carry"
lib/explain/    deterministic bilingual explanation templates
lib/llm/        provider adapter (Gemini, Anthropic) + prompts
lib/extract/    Zod schemas + image preprocessing
lib/i18n/       en.json, hi.json
schemes/        nsp-post-matric.json (each rule carries a source + verified flag)
fixtures/       synthetic demo packets
eval/           matcher / pipeline benchmark + report.md
tests/          unit tests
```

## Docs

- `SPEC.md` — full specification
- `DESIGN.md` — visual and UX direction
- `DECISIONS.md` — every open question, and the choice made
- `AGENTS.md` — standing rules for the coding agent
