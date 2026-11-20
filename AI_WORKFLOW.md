# AI workflow

This take-home was built in Cursor. AI was used as a pair-programmer, not as a substitute for product decisions.

## Tools

- Cursor (this session)
- No Copilot/ChatGPT chat outside this workspace for the implementation

## Where it sped things up

- Turning the open-ended prompt into a sequenced TDD slice: import → persist → share → editor
- Writing corner-case tests for uploads (empty file, path-like names, HTML injection, oversize, bad UTF-8)
- TipTap toolbar wiring and the Docker/Render packaging
- Later stretch: markdown inspect/repair, export, versions, comments, owned vs shared color
- First drafts of README structure while the app was still moving

## What I changed or rejected

- **Not a Google Docs clone.** AI will happily build presence, OT, and suggestion mode. We did not. Comments and version history were added later as an explicit stretch, not as the first slice.
- **Not Vercel for this data model.** SQLite needs a disk. Render + Docker matched the storage choice.
- **Not StudLab production.** The existing Render service already hosts another product and has hit memory limits. Paper is its own service.
- **Not delete/unshare as original requirements.** The prompt only asked to grant access. We shipped them later as an explicit supplemental slice, with leave, duplicate, and export as the matching file operations.
- **Not `.docx` or “accept every file type.”** Import is conversion into an editable document. Extra types would be file storage or a zip+XML parser.
- **Not a browser test suite.** Product rules stay in offline Vitest. A Playwright pass was started and removed; the video is the UI walkthrough.
- **Not Cache Components** on an authenticated editor. Next.js 16 wanted a static shell around `useParams`; we turned that off rather than fight it.
- Import converts files; it does not keep the original bytes. Safer and enough for the demo.

## How we verified

- `cd web && npm test` — offline Vitest, 86 tests, including:
  - import, sharing, editing
  - markdown inspect/repair
  - export (including PDF)
  - versions and comments (author-only delete; resolve stores a written response)
  - reviewer journey (upload a `.txt`, share it, recipient sees it only under Shared with me)
  - full product journey (broken markdown → repair import → PDF → duplicate → rename → share → comment)
- Live check on https://ajaia-paper.onrender.com: sign in as Alex, import, share with Jordan, confirm Jordan’s Shared with me list
- Production `next build` before the first Docker/Render deploy
- Manual walkthrough of login, editor formatting, import repair, export, duplicate, rename, comments, and the owned vs shared split

AI drafted a lot of the test names and store code. I kept the failing-test-first loop, rejected extra features, and used the live site plus the test run as the source of truth.
