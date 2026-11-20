import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function seedPeople(store: DocumentStore) {
  const alex = store.createUser({ email: "alex@ajaia.test", name: "Alex" });
  const jordan = store.createUser({ email: "jordan@ajaia.test", name: "Jordan" });
  const sam = store.createUser({ email: "sam@ajaia.test", name: "Sam" });
  expect(alex.ok && jordan.ok && sam.ok).toBe(true);
  if (!alex.ok || !jordan.ok || !sam.ok) {
    throw new Error("failed to seed users");
  }
  return { alex: alex.user, jordan: jordan.user, sam: sam.user };
}

describe("sharing", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("lets an owner grant access and keeps owned vs shared lists distinct", () => {
    store = createDocumentStore();
    const { alex, jordan } = seedPeople(store);

    const imported = store.importFile({
      ownerId: alex.id,
      filename: "kickoff.txt",
      bytes: encode("Agenda"),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const shared = store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: "jordan@ajaia.test",
    });
    expect(shared).toEqual({ ok: true });

    const alexLibrary = store.listLibrary(alex.id);
    expect(alexLibrary.owned.map((doc) => doc.id)).toEqual([imported.document.id]);
    expect(alexLibrary.shared).toEqual([]);

    const jordanLibrary = store.listLibrary(jordan.id);
    expect(jordanLibrary.owned).toEqual([]);
    expect(jordanLibrary.shared.map((doc) => doc.id)).toEqual([imported.document.id]);
    expect(jordanLibrary.shared[0]?.title).toBe("kickoff");
  });

  it("allows the recipient to open the document and hides it from everyone else", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seedPeople(store);
    const imported = store.importFile({
      ownerId: alex.id,
      filename: "kickoff.txt",
      bytes: encode("Agenda"),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: "Jordan@Ajaia.test",
    });

    expect(store.getAccessibleDocument(alex.id, imported.document.id)?.contentHtml).toBe(
      "<p>Agenda</p>",
    );
    expect(store.getAccessibleDocument(jordan.id, imported.document.id)?.title).toBe("kickoff");
    expect(store.getAccessibleDocument(sam.id, imported.document.id)).toBeNull();
  });

  it("rejects sharing with an unknown email, the owner, or a blank recipient", () => {
    store = createDocumentStore();
    const { alex } = seedPeople(store);
    const imported = store.importFile({
      ownerId: alex.id,
      filename: "kickoff.txt",
      bytes: encode("Agenda"),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(
      store.shareDocument({
        documentId: imported.document.id,
        ownerId: alex.id,
        recipientEmail: "missing@ajaia.test",
      }),
    ).toEqual({
      ok: false,
      code: "USER_NOT_FOUND",
      error: "No user exists with that email.",
    });

    expect(
      store.shareDocument({
        documentId: imported.document.id,
        ownerId: alex.id,
        recipientEmail: "  ALEX@ajaia.test  ",
      }),
    ).toEqual({
      ok: false,
      code: "SHARE_WITH_SELF",
      error: "You already own this document.",
    });

    expect(
      store.shareDocument({
        documentId: imported.document.id,
        ownerId: alex.id,
        recipientEmail: "   ",
      }),
    ).toEqual({
      ok: false,
      code: "RECIPIENT_REQUIRED",
      error: "An email is required to share.",
    });
  });

  it("does not let a non-owner share, even if they already have access", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seedPeople(store);
    const imported = store.importFile({
      ownerId: alex.id,
      filename: "kickoff.txt",
      bytes: encode("Agenda"),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: "jordan@ajaia.test",
    });

    expect(
      store.shareDocument({
        documentId: imported.document.id,
        ownerId: jordan.id,
        recipientEmail: "sam@ajaia.test",
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "Only the owner can share this document.",
    });
    expect(store.getAccessibleDocument(sam.id, imported.document.id)).toBeNull();
  });

  it("returns NOT_FOUND when sharing a document that does not exist", () => {
    store = createDocumentStore();
    const { alex, jordan } = seedPeople(store);

    expect(
      store.shareDocument({
        documentId: "missing-doc",
        ownerId: alex.id,
        recipientEmail: jordan.email,
      }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Document not found.",
    });
  });

  it("sharing twice with the same person is idempotent", () => {
    store = createDocumentStore();
    const { alex, jordan } = seedPeople(store);
    const imported = store.importFile({
      ownerId: alex.id,
      filename: "kickoff.txt",
      bytes: encode("Agenda"),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const first = store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: "jordan@ajaia.test",
    });
    const second = store.shareDocument({
      documentId: imported.document.id,
      ownerId: alex.id,
      recipientEmail: "jordan@ajaia.test",
    });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(store.listLibrary(jordan.id).shared).toHaveLength(1);
  });

  it("rejects a duplicate email when creating a user", () => {
    store = createDocumentStore();
    expect(store.createUser({ email: "alex@ajaia.test", name: "Alex" }).ok).toBe(true);
    expect(store.createUser({ email: "  ALEX@ajaia.test ", name: "Alexandra" })).toEqual({
      ok: false,
      code: "DUPLICATE_EMAIL",
      error: "A user with that email already exists.",
    });
  });
});
