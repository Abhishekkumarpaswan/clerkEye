# START HERE — ClerkEye starter pack

You do not need to write any files. Everything is in this folder.

## What's inside
- SPEC.md — full specification (what to build)
- AGENTS.md / CLAUDE.md — standing rules for the agent (same content; the agent reads whichever name it supports)
- DESIGN.md — look and feel
- PROMPTS.md — copy-paste prompts for each milestone
- .env.example — copy to .env.local and add your API key
- schemes/nsp-post-matric.json — scheme rules (some marked unverified)
- fixtures/packets/*.json — three synthetic demo packets
- .gitignore

## Steps
1. Unzip this folder and open it in your coding agent (for example Claude Code, Cursor, Codex or Copilot agent mode).
2. Run: git init (so the agent can commit each milestone).
3. Copy .env.example to .env.local. Leave DEMO_MODE=1 at first; no API key is needed until you test live extraction.
4. Open PROMPTS.md. Paste the Kickoff prompt. Read the agent's reply. If it looks right, say "Go ahead with M0".
5. Paste the M1 prompt, then M2, and so on. After each milestone, run the app or the tests and check it yourself before the next one.
6. Deploy a preview after M4 (ask the agent for the steps), so deployment problems show up early.

## About downloading a ready-made project from GitHub
I can't point you to a verified repository that matches this idea, and I don't want to guess a link. The agent creates the Next.js project itself in milestone M0, using the standard create-next-app and shadcn CLIs. That's the normal route and nothing needs downloading.

## Things only a human should do
- Read the official scheme guideline and fix the rules marked verified:false in schemes/nsp-post-matric.json. Also review the remedies the agent writes; they ship as reviewed:false.
- Use only fake or synthetic documents in the demo. Never upload real Aadhaar or bank documents.
- Check the free-tier limits and data-use terms of your LLM API before turning DEMO_MODE off.
- Test Hindi voice on the exact device you will demo on.

## If time is short
Skip in this order: pipeline evaluation, declaration template, voice, LLM explanations (templates still work), Hindi UI. Never skip: matcher, confirm step, results matrix, demo mode, limits box.
