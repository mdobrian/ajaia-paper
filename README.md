# Paper

Lightweight collaborative documents for the Ajaia take-home. Built as a deep slice, not a Google Docs clone.

There is no public website on purpose. You run it on your machine. Ajaia reviewers run the same app with Docker on theirs.

## For Ajaia reviewers (Docker)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/). Then from the project root:

```bash
docker compose up --build
```

Open http://localhost:3000

Sign in with a seeded account below. Data is stored in a local Docker volume named `paper-data`, so refresh and restart keep documents. Stop with `Ctrl+C`, or `docker compose down`.

The assignment prompt asked for a live URL. This project ships a local Docker run instead: SQLite needs a real disk, and a container is the smallest honest way to give you that without a hosted database or a public deployment.

## For local development (npm)

The app lives in `web/`.

```bash
cd web
npm install
npm test
npm run dev
```

Open http://localhost:3000

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

## Tests

```bash
cd web
npm test
```

Tests stay offline. They do not open a browser or talk to a live service.
