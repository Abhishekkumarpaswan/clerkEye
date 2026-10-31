# AGENTS.md — standing rules for ClerkEye

Project: ClerkEye, a web app (not mobile) that cross-checks scholarship application documents before submission. Full details are in SPEC.md. Visual direction is in DESIGN.md.

## Read first
Read SPEC.md and DESIGN.md before doing any work. Build ONE milestone at a time (SPEC.md Section 16) and stop after each.

## Commands (create these in package.json during M0)
- `pnpm dev` — run locally
- `pnpm typecheck` — tsc --noEmit
- `pnpm lint` — eslint
- `pnpm test` — vitest run
- `pnpm eval:matcher` — matcher benchmark (M7)
Before every commit run: `pnpm typecheck && pnpm lint && pnpm test`. Do not commit if any fails.

## Rules
1. Work on one milestone at a time. Commit after each milestone with a clear message.
2. Never invent scheme rules, citations, URLs or remedies. If a source is unknown, set `verified: false` and add a TODO. Never present something as official without a source.
3. Never log, store or persist document images or extracted values. No analytics on field contents. Keep state in memory only (no localStorage, no cookies for data).
4. Never request, display or output a full Aadhaar number or a full bank account number. Only last 4 digits of the account.
5. All decisions (MATCH / WARNING / CRITICAL / UNVERIFIABLE) come from deterministic code in lib/match and lib/rules. The LLM may only (a) read documents into structured fields and (b) explain findings that code already produced.
6. Validate all LLM output with Zod. Provide deterministic fallbacks (templates) so the app works with the explain route disabled, and DEMO_MODE fixtures so it works with no LLM at all.
7. Do not hardcode model names or API keys. Use env vars (see .env.example).
8. Before adding a dependency, verify it installs and imports. Prefer small custom code over fragile packages. Record any substitution in DECISIONS.md.
9. If the spec is ambiguous, choose the simplest option, record it in DECISIONS.md, and continue. Do not stop to ask unless blocked.
10. Every UI string goes through i18n (English and Hindi). Never use colour as the only status signal.
11. Keep the matcher pure and unit-tested. When changing thresholds, update tests and DECISIONS.md.
12. Do not add features outside the spec. Do not add browser automation, accounts, or a database.

## Definition of done for each milestone
Acceptance criteria in SPEC.md Section 16 met, tests pass, DECISIONS.md updated, short summary written: what was built, what was skipped, what needs a human decision.
