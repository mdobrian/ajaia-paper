# Architecture

Paper is a small collaborative document app for the Ajaia take-home. The goal was a working product slice in 4–6 hours, not a Google Docs clone.

## What we built

- Next.js app in `web/` (App Router, TypeScript, TipTap 3)
- SQLite via Node’s built-in `node:sqlite`, wrapped in `web/src/lib/documents.ts`
- Signed cookie sessions (`web/src/lib/session.ts`)
- Seeded accounts instead of a full sign-up flow

Request path: browser → route handlers under `web/src/app/api` → document store → SQLite file.

Local npm uses `web/data/paper.db`. Docker and Render use `DATA_DIR=/data`.

## What we prioritized

1. **Editing that feels like a document.** Create, rename, rich text, autosave, reopen. This is the thing reviewers will spend time in.
2. **Import as the file-upload story.** A `.txt` or `.md` file becomes an editable document. Conversion happens in memory. We do not store the raw upload, which avoids path-traversal on disk.
3. **Sharing you can demonstrate in two logins.** Owner, grant-by-email, owned vs shared lists (forest green vs slate blue). Recipients can edit. Only the owner can share.
4. **Tests on the rules, not the framework.** Import, persistence, access, export, versions, comments, and the reviewer journeys are covered by offline Vitest (`cd web && npm test`, 84 tests). Default `npm test` does not open a browser.

## Supplemental (after the core slice)

- Owner delete, owner unshare with a recipient list, recipient leave, duplicate
- Export to `.md` / `.txt` / a small text PDF (not a print-preview of TipTap)
- Snapshot version history on body changes; title-only edits update the latest snapshot
- Comments: `author_id` + `document_id`, TipTap mark (not character offsets) plus a sidebar. Anyone with access can comment or resolve; only the commenter or owner can delete
- Markdown inspect/repair against the subset Paper actually converts

## What we cut

- Real-time collaboration, suggestion mode, viewer-vs-editor roles
- `.docx` import (zip+XML; would dominate the timebox)
- Role-based ACLs beyond owner vs has-access
- Print-fidelity PDF / Chromium

## Deployment

Render hosts the live demo at https://ajaia-paper.onrender.com. That is a **new** web service. It is not the StudLab app.

Vercel was a poor fit: serverless filesystems do not keep SQLite. Docker Compose remains the local one-command path for reviewers who want to run it themselves.

The free Render instance may sleep. The first request after idle can take a minute. Accounts are reseeded when the database is empty.

## Layout

```
web/src/lib/import-file.ts          upload validation and .txt/.md → HTML
web/src/lib/markdown-structure.ts   inspect/repair the subset Paper converts
web/src/lib/export-file.ts          stored HTML → .md / .txt / text PDF
web/src/lib/documents.ts            SQLite users, documents, shares, versions, comments
web/src/lib/store.ts                process-wide DB + seed accounts
web/src/components/CommentAnchor.ts TipTap mark keyed by comment id
web/src/app/api/*                   HTTP for login, documents, import, share, export, versions, comments
web/src/app/login                   seeded login
web/src/app/page.tsx                owned vs shared library
web/src/app/d/[id]                  editor, share, export, versions, comments
```
