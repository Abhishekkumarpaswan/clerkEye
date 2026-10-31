# PROMPTS.md — copy-paste prompts for your coding agent

Use one prompt at a time. After each, open the app (or run the tests) and check the result yourself before moving on.

---

## 0. Kickoff (run once, in an empty repo that already contains these files)

Read SPEC.md, AGENTS.md and DESIGN.md fully. Do not start building yet. Reply with: (1) a one-paragraph summary of what you will build, (2) any ambiguities, contradictions or risks you see in the spec, (3) your plan for milestone M0. Wait for my go-ahead.

---

## M0 — Scaffold
Implement milestone M0 only. Create the Next.js (App Router, TypeScript strict) project in the current directory without deleting the existing files (SPEC.md, AGENTS.md, CLAUDE.md, DESIGN.md, PROMPTS.md, .env.example, schemes/, fixtures/). Use pnpm. Add Tailwind, shadcn/ui, lucide-react, zod, vitest. Add scripts: dev, typecheck, lint, test. Add /api/health. Write a README with run steps. Run typecheck, lint and tests. Update DECISIONS.md. Commit. Then stop and summarise.

## M1 — Matching engine
Implement milestone M1 only. Build lib/match (normalize, name, dob, address, validity, config) exactly as SPEC.md Section 11. Write unit tests for every row in the 11.6 table plus at least 30 additional name pairs (vowel variants, double consonants, one-letter typos, Devanagari with romanized form). Verify each dependency installs before using it; otherwise implement the function yourself and note it in DECISIONS.md. Run typecheck, lint, tests. Update DECISIONS.md. Commit. Stop and summarise, including any test cases where the spec's expected result looked wrong.

## M2 — Rules and remedies
Implement milestone M2 only. Build lib/rules (types, engine with runChecks(documents, scheme) returning Finding[]), load and Zod-validate schemes/nsp-post-matric.json, and build lib/remedies and lib/explain/templates in English and Hindi. Do not invent rules, URLs or remedies: set reviewed:false on every remedy. Unverifiable rules must produce UNVERIFIABLE findings with their howToCheck text. Add tests that run each fixture in /fixtures/packets through runChecks and assert the expected statuses described in each fixture's description. Run typecheck, lint, tests. Update DECISIONS.md. Commit. Stop and summarise.

## M3 — Extraction API, adapter and fixtures
Implement milestone M3 only. Build lib/llm (adapter plus Gemini and Anthropic implementations selected by env, no hardcoded model names), lib/extract (Zod schemas from SPEC.md Section 9, image preprocessing helpers), and /api/extract following SPEC.md Section 10, including DEMO_MODE returning the fixtures. The three fixture JSON files already exist; also generate three matching synthetic PNG document images (fake names and numbers, clearly labelled SAMPLE) into /fixtures/images using a script, and reference them in the fixtures if useful. Never log images or extracted values. Add tests for schema validation and demo mode. Run typecheck, lint, tests. Update DECISIONS.md. Commit. Stop and summarise.

## M4 — Wizard UI
Implement milestone M4 only. Build the landing page and the /check wizard steps Upload and Confirm per SPEC.md Section 15 and DESIGN.md: upload cards with preview and client-side resize, a "Try with sample packet" button that loads fixtures through demo mode, an editable fields table with low-confidence highlighting, a mandatory confirm checkbox, English/Hindi toggle with all strings in lib/i18n, in-memory state only. Run typecheck, lint, tests, then start the dev server and verify the flow works end to end. Update DECISIONS.md. Commit. Stop and summarise. Tell me the commands to deploy a preview.

## M5 — Results, fixes, explain, voice, print
Implement milestone M5 only. Build the results matrix (desktop table, mobile stacked cards), the detail drawer showing both values, the rule, source link and verified badge, Fix cards, /api/explain with template fallback and output validation per SPEC.md Section 13, the Listen button using speechSynthesis with a graceful no-voice message, and the print stylesheet and checklist including the declaration template with its disclaimer (only for name-variation WARNING findings). Run typecheck, lint, tests and verify manually. Update DECISIONS.md. Commit. Stop and summarise.

## M6 — Privacy hardening
Implement milestone M6 only. Build the redaction canvas tool, the consent gate on the landing page, the limits box, and a guard that blocks upload when a 12-digit number pattern is detected in the extraction result or the user has not covered the Aadhaar number. Audit the whole codebase for any logging or storage of document data (console.log, analytics, localStorage, cookies, server logs) and remove it. Add a short PRIVACY.md describing what is and isn't processed. Run typecheck, lint, tests. Update DECISIONS.md. Commit. Stop and summarise.

## M7 — Evaluation harness
Implement milestone M7 only. Build /eval per SPEC.md Section 14: synthetic identity generator with labelled mutations, matcher evaluation on at least 1,000 pairs, baselines (exact match, plain Levenshtein threshold; LLM baseline optional behind an env flag), confusion matrix and per-mutation precision/recall/F1, output to eval/report.md plus a simple HTML chart. Add pnpm eval:matcher. Use the results to calibrate thresholds in lib/match/config.ts and record the final values and F1 in DECISIONS.md. Run all checks. Commit. Stop and summarise with the headline numbers.

## M8 — Polish and deploy
Implement milestone M8 only. Fix any layout, accessibility or Hindi-rendering issues; add loading and error states everywhere; write the final README with setup, env vars, demo steps and limits; make sure DEMO_MODE=1 works with no API key; prepare production build settings for Vercel. Run typecheck, lint, tests and a production build. Update DECISIONS.md. Commit. Stop and give me the exact deployment steps and a 3-minute demo checklist.

---

## Helpful follow-up prompts

**Review before moving on:** Review everything you built in this milestone against the acceptance criteria in SPEC.md. List anything missing, any shortcuts you took, and any places where behaviour differs from the spec. Do not change code yet.

**Fix a bug:** Here is the problem: [paste error or describe behaviour]. First find the root cause and explain it. Then fix it with the smallest change, add a test that would have caught it, run all checks, and commit.

**Security and privacy audit:** Audit the repo for any place document images, extracted field values, or API keys could be logged, stored, cached, sent to the client or sent to a third party beyond the extraction call. Report findings first, then fix them.

**Demo hardening:** Test the app with DEMO_MODE=1 and no network. Make sure the sample packet flow, results, voice and print all work. List anything that fails.
