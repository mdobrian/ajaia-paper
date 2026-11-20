import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function seedPeople(store: DocumentStore) {
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
    throw new Error("failed to seed users");
  }
  return { alex: alex.user, jordan: jordan.user, sam: sam.user };
}

describe("editing", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("creates a blank untitled document for the owner", () => {
    store = createDocumentStore();
    const { alex } = seedPeople(store);

    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.document.title).toBe("Untitled");
    expect(created.document.contentHtml).toBe("<p></p>");
    expect(store.listLibrary(alex.id).owned).toHaveLength(1);
  });

  it("lets anyone with access rename and save, and blocks everyone else", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seedPeople(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    store.shareDocument({
      documentId: created.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });

    expect(
      store.renameDocument({
        userId: alex.id,
        documentId: created.document.id,
        title: "Kickoff notes",
      }),
    ).toMatchObject({ ok: true, document: { title: "Kickoff notes" } });

    expect(
      store.saveContent({
        userId: jordan.id,
        documentId: created.document.id,
        contentHtml: "<p>Jordan was here</p>",
      }),
    ).toMatchObject({
      ok: true,
      document: { contentHtml: "<p>Jordan was here</p>" },
    });

    expect(
      store.renameDocument({
        userId: sam.id,
        documentId: created.document.id,
        title: "Hijacked",
      }),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have access to this document.",
    });
    expect(store.getDocument(created.document.id)?.title).toBe("Kickoff notes");
  });

  it("rejects a blank title and still trims surrounding whitespace", () => {
    store = createDocumentStore();
    const { alex } = seedPeople(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      store.renameDocument({
        userId: alex.id,
        documentId: created.document.id,
        title: "   ",
      }),
    ).toEqual({
      ok: false,
      code: "TITLE_REQUIRED",
      error: "A title is required.",
    });

    const renamed = store.renameDocument({
      userId: alex.id,
      documentId: created.document.id,
      title: "  Weekly notes  ",
    });
    expect(renamed).toMatchObject({ ok: true, document: { title: "Weekly notes" } });
  });

  it("strips script tags from saved HTML so an editor payload cannot inject JS", () => {
    store = createDocumentStore();
    const { alex } = seedPeople(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const saved = store.saveContent({
      userId: alex.id,
      documentId: created.document.id,
      contentHtml: '<p>Safe</p><script>alert(1)</script>',
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.document.contentHtml).toBe("<p>Safe</p>");
    expect(saved.document.contentHtml).not.toContain("<script>");
  });

  it("returns NOT_FOUND when renaming a document that does not exist", () => {
    store = createDocumentStore();
    const { alex } = seedPeople(store);

    expect(
      store.renameDocument({
        userId: alex.id,
        documentId: "missing",
        title: "Nope",
      }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Document not found.",
    });
  });
});

describe("authenticate", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("returns the user for a valid email and password, ignoring email case", () => {
    store = createDocumentStore();
    seedPeople(store);

    const result = store.authenticate({
      email: "  ALEX@ajaia.test ",
      password: "paper123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({
      email: "alex@ajaia.test",
      name: "Alex",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("uses the same error for a bad password and an unknown email", () => {
    store = createDocumentStore();
    seedPeople(store);
    const expected = {
      ok: false,
      code: "INVALID_CREDENTIALS",
      error: "Email or password is incorrect.",
    };

    expect(
      store.authenticate({ email: "alex@ajaia.test", password: "wrong" }),
    ).toEqual(expected);
    expect(
      store.authenticate({ email: "missing@ajaia.test", password: "paper123" }),
    ).toEqual(expected);
    expect(store.authenticate({ email: "", password: "paper123" })).toEqual(expected);
  });
});
