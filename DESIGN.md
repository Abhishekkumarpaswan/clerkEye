# DESIGN.md — visual and UX direction

## Feel
Calm, trustworthy, plain-language. Not corporate gradients, not cluttered government-portal styling. A student on a phone should understand every screen without help.

## Layout
- Mobile-first. Single-column wizard (Upload → Confirm → Results → Fix & Print). Max content width about 720px on desktop, centred.
- Generous spacing, large tap targets (minimum 44px), clear step indicator at the top.
- Results matrix: documents as columns, checks as rows on desktop; on mobile collapse to stacked cards, one per check.

## Typography
- Clean sans-serif (Inter or system UI) for Latin text; Noto Sans Devanagari for Hindi. Verify Hindi renders without clipping or tiny line height (use line-height of at least 1.6 for Hindi).
- Body 16px minimum. Headings clear but not huge.

## Colour and status
Status is always shown with colour AND icon AND text label.
- MATCH: green, check icon
- WARNING: amber, triangle icon
- CRITICAL: red, x icon
- UNVERIFIABLE: grey, question-mark icon
Neutral background (white or very light grey), one calm accent colour (deep blue or teal) for primary buttons. All text and status colours must meet WCAG AA contrast. Support light mode only for v1.

## Components
- Upload card: dashed border, preview thumbnail, document-type label, remove button, quality hint ("flat surface, good light, all four corners visible").
- Redaction tool: simple canvas where the user drags a black box over the Aadhaar number; shows "Number covered" confirmation.
- Fields table: editable inputs, low-confidence values highlighted with a soft amber background and a "please check" label.
- Fix card: three short lines — What to fix / Where to go / What to carry. Include a Listen button.
- Limits box on landing and results: plain sentence saying some causes cannot be seen from documents and results are not a guarantee.

## Motion
Minimal. Skeleton loaders while extracting; no decorative animation. Respect prefers-reduced-motion.

## Content tone
Short sentences. Say what is wrong, why it matters, and what to do. Avoid legal jargon. Never promise acceptance or rejection. Use "possible issue", "likely to be flagged", "check with your office".

## Empty and error states
Friendly and actionable: "We couldn't read this photo. Try again with better light." Never show raw error text or stack traces.

## Print view
Black-and-white safe, one page, no background colours, large readable text. Contains findings, fixes, unverifiable items and (when applicable) the declaration template with its disclaimer.

## Accessibility
Keyboard navigable, visible focus rings, ARIA labels on icons, form labels linked to inputs, status announced to screen readers.
