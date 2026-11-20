import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function seedReviewers(store: DocumentStore) {
  const alex = store.createUser({
    email: "alex@ajaia.test",
    name: "Alex Rivera",
    password: "paper123",
  });
  const jordan = store.createUser({
    email: "jordan@ajaia.test",
    name: "Jordan Lee",
    password: "paper123",
  });
  const sam = store.createUser({
    email: "sam@ajaia.test",
    name: "Sam Okonkwo",
    password: "paper123",
  });
  if (!alex.ok || !jordan.ok || !sam.ok) {
    throw new Error("failed to seed reviewers");
  }
  return { alex: alex.user, jordan: jordan.user, sam: sam.user };
}

describe("reviewer demo journey", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("imports a .txt file, shares it, and shows it only under Shared with me for the recipient", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seedReviewers(store);

    const imported = store.importFile({
      ownerId: alex.id,
      filename: "Manthan.txt",
      bytes: encode("Notes from the upload."),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.document.title).toBe("Manthan");
    expect(imported.document.contentHtml).toBe("<p>Notes from the upload.</p>");

    expect(
      store.shareDocument({
        documentId: imported.document.id,
        ownerId: alex.id,
        recipientEmail: "  Jordan@Ajaia.test ",
      }),
    ).toEqual({ ok: true });

    const alexLibrary = store.listLibrary(alex.id);
    expect(alexLibrary.owned.map((doc) => doc.title)).toEqual(["Manthan"]);
    expect(alexLibrary.shared).toEqual([]);

    const jordanLibrary = store.listLibrary(jordan.id);
    expect(jordanLibrary.owned).toEqual([]);
    expect(jordanLibrary.shared.map((doc) => doc.title)).toEqual(["Manthan"]);

    expect(store.getAccessibleDocument(jordan.id, imported.document.id)?.title).toBe(
      "Manthan",
    );
    expect(store.getAccessibleDocument(sam.id, imported.document.id)).toBeNull();
  });

  it("unshares, lets the recipient leave, and deletes so the file is gone for everyone", () => {
    store = createDocumentStore();
    const { alex, jordan } = seedReviewers(store);

    const imported = store.importFile({
      ownerId: alex.id,
      filename: "Manthan.txt",
      bytes: encode("Notes from the upload."),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });

    expect(
      store.unshareDocument({
        documentId: imported.document.id,
        ownerId: alex.id,
        recipientEmail: jordan.email,
      }),
    ).toEqual({ ok: true });
    expect(store.listLibrary(jordan.id).shared).toEqual([]);

    store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });
    expect(
      store.leaveDocument({
        userId: jordan.id,
        documentId: imported.document.id,
      }),
    ).toEqual({ ok: true });
    expect(store.getDocument(imported.document.id)?.title).toBe("Manthan");

    store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });
    expect(
      store.deleteDocument({
        userId: alex.id,
        documentId: imported.document.id,
      }),
    ).toEqual({ ok: true });
    expect(store.getDocument(imported.document.id)).toBeNull();
    expect(store.listLibrary(jordan.id).shared).toEqual([]);
  });

  it("does not create a document when the upload is not .txt or .md", () => {
    store = createDocumentStore();
    const { alex } = seedReviewers(store);

    const rejected = store.importFile({
      ownerId: alex.id,
      filename: "resume.docx",
      bytes: encode("not actually a docx"),
    });

    expect(rejected).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(store.listLibrary(alex.id).owned).toEqual([]);
  });
});
