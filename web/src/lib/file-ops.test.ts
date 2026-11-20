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

describe("leave and duplicate", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("lets a recipient leave without deleting the owner's document", () => {
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
      store.leaveDocument({
        userId: alex.id,
        documentId: created.document.id,
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Owners cannot leave. Delete the document instead.",
    });

    expect(
      store.leaveDocument({
        userId: jordan.id,
        documentId: created.document.id,
      }),
    ).toEqual({ ok: true });

    expect(store.getAccessibleDocument(jordan.id, created.document.id)).toBeNull();
    expect(store.getDocument(created.document.id)?.id).toBe(created.document.id);
    expect(
      store.listRecipients({
        userId: alex.id,
        documentId: created.document.id,
      }),
    ).toEqual({ ok: true, recipients: [] });
  });

  it("duplicates a document the user can access into a private copy they own", () => {
    store = createDocumentStore();
    const { alex, jordan } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    store.renameDocument({
      userId: alex.id,
      documentId: created.document.id,
      title: "Kickoff",
    });
    store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: "<p>Shared notes</p>",
    });
    store.shareDocument({
      documentId: created.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });

    const copy = store.duplicateDocument({
      userId: jordan.id,
      documentId: created.document.id,
    });
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;

    expect(copy.document.ownerId).toBe(jordan.id);
    expect(copy.document.title).toBe("Copy of Kickoff");
    expect(copy.document.contentHtml).toBe("<p>Shared notes</p>");
    expect(copy.document.id).not.toBe(created.document.id);
    expect(store.listLibrary(jordan.id).owned.map((doc) => doc.id)).toEqual([
      copy.document.id,
    ]);
    expect(
      store.listRecipients({
        userId: jordan.id,
        documentId: copy.document.id,
      }),
    ).toEqual({ ok: true, recipients: [] });
  });

  it("does not duplicate a document the user cannot open", () => {
    store = createDocumentStore();
    const { alex, jordan } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      store.duplicateDocument({
        userId: jordan.id,
        documentId: created.document.id,
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have access to this document.",
    });
  });
});
