import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

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
  const sam = store.createUser({
    email: "sam@ajaia.test",
    name: "Sam",
    password: "paper123",
  });
  if (!alex.ok || !jordan.ok || !sam.ok) {
    throw new Error("seed failed");
  }
  return { alex: alex.user, jordan: jordan.user, sam: sam.user };
}

describe("product spec", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("creates, renames, edits, and reopens a document with formatting intact", () => {
    store = createDocumentStore();
    const { alex } = seed(store);

    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const renamed = store.renameDocument({
      userId: alex.id,
      documentId: created.document.id,
      title: "Kickoff",
    });
    const edited = store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: "<h1>Hello</h1><p><strong>Bold</strong></p>",
    });
    expect(renamed.ok && edited.ok).toBe(true);

    const reopened = store.getAccessibleDocument(alex.id, created.document.id);
    expect(reopened).toMatchObject({
      title: "Kickoff",
      contentHtml: "<h1>Hello</h1><p><strong>Bold</strong></p>",
    });
  });

  it("uploads a .txt file into an owned document and rejects unsupported types", () => {
    store = createDocumentStore();
    const { alex } = seed(store);

    const uploaded = store.importFile({
      ownerId: alex.id,
      filename: "Manthan.txt",
      bytes: encode("Uploaded notes"),
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    expect(uploaded.document.title).toBe("Manthan");
    expect(store.listLibrary(alex.id).owned).toHaveLength(1);

    expect(
      store.importFile({
        ownerId: alex.id,
        filename: "photo.png",
        bytes: encode("nope"),
      }),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(store.listLibrary(alex.id).owned).toHaveLength(1);
  });

  it("shares with another user, then unshares so they lose access", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      store.shareDocument({
        documentId: created.document.id,
        ownerId: alex.id,
        recipientEmail: "jordan@ajaia.test",
      }),
    ).toEqual({ ok: true });

    expect(store.listLibrary(jordan.id).shared).toHaveLength(1);
    expect(store.listLibrary(alex.id).owned).toHaveLength(1);
    expect(store.listLibrary(alex.id).shared).toEqual([]);
    expect(
      store.listRecipients({
        userId: alex.id,
        documentId: created.document.id,
      }),
    ).toEqual({
      ok: true,
      recipients: [{ email: "jordan@ajaia.test", name: "Jordan" }],
    });

    expect(
      store.unshareDocument({
        documentId: created.document.id,
        ownerId: alex.id,
        recipientEmail: "jordan@ajaia.test",
      }),
    ).toEqual({ ok: true });

    expect(store.listLibrary(jordan.id).shared).toEqual([]);
    expect(store.getAccessibleDocument(jordan.id, created.document.id)).toBeNull();
    expect(store.getAccessibleDocument(alex.id, created.document.id)?.id).toBe(
      created.document.id,
    );
    expect(store.getAccessibleDocument(sam.id, created.document.id)).toBeNull();
  });

  it("lets only the owner delete, and removing a document drops shares too", () => {
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
      store.deleteDocument({
        userId: jordan.id,
        documentId: created.document.id,
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Only the owner can delete this document.",
    });
    expect(store.getDocument(created.document.id)?.id).toBe(created.document.id);

    expect(
      store.deleteDocument({
        userId: alex.id,
        documentId: created.document.id,
      }),
    ).toEqual({ ok: true });

    expect(store.getDocument(created.document.id)).toBeNull();
    expect(store.listLibrary(alex.id).owned).toEqual([]);
    expect(store.listLibrary(jordan.id).shared).toEqual([]);
  });

  it("rejects unshare and delete on a missing document", () => {
    store = createDocumentStore();
    const { alex, jordan } = seed(store);

    expect(
      store.unshareDocument({
        documentId: "missing",
        ownerId: alex.id,
        recipientEmail: jordan.email,
      }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Document not found.",
    });
    expect(
      store.deleteDocument({ userId: alex.id, documentId: "missing" }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Document not found.",
    });
  });
});
