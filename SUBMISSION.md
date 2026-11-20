# Submission

Candidate: Mark O'Brian (mdobrian@gmail.com)

## Included

- Source: this repository (`web/` is the app)
- `README.md` — local setup, Docker, reviewer accounts
- `ARCHITECTURE.md` — stack, priorities, cuts
- `AI_WORKFLOW.md` — how AI was used
- `WALKTHROUGH.txt` — video URL (fill in after recording)
- Live product: https://ajaia-paper.onrender.com

## Reviewer access

Password for all accounts: `paper123`

- `alex@ajaia.test` — owns the sample document
- `jordan@ajaia.test` — share with this account
- `sam@ajaia.test` — no access until shared

Live URL may take up to a minute on first load if Render’s free instance was asleep.

## What works

- Create, rename, edit (bold, italic, underline, headings, lists), autosave, reopen
- Import `.txt` and `.md` into a new document; optional markdown inspect/repair on upload
- Owner shares by email; owned vs shared lists (forest green vs slate blue)
- SQLite persistence across refresh
- Supplemental: delete (type `delete` to confirm), unshare, leave (type `leave` to confirm), duplicate, export `.md` / `.txt` / PDF, version history, comments
- Automated tests: `cd web && npm test` (86 offline Vitest tests)

## What is incomplete

- No real-time collaboration, viewer-vs-editor roles, or suggestion mode
- No `.docx` import
- Walkthrough video URL is pending until recorded

## If I had 2–4 more hours

- Autosave status that is harder to miss
- Persistent disk on Render so demo data survives every cold start
- Print-fidelity PDF if a reviewer needed a pixel match of the editor

## Local run

```bash
cd web
npm install
npm test
npm run dev
```

Or: `docker compose up --build` from the repo root.
