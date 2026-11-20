import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function seed(store: DocumentStore) {
  const alex = store.createUser({
    email: "alex@ajaia.test",
    name: "Alex",
    password: "paper123",
  });
  const jordan = store.createUser({
    email: "jordan@ajaia.test",
    name: "Jordan",
    password: "paper123",
  });
  if (!alex.ok || !jordan.ok) {
    throw new Error("seed failed");
  }
  return { alex: alex.user, jordan: jordan.user };
}

describe("version history", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("keeps a snapshot on create and on each real edit, then restore puts an old body back", () => {
    store = createDocumentStore();
    const { alex } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      store.listVersions({ userId: alex.id, documentId: created.document.id }),
    ).toMatchObject({ ok: true, versions: [{ title: "Untitled" }] });

    store.renameDocument({
      userId: alex.id,
      documentId: created.document.id,
      title: "Kickoff",
    });
    store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: "<p>Draft one</p>",
    });
    store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: "<p>Draft two</p>",
    });
    store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: "<p>Draft two</p>",
    });

    const listed = store.listVersions({
      userId: alex.id,
      documentId: created.document.id,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.versions.map((version) => version.contentHtml)).toEqual([
      "<p>Draft two</p>",
      "<p>Draft one</p>",
      "<p></p>",
    ]);
    expect(listed.versions[0]?.title).toBe("Kickoff");

    const older = listed.versions.find((version) => version.contentHtml === "<p>Draft one</p>");
    expect(older).toBeTruthy();
    if (!older) return;

    const restored = store.restoreVersion({
      userId: alex.id,
      documentId: created.document.id,
      versionId: older.id,
    });
    expect(restored).toMatchObject({
      ok: true,
      document: { title: "Kickoff", contentHtml: "<p>Draft one</p>" },
    });
    expect(
      store.getAccessibleDocument(alex.id, created.document.id)?.contentHtml,
    ).toBe("<p>Draft one</p>");
  });

  it("lets a collaborator read history and blocks everyone else", () => {
    store = createDocumentStore();
    const { alex, jordan } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    store.shareDocument({
      documentId: created.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });

    expect(
      store.listVersions({ userId: jordan.id, documentId: created.document.id }),
    ).toMatchObject({ ok: true });

    const sam = store.createUser({
      email: "sam@ajaia.test",
      name: "Sam",
      password: "paper123",
    });
    expect(sam.ok).toBe(true);
    if (!sam.ok) return;

    expect(
      store.listVersions({ userId: sam.user.id, documentId: created.document.id }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have access to this document.",
    });
  });
});
