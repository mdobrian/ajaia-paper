/**
 * Process-wide SQLite store.
 *
 * Next.js may evaluate this module more than once in dev, so we hang the open
 * database on globalThis. Docker sets DATA_DIR=/data so the file lives on a
 * volume instead of the container overlay.
 */
import fs from "node:fs";
import path from "node:path";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { createDocumentStore, type DocumentStore } from "./documents";

const globalForStore = globalThis as typeof globalThis & {
  paperStore?: DocumentStore;
};

export function getStore(): DocumentStore {
  if (!globalForStore.paperStore) {
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const store = createDocumentStore(path.join(dataDir, "paper.db"));
    seed(store);
    globalForStore.paperStore = store;
  }
  return globalForStore.paperStore;
}

function seed(store: DocumentStore) {
  for (const account of DEMO_ACCOUNTS) {
    store.createUser({
      email: account.email,
      name: account.name,
      password: account.password,
    });
  }

  const alex = store.authenticate({
    email: DEMO_ACCOUNTS[0].email,
    password: DEMO_ACCOUNTS[0].password,
  });
  if (!alex.ok || store.listLibrary(alex.user.id).owned.length > 0) {
    return;
  }

  store.importFile({
    ownerId: alex.user.id,
    filename: "welcome.md",
    bytes: new TextEncoder().encode(
      [
        "# Welcome to Paper",
        "",
        "This is a lightweight collaborative document for the Ajaia take-home.",
        "",
        "Try **bold**, *italic*, and a list:",
        "",
        "- Create a document or import a .txt / .md file",
        "- Share this file with jordan@ajaia.test",
        "- Sign in as Jordan to see it under Shared with me",
      ].join("\n"),
    ),
  });
}
