# PRIVACY.md — what ClerkEye processes, and what it does not

ClerkEye exists to check documents, not to collect them. This page describes exactly what
happens to a document when you use the app, so you can decide whether to use it.

## Summary

- **Nothing is stored.** No database, no file storage, no logs of your documents.
- **Nothing is analysed.** No analytics, no trackers, no advertising pixels, no cookies
  for data.
- **Everything lives in the browser tab.** Close the tab (or reload) and the data is gone.
- **Only the last four digits** of a bank account are ever requested, kept or displayed.
- **Full Aadhaar numbers are never read.** You cover the number before the card is sent,
  and both the server and the browser refuse to keep a 12-digit number even if a model
  returns one.

## What happens to your photos

1. **In the browser.** Your photo is resized to at most 1600 px on its longest side and
   re-encoded as a JPEG on a canvas. For an Aadhaar card you draw a black box over the
   number, and the covered image replaces the original in memory.
2. **Extraction.** The image is sent once, for one document type, to `/api/extract` on the
   ClerkEye server. If the deployment is in demo mode (`DEMO_MODE=1`), no image is sent
   anywhere and a synthetic sample is returned instead.
3. **At the model.** If live reading is enabled, the server forwards that single image to
   the configured language-model provider (Gemini or Anthropic) to read the fields. The
   provider's own data-use terms apply to that call — check them before using real
   documents. Nothing is written to disk on the server, and the image is discarded when
   the response is returned.
4. **Back in the browser.** Only the extracted fields come back, never the image. They
   are held in React state for this tab. You confirm or edit them.
5. **Comparison.** All matching and rule checks run in your browser as pure functions.
   The server never sees your confirmed values.
6. **Explanations.** If the explanation model is enabled, only the *findings* are sent —
   rule id, status, and the two compared values — never images, never the rest of the
   document. With `EXPLAIN_LLM=0` (the default) explanations are generated locally from
   templates and nothing leaves the browser.

## What is deliberately never requested or kept

| Data | Handling |
|---|---|
| Full Aadhaar number | Never requested. Aadhaar uploads are blocked until you cover the number. A 12-digit pattern found in any value is masked on the server and again in the browser. |
| Full bank account number | Never requested. Only `accountLast4`, validated to exactly four digits. |
| OTP, password, PIN, login | Never requested. There is no login. |
| Document images after extraction | Dropped. Nothing is cached or stored. |
| Extracted values | Kept in memory for this tab only. No storage API is used anywhere in the source (a test enforces this). |

## What the server does keep

Nothing per request. The only state is configuration read from environment variables.
`/api/health` reports whether a provider key exists — a boolean, never the key. No
`console` call exists anywhere in the app source (also enforced by a test), so document
data cannot reach a server log through this codebase.

## Limits of these promises

- A third-party model provider processes the image you send for extraction, under its own
  terms. You can avoid this entirely with `DEMO_MODE=1`.
- Whoever operates the deployment can change the code. If you are using someone else's
  instance, ask them.
- Network-level logs (by your ISP, your mobile operator, or the host's infrastructure) are
  outside this app's control.

## For demo presenters

- Use the built-in synthetic sample packet, or your own **fake** documents.
- Do not upload a real Aadhaar card or a real bank passbook to a shared or public
  deployment.
- If you switch `DEMO_MODE` off, read the provider's free-tier limits and data-use terms
  first.
- Test the Hindi voice on the exact device you will demo on: some phones ship without a
  Hindi speech voice, and the app will say so rather than pretend.

## How to check these claims yourself

```bash
pnpm test          # includes tests/privacy.test.ts: no logging, no storage, no third-party fetch
grep -rn "console\." app components lib     # should print nothing
grep -rn "localStorage\|document.cookie" app components lib
```
