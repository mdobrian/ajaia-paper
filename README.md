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

## What works

- Create, rename, edit, save, and reopen documents
- Rich text: bold, italic, underline, headings, bullets, numbered lists
- Import `.txt` and `.md` only (Word, PDF, and images are rejected in the UI)
- Seeded login and email sharing, with owned vs shared lists
- SQLite persistence across refresh

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

Tests stay offline. They do not open a browser or talk to a live service.
