# Paper — Ajaia take-home submission

Candidate: Mark O'Brian (mdobrian@gmail.com)

- Live product: https://ajaia-paper.onrender.com
- Full packet (source, writeups, tests): https://github.com/mdobrian/ajaia-paper
- Walkthrough video: Loom URL is in the form field above

First load after idle can take about a minute on Render’s free plan.

## Reviewer access

Password for all accounts: `paper123`

- `alex@ajaia.test` — owns the sample document
- `jordan@ajaia.test` — share with this account
- `sam@ajaia.test` — no access until shared

Suggested path: sign in as Alex, open **Welcome to Paper**, share with `jordan@ajaia.test`, sign out, sign in as Jordan. It should appear under **Shared with me** (slate blue). Owned cards are forest green.

## Local run

```bash
cd web
npm install
npm test
npm run dev
```

Or from the repo root: `docker compose up --build`

Open http://localhost:3000

## What works

- Create, rename, edit (bold, italic, underline, headings, lists), autosave, reopen
- Import `.txt` and `.md` only; Word, PDF, and images are rejected
- Markdown inspect/repair on upload (fix and import, or import as-is)
- Owner shares by email; recipients can edit; only the owner can re-share
- Owned vs shared lists (forest green vs slate blue)
- SQLite persistence across refresh
- Owner delete (type `delete`), owner unshare, recipient leave (type `leave`), duplicate
- Export `.md` / `.txt` / text PDF
- Snapshot version history
- Comments: anyone with access can comment; resolve requires a written response; only the commenter can delete (type `delete`)
- Tests: `cd web && npm test` — 86 offline Vitest tests

## What is incomplete

- No real-time collaboration, viewer-vs-editor roles, or suggestion mode
- No `.docx` import
- PDF is a small text PDF, not a print-preview of the editor
- Render free disk is not durable across every cold start; accounts reseed when the database is empty

## Architecture

Paper is a deep slice, not a Google Docs clone.

- Next.js 16 App Router, TypeScript, TipTap 3
- SQLite via Node 22 `node:sqlite` (`web/src/lib/documents.ts`)
- Signed cookie sessions (user id + HMAC only)
- Seeded accounts instead of a sign-up flow

Request path: browser → `web/src/app/api/*` → document store → SQLite.

Local npm uses `web/data/paper.db`. Docker and Render use `DATA_DIR=/data`.

Priorities:

1. Editing that feels like a document
2. Import as conversion, not file storage (raw bytes never written to disk)
3. Sharing you can demo in two logins
4. Tests on product rules, not a browser suite

Cuts: realtime, suggestion mode, viewer/editor roles, `.docx` (zip+XML would eat the timebox), Vercel (no disk for SQLite), StudLab production (separate Render service).

## AI workflow

Built in Cursor as a pair-programmer, not a substitute for product decisions. No Copilot/ChatGPT outside this workspace.

Where AI helped: TDD sequencing (import → persist → share → editor), upload corner-case tests, TipTap toolbar, Docker/Render packaging, stretch (repair, export, versions, comments).

What I rejected: Google Docs clone / OT / presence; Vercel; deploying onto StudLab; treating delete/unshare as original requirements (shipped later as stretch); accepting every file type; a Playwright suite (removed; video is the UI walkthrough); Cache Components on an authenticated editor.

Verification: `cd web && npm test` (86 tests), production `next build`, live check of Alex → share → Jordan’s Shared with me list.

## If I had 2–4 more hours

- Autosave status that is harder to miss
- Persistent disk on Render
- Print-fidelity PDF if a reviewer needed a pixel match of the editor
