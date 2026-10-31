# ClerkEye — Build Specification (for an AI coding agent)

> Pre-submission document cross-check for scholarship applications. The user uploads their document packet, ClerkEye extracts the fields, compares them with deterministic code, and tells the user which mismatches are likely to cause rejection, which document to fix, and how.

**How to use this file:** put it in the repo root as `SPEC.md`, copy Section 17 into `AGENTS.md` (or `CLAUDE.md`), then ask the agent to implement **one milestone at a time** (Section 16). Do not ask for the whole project in one prompt.

---

## 1. Product summary

ClerkEye is a web app (not a mobile app). A student uploads photos or PDFs of 2–4 documents (Aadhaar, income certificate, marksheet, bank passbook first page). The app:

1. Extracts key fields from each document with a vision LLM (structured JSON output).
2. Lets the user confirm or edit the extracted fields.
3. Compares fields across documents with a **deterministic matching engine** (transliteration-aware, initials-aware).
4. Applies a **sourced rule set** for one scheme profile (checks, each with a citation and a `verified` flag).
5. Shows a colour-and-icon result matrix: `MATCH`, `WARNING`, `CRITICAL`, `UNVERIFIABLE`.
6. For each flagged item, shows the **actual fix** (which document to correct, where, what to carry), with an explanation in English or Hindi, optional voice, and a print-ready checklist.

**Core design rule:** the LLM only *reads* documents and *explains* findings. Every decision (MATCH/WARNING/CRITICAL) comes from deterministic code that can be unit-tested.

## 2. Goals, non-goals, honest limits

**Goals**
- Catch cross-document clerical mismatches before submission.
- Be measurably better than a single "compare these documents" prompt (Section 14 benchmark).
- Work reliably in a live demo (demo mode with fixtures).

**Non-goals**
- No browser automation, no auto-submission to any portal.
- No user accounts, no database, no storage of documents or extracted values.
- No claim of legal validity for any generated text.

**Limits that must be shown in the UI**
- Some of the most common rejection causes (bank account not Aadhaar-seeded or NPCI-mapped, institute not verifying in time) **cannot be detected from documents**. List them as `UNVERIFIABLE` with "how to check" guidance.
- The declaration template is a template only. Many offices require stamp paper or a notarised affidavit; the user must confirm what their office accepts.
- Results are "possible issues," not a guarantee of acceptance or rejection.

## 3. Primary user and scenario

Persona: a first-generation college student applying for a central scholarship on the National Scholarship Portal (NSP). Father's name is "R.K. Verma" on the income certificate and "Rajesh Kumar Verma" on Aadhaar, and the bank passbook shows a different spelling again. ClerkEye flags this before submission and explains what to correct and where.

## 4. v1 scope (hackathon)

- **One scheme profile:** `nsp-post-matric` (generic central scholarship checks). Rules live in JSON so more schemes can be added later.
- **Documents:** Aadhaar, income certificate, marksheet, bank passbook (first page).
- **Fields compared:** applicant name, father's name, date of birth, address/PIN, issue/validity date, bank account holder name.
- **UI languages:** English and Hindi (toggle). Explanations in the selected language.
- **Inputs:** JPG, PNG, PDF (first page only for PDF in v1).

## 5. Architecture and data flow

```
Browser
  ├─ upload → resize (canvas) → redact Aadhaar number (canvas box tool)
  ├─ POST /api/extract (one doc per call, parallel)  ──► LLM adapter ──► zod-validated ExtractedDocument
  ├─ confirm/edit fields (client state only)
  ├─ runChecks(documents, schemeRules)   ← pure TS, runs in browser (no network)
  ├─ POST /api/explain (findings only, no images)    ──► LLM adapter ──► bilingual explanation (with template fallback)
  └─ render matrix → fixes → speechSynthesis / window.print()
```

- Matching, rules, and remedies run **client-side** as pure functions. No document data is needed by the server after extraction.
- The server has only two LLM-backed routes and a health route.

## 6. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| Styling/UI | Tailwind CSS + shadcn/ui, lucide-react icons |
| Validation | Zod |
| State | React state / Zustand (memory only; never persist PII) |
| LLM access | Provider adapter in `lib/llm/` (Gemini and Anthropic implementations; selected by env) |
| Matching | Custom TypeScript + `fastest-levenshtein`, a Jaro-Winkler implementation (own code or `natural`), a Double Metaphone implementation, `@indic-transliteration/sanscript` (Devanagari→Latin), `date-fns` |
| Tests | Vitest (unit), optional Playwright (smoke e2e) |
| Package manager | pnpm |
| Hosting | Vercel |
| Voice | Browser `speechSynthesis` |
| Print | CSS `@media print` + `window.print()` |

**Agent instruction:** before adding any dependency, confirm it installs and imports. If a package fails or is unmaintained, implement the function in `lib/` instead and note it in `DECISIONS.md`.

## 7. Repository layout

```
/app
  /page.tsx                  landing + consent
  /check/page.tsx            4-step wizard
  /api/extract/route.ts
  /api/explain/route.ts
  /api/health/route.ts
/components                  UploadCard, RedactionCanvas, FieldsTable, ResultMatrix, FixCard, LangToggle, PrintSheet
/lib
  /llm                       adapter.ts, gemini.ts, anthropic.ts, prompts.ts
  /extract                   schemas.ts, preprocess.ts
  /match                     normalize.ts, name.ts, dob.ts, address.ts, validity.ts, config.ts
  /rules                     engine.ts, types.ts
  /remedies                  remedies.ts
  /explain                   templates.ts
  /i18n                      en.json, hi.json, index.ts
/schemes                     nsp-post-matric.json
/fixtures                    packets/*.json, images/*.png      (demo mode)
/eval                        generate.ts, matcher.eval.ts, pipeline.eval.ts, baseline.ts, report.md
/tests                       *.test.ts
SPEC.md  AGENTS.md  DECISIONS.md  README.md
```

## 8. Environment variables

```
LLM_PROVIDER=gemini|anthropic
LLM_MODEL=<model name; do NOT hardcode in source>
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
DEMO_MODE=0|1            # 1 = /api/extract returns fixtures, no LLM call
MAX_IMAGE_BYTES=1500000
```

Keys are used only in server routes. Never expose them to the client.

## 9. Data contracts (Zod)

```ts
export const DocType = z.enum(["AADHAAR","INCOME_CERT","MARKSHEET","BANK_PASSBOOK"]);

export const Field = z.object({
  value: z.string().nullable(),          // exactly as printed; null if unreadable
  romanized: z.string().nullable(),      // Latin-script rendering if source is not Latin
  script: z.enum(["latin","devanagari","other","unknown"]),
  confidence: z.number().min(0).max(1),
});

export const ExtractedDocument = z.object({
  docType: DocType,
  fields: z.object({
    applicantName: Field,
    fatherName: Field.optional(),        // Aadhaar: parsed from S/O, D/O, W/O line if present
    dob: Field.optional(),
    address: Field.optional(),
    pin: Field.optional(),
    issueDate: Field.optional(),         // income certificate
    validUntil: Field.optional(),
    bankAccountHolder: Field.optional(), // passbook
    ifsc: Field.optional(),
    accountLast4: Field.optional(),      // never the full number
  }),
  qualityNote: z.string().nullable(),    // e.g. "blurry", "cropped", "handwritten"
});

export const Status = z.enum(["MATCH","WARNING","CRITICAL","UNVERIFIABLE"]);

export const Finding = z.object({
  ruleId: z.string(),
  check: z.string(),                     // human label
  left:  z.object({ doc: DocType, field: z.string(), value: z.string().nullable() }),
  right: z.object({ doc: DocType, field: z.string(), value: z.string().nullable() }).optional(),
  status: Status,
  score: z.number().min(0).max(1).nullable(),
  mismatchType: z.string().nullable(),   // taxonomy in Section 12
  reason: z.string(),                    // machine-generated, factual
  source: z.object({ url: z.string(), note: z.string(), verified: z.boolean() }).optional(),
});
```

## 10. Extraction spec (`/api/extract`)

- **One image per call**, one `docType` per call; client runs calls in parallel.
- Client preprocess: resize so the longest side ≤ 1600 px, JPEG quality 0.8, target ≤ 1 MB; reject files over `MAX_IMAGE_BYTES`.
- Use the provider's structured-output / JSON mode; validate with Zod; **retry once** on schema failure; otherwise return a typed error.
- Prompt rules (put in `lib/llm/prompts.ts`):
  1. Return only fields visible in the image. If a field is unreadable or absent, return `value: null` with low confidence. **Never guess or infer.**
  2. Copy text exactly as printed, including punctuation and initials.
  3. If the source is Devanagari or another Indian script, also return a Latin-script `romanized` form.
  4. For Aadhaar, parse the father/guardian name only from an explicit S/O, D/O, W/O, C/O line.
  5. Never return a full Aadhaar number or full bank account number. Return only the last 4 digits of the account.
  6. Fill `qualityNote` if the image is blurry, cropped, rotated, or handwritten.
- Do not log image bytes or extracted values anywhere.
- **Demo mode:** when `DEMO_MODE=1` or the request carries a fixture id, return the matching JSON from `/fixtures/packets/` after a 600–900 ms artificial delay.

## 11. Matching engine spec (`lib/match`)

All functions are pure and unit-tested. Thresholds live in `config.ts` and are calibrated with the eval harness (Section 14); the defaults below are starting points, not facts.

### 11.1 Name normalisation
1. Unicode NFKC, lowercase.
2. Replace `.`, `,`, `-`, `_` with spaces; collapse whitespace.
3. Strip **honorific prefixes only**: shri, shree, sri, smt, shrimati, mr, mrs, ms, miss, dr, late. **Do not strip** "kumar", "kumari", "devi", "singh", "kaur", since these are real name parts.
4. Expand configurable abbreviations: `mohd`/`md` → `mohammad`, `kr` → `kumar` (keep the map in `config.ts`, easy to extend).
5. Tokenise. A token of length 1 is an **initial**. A string like "r.k." becomes two initials.
6. Use `romanized` from extraction when the source script is not Latin; otherwise transliterate Devanagari with sanscript as a fallback.
7. For each token compute a Double Metaphone key for phonetic comparison.

### 11.2 Name comparison (`compareNames(a, b)`)
```
tokensA, tokensB = normalise(a), normalise(b)
if equal as multisets (after phonetic canonicalisation):
    return order differs ? WARNING(NAME_ORDER) : MATCH
align each token of the shorter list to the best unused token in the longer list:
    exact or same phonetic key        → 1.0
    Jaro-Winkler >= 0.92              → 0.9   (spelling variant)
    initial equals first letter       → 0.6   (initial-only)
    otherwise                         → 0
coverage = sum(alignment scores) / max(len(tokensA), len(tokensB))
surnameOK = last non-initial token of each side aligns at >= 0.9
status:
    MATCH     if coverage >= 0.95 and no initials involved
    WARNING   if surnameOK and coverage >= 0.5   (initials, dropped middle name, spelling variant)
    CRITICAL  otherwise                          (different surname, or coverage < 0.5)
mismatchType: NAME_ABBREVIATED | NAME_SPELLING_VARIANT | NAME_MISSING_TOKEN | NAME_ORDER | NAME_DIFFERENT
```

### 11.3 Date of birth
Parse `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`. Equal → MATCH. Day and month swapped → WARNING (`DOB_SWAPPED`). Year-only on one side → UNVERIFIABLE (`DOB_PARTIAL`). Otherwise CRITICAL (`DOB_DIFFERENT`).

### 11.4 Address
Normalise tokens, extract the 6-digit PIN. Same PIN and token Jaccard ≥ 0.5 → MATCH; otherwise WARNING (`ADDRESS_VARIATION`). **Address mismatch never exceeds WARNING** unless the scheme rule sets `max_severity: "CRITICAL"`, since many schemes do not require address equality.

### 11.5 Validity
Given an `issueDate` and a rule `max_age_months`, status is MATCH if within the window and CRITICAL if outside it (`CERT_EXPIRED`). If the rule has no verified value, return UNVERIFIABLE.

### 11.6 Required unit tests (minimum)

| A | B | Expected |
|---|---|---|
| Rajesh Kumar Verma | Rajesh Kumar Verma | MATCH |
| Mohd. Aslam | Mohammad Aslam | MATCH |
| Chaudhary Ram | Choudhary Ram | MATCH |
| R.K. Verma | Rajesh Kumar Verma | WARNING (NAME_ABBREVIATED) |
| Rajesh Kumar Verma | Rajesh Verma | WARNING (NAME_MISSING_TOKEN) |
| Verma Rajesh Kumar | Rajesh Kumar Verma | WARNING (NAME_ORDER) |
| राजेश कुमार वर्मा (romanized: Rajesh Kumar Varma) | Rajesh Kumar Verma | MATCH |
| Sunita Devi | Sunita Kumari | CRITICAL |
| Rajesh Kumar Verma | Rajesh Kumar Sharma | CRITICAL |
| DOB 12/03/2004 | 03/12/2004 | WARNING (DOB_SWAPPED) |
| DOB 12/03/2004 | 12/03/2003 | CRITICAL |

Add at least 30 further pairs covering vowel variants (a/e, i/ee), double consonants, and one-letter typos.

## 12. Rules and remedies

### 12.1 Scheme rules file (`schemes/nsp-post-matric.json`)
Each rule has a source and a `verified` flag. The UI shows an "unverified rule" badge when `verified` is false. **The agent must not invent rules or citations.** Rules not listed below are added by a human after reading the official guideline.

```json
{
  "scheme": "nsp-post-matric",
  "lastReviewed": "FILL-IN-DATE",
  "rules": [
    {
      "id": "R-001",
      "type": "field_match",
      "label": "Bank account holder name must match applicant name",
      "left":  { "doc": "BANK_PASSBOOK", "field": "bankAccountHolder" },
      "right": { "doc": "AADHAAR", "field": "applicantName" },
      "failSeverity": "CRITICAL",
      "source": {
        "url": "https://Scholarships.Gov.In/public/schemeGuidelines/ladakh/ladakh_3022_G.pdf",
        "note": "NSP scheme guideline states an application is rejected if the bank account holder's name does not match the applicant's name. Re-verify applicability to the target scheme.",
        "verified": true
      }
    },
    {
      "id": "R-002",
      "type": "unverifiable_note",
      "label": "Bank account must be Aadhaar-seeded / NPCI-mapped for payment",
      "howToCheck": "Ask the bank branch or check seeding status through the bank/NPCI process.",
      "source": { "url": "", "note": "Commonly cited in NSP guidance; add official URL.", "verified": false }
    },
    {
      "id": "R-003",
      "type": "field_match",
      "label": "Applicant name should be consistent across Aadhaar, marksheet and income certificate",
      "pairs": [["AADHAAR","MARKSHEET"],["AADHAAR","INCOME_CERT"]],
      "field": "applicantName",
      "failSeverity": "WARNING",
      "source": { "url": "", "note": "TODO: confirm exact requirement in scheme guideline.", "verified": false }
    },
    {
      "id": "R-004",
      "type": "validity",
      "label": "Income certificate must be within its validity period",
      "doc": "INCOME_CERT",
      "field": "issueDate",
      "max_age_months": null,
      "source": { "url": "", "note": "TODO: set from official guideline; null → UNVERIFIABLE.", "verified": false }
    }
  ]
}
```

### 12.2 Remedies table (`lib/remedies`)
Map `(mismatchType, involved documents)` → fix steps. Example structure:

```ts
{ mismatchType: "NAME_*", involves: "BANK_PASSBOOK",
  fix: "Ask your bank branch to update the account holder name (KYC update) so it matches your Aadhaar. Carry your Aadhaar and passbook. Re-upload the updated passbook page.",
  reviewed: false }
```

Required entries: name issues involving bank, Aadhaar, marksheet, income certificate; DOB issues; expired certificate; unreadable field (re-take photo guidance). **Every entry ships with `reviewed: false`** until a human confirms it. The UI wording must say "check what your office accepts" and must not promise outcomes. Do not state numerical limits on Aadhaar updates unless the team has verified them from UIDAI.

### 12.3 Declaration template
Provide a printable "Name variation declaration" **template** with a prominent disclaimer: "Template only. Many offices require stamp paper or a notarised affidavit. Confirm what your office accepts." It is shown only when the finding is a name-variation WARNING and never for CRITICAL findings.

## 13. Explanation, voice, and print

- `/api/explain` receives **findings only** (no images, no raw document text beyond the compared values) plus `lang: "en" | "hi"`, and returns a short explanation per finding.
- The prompt must forbid adding facts, rules, or remedies not present in the input. After generation, validate that every `ruleId` referenced exists; on any failure or timeout, fall back to `lib/explain/templates.ts` (static templates in both languages). The app must be fully usable with the LLM explanation disabled.
- Voice: a "Listen" button using `speechSynthesis` with `lang` `hi-IN` or `en-IN`. If no matching voice is installed, show "Voice not available on this device." Test on the demo machine.
- Print: `@media print` stylesheet producing a one-page "Pre-submission checklist" (findings, fixes, unverifiable items) and the optional declaration template. No PII beyond what the user typed or confirmed.

## 14. Evaluation harness (`/eval`) — the proof of value

1. **Synthetic identities:** 200 Indian name sets (applicant, father) in Latin and Devanagari.
2. **Mutations with ground-truth labels:** abbreviate to initials, drop middle name, spelling variant, reorder, replace surname, swap DOB day/month, change year, expired certificate, bank name mismatch.
3. **Matcher eval (no LLM):** run `compareNames` / `compareDob` on ≥ 1,000 pairs. Report per-mismatch-type precision, recall, F1, and a 4-class confusion matrix.
4. **Baselines:** (a) exact string match, (b) plain Levenshtein threshold, (c) optional single-LLM-prompt "do these names match?" over the same text pairs.
5. **Pipeline eval (optional, small):** render 20 synthetic packets (SVG templates → PNG via `sharp`), run the full extraction + matching, report field-extraction accuracy and end-to-end finding accuracy.
6. **Output:** `eval/report.md` with tables and a simple HTML chart. Commands: `pnpm eval:matcher`, `pnpm eval:pipeline`.
7. **Calibration:** adjust thresholds in `config.ts` using this data, and record the chosen values and their F1 in `DECISIONS.md`.

## 15. UI specification

**Landing (`/`):** one-sentence value proposition, the limits box from Section 2, a consent checkbox ("I will use sample or my own documents; images are processed to read fields and are not stored"), a "Try with sample packet" button (demo mode), and a language toggle.

**Wizard (`/check`), four steps:**
1. **Upload:** four cards (Aadhaar, income certificate, marksheet, bank passbook). Each shows a preview, a "Cover Aadhaar number" redaction tool (drag a black box on a canvas; applied before upload), quality hints, and a remove button. Minimum 2 documents to continue.
2. **Confirm:** an editable table of extracted fields per document with confidence indicators (low confidence highlighted). The user must tick "These values are correct" before checking. **Matching never runs on unconfirmed values.**
3. **Results:** matrix with documents as columns and checks as rows. Each cell shows an icon, label, and colour: MATCH (green, check), WARNING (amber, triangle), CRITICAL (red, x), UNVERIFIABLE (grey, question mark). Colour is never the only signal. Clicking a cell shows both values side by side, the rule, its source link, and the `verified` badge.
4. **Fix and share:** per finding, a Fix card (what, where, what to carry), explanation, "Listen" button, "Print checklist" button, optional declaration template.

**Non-functional:** mobile-first, keyboard accessible, ARIA labels, loading skeletons, error states for failed extraction ("Couldn't read this document — retake the photo"), no layout shift, all strings from i18n files (English and Hindi).

## 16. Milestones (build in this order; stop and report after each)

| # | Milestone | Acceptance criteria | Budget |
|---|---|---|---|
| M0 | Scaffold | Next.js + TS strict + Tailwind + shadcn + Vitest; `pnpm typecheck && pnpm lint && pnpm test` pass; health route works; README with run steps | 0.5 h |
| M1 | Matching engine | All tests in 11.6 pass plus 30 extra pairs; `compareNames`, `compareDob`, `compareAddress`, `checkValidity` pure and typed | 2.5 h |
| M2 | Rules + remedies | `runChecks(docs, scheme)` returns `Finding[]`; rules JSON loaded and validated; remedies lookup; unverifiable notes appear | 1.5 h |
| M3 | Extraction + API + fixtures | `/api/extract` works with the adapter and Zod validation; `DEMO_MODE` returns fixtures; 3 sample packets (clean, name-abbreviation, bank-name mismatch) in `/fixtures` | 2.5 h |
| M4 | Wizard UI | Upload, resize, confirm table, state in memory, sample packet button, EN/HI toggle; deploy a preview URL now | 2.5 h |
| M5 | Results + fixes | Matrix, detail drawer, Fix cards, template fallback explanations, `/api/explain`, voice, print sheet | 2 h |
| M6 | Privacy hardening | Redaction tool, no-logging audit, consent gate, 12-digit-pattern guard (block upload of unredacted full numbers if detected), limits box | 1.5 h |
| M7 | Eval harness | `pnpm eval:matcher` produces `eval/report.md` with baselines and chosen thresholds | 2 h |
| M8 | Polish + deploy | Production deploy, demo script rehearsed, backup recorded video, README | 1.5 h |

**Cut order if time is short:** pipeline eval (14.5) → declaration template → voice → `/api/explain` (templates only) → Hindi UI. **Never cut:** matcher, confirm step, results matrix, demo mode, privacy limits box.

**Milestone prompt format** (give the agent one at a time):
> Read SPEC.md and AGENTS.md. Implement milestone M{n} only. Follow the acceptance criteria exactly. Run typecheck, lint, and tests. Update DECISIONS.md with any choices. Commit. Then stop and summarise what you built, what you skipped, and anything that needs a human decision.

## 17. Agent operating rules (copy into `AGENTS.md`)

1. Work on one milestone at a time. Commit after each milestone; run `pnpm typecheck && pnpm lint && pnpm test` before committing.
2. Never invent scheme rules, citations, URLs, or remedies. If a source is unknown, leave `verified: false` and add a TODO. Never state something as official without a source.
3. Never log, store, or persist document images or extracted values. No analytics on field contents. Keep state in memory only.
4. Never request or output a full Aadhaar number or full bank account number.
5. All decisions (MATCH/WARNING/CRITICAL/UNVERIFIABLE) come from deterministic code. The LLM may read documents and explain findings only.
6. Validate all LLM output with Zod. Provide deterministic fallbacks so the app works without the explain route.
7. Do not hardcode model names or API keys. Use env vars.
8. Before adding a dependency, verify it installs and works. Prefer small custom code over fragile packages.
9. When the spec is ambiguous, choose the simplest option, record it in `DECISIONS.md`, and continue.
10. Every UI string goes through i18n (English and Hindi). Do not use colour as the only status signal.

## 18. Definition of done

- A judge can open the live URL, click "Try with sample packet," and in under 30 seconds see a red-flagged bank-name mismatch with a fix and a spoken Hindi explanation.
- A judge can upload their own **synthetic** document images and get extraction, a confirm step, and results.
- `eval/report.md` shows the pipeline beating exact-match and Levenshtein baselines on the labelled mutation set.
- The limits box, unverifiable items, and "unverified rule" badges are visible.
- No document data is stored or logged.

## 19. Three-minute demo script

1. **Hook:** "Students lose scholarships to spelling differences across documents, and they find out months later."
2. Load the sample packet. Show the extracted fields and the confirm step.
3. Results matrix: one red (bank holder name versus Aadhaar), one amber (initials), one grey (Aadhaar seeding: "we can't see this from documents, here's how to check").
4. Click the red cell: both values, the rule, its source link, the fix card. Press "Listen" in Hindi.
5. Show the benchmark chart: "Our pipeline versus a one-prompt baseline."
6. Print the checklist. Close with the honest limits.

## 20. Risks and mitigations

| Risk | Mitigation |
|---|---|
| OCR/vision misreads handwritten or blurry documents | Confirm step is mandatory; low-confidence highlighting; retake guidance |
| Unverified rules shown as fact | `verified` flag and badge; human review before demo |
| PII exposure | Client-side redaction, no storage, no logging, synthetic demo data, consent gate |
| LLM outage during demo | Demo mode with fixtures; template explanations |
| Free-tier API limits or changed terms | Check current limits and data-use terms; keep the adapter swappable |
| Overclaiming | Limits box; "possible issues, not guarantees"; template-only declaration |
