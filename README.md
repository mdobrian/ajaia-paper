# Paper

Lightweight collaborative documents for the Ajaia take-home. Built as a deep slice, not a Google Docs clone.

## Live demo

**https://ajaia-paper.onrender.com**

This is a separate Render service. It is not StudLab. The first load after idle time can take a minute on the free plan.

## Reviewer accounts

Password for all accounts: `paper123`

| Email | Role |
| --- | --- |
| `alex@ajaia.test` | Owns the sample document |
| `jordan@ajaia.test` | Share Alex's document with this account |
| `sam@ajaia.test` | No access until someone shares |

Suggested sharing path: sign in as Alex, open **Welcome to Paper**, share with `jordan@ajaia.test`, sign out, sign in as Jordan. The document should appear under **Shared with me**.

Owned cards are forest green (**Yours**). Shared cards are slate blue (**Shared**).

## What works

- Create, rename, edit, autosave, and reopen documents
- Rich text: bold, italic, underline, headings, bullets, numbered lists
- Import `.txt` and `.md` only (Word, PDF, and images are rejected)
- Markdown uploads can be inspected and optionally repaired (heading space, list markers, unclosed `**` / fences), then imported as-is or after fix
- Seeded login and email sharing; only the owner can share; recipients can edit
- Owned vs shared lists, color-coded
- SQLite persistence across refresh
- Supplemental: owner delete (type `delete` to confirm), owner unshare, recipient leave (type `leave` to confirm), duplicate, export `.md` / `.txt` / PDF, snapshot version history
- Comments: anyone with access can comment; resolve by writing a short response (saved on the comment); only the commenter can delete, and they type `delete` to confirm

Intentionally out of scope: real-time collaboration, viewer-vs-editor roles, suggestion mode, `.docx` import, Drive uploads.

See `ARCHITECTURE.md`, `AI_WORKFLOW.md`, and `SUBMISSION.md`.

## Run locally with npm

```bash
cd web
npm install
npm test
npm run dev
```

Open http://localhost:3000

## Run locally with Docker

```bash
docker compose up --build
```

Open http://localhost:3000

## Tests

```bash
cd web
npm test
```

Offline Vitest, 86 tests. They cover import, sharing, editing, markdown inspect/repair, export, versions, comments, and the reviewer journeys. They do not open a browser or talk to a live service.
