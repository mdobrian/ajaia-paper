import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("createDocumentStore", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("persists an imported text file so it can be reopened with formatting intact", () => {
    store = createDocumentStore();

    const result = store.importFile({
      ownerId: "user-alex",
      filename: "meeting-notes.txt",
      bytes: encode("Hello team\n\nPlease review."),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reopened = store.getDocument(result.document.id);
    expect(reopened).toMatchObject({
      id: result.document.id,
      title: "meeting-notes",
      contentHtml: "<p>Hello team</p><p>Please review.</p>",
      ownerId: "user-alex",
    });
    expect(reopened?.createdAt).toBe(reopened?.updatedAt);
  });

  it("preserves markdown structure after a round trip through SQLite", () => {
    store = createDocumentStore();

    const result = store.importFile({
      ownerId: "user-alex",
      filename: "spec.md",
      bytes: encode("# Title\n\nThis is **bold** and *italic*.\n\n- one\n- two\n"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.getDocument(result.document.id)?.contentHtml).toBe(
      "<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em>.</p><ul><li>one</li><li>two</li></ul>",
    );
  });

  it("does not write a row when the upload itself is rejected", () => {
    store = createDocumentStore();

    const result = store.importFile({
      ownerId: "user-alex",
      filename: "resume.docx",
      bytes: encode("pretend-docx"),
    });

    expect(result).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
    expect(store.listDocumentIds()).toEqual([]);
  });

  it("rejects a missing owner before touching the database", () => {
    store = createDocumentStore();

    expect(
      store.importFile({
        ownerId: "  ",
        filename: "notes.txt",
        bytes: encode("Hello"),
      }),
    ).toEqual({
      ok: false,
      code: "OWNER_REQUIRED",
      error: "An owner is required to import a document.",
    });
    expect(store.listDocumentIds()).toEqual([]);
  });

  it("returns null for an unknown or empty document id", () => {
    store = createDocumentStore();

    expect(store.getDocument("missing-id")).toBeNull();
    expect(store.getDocument("")).toBeNull();
    expect(store.getDocument("   ")).toBeNull();
  });

  it("stores the basename only when the client sends a path-like filename", () => {
    store = createDocumentStore();

    const result = store.importFile({
      ownerId: "user-alex",
      filename: "../../etc/passwd.txt",
      bytes: encode("root:x"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.title).toBe("passwd");
    expect(store.getDocument(result.document.id)?.title).toBe("passwd");
  });

  it("keeps unicode titles and bodies intact", () => {
    store = createDocumentStore();

    const result = store.importFile({
      ownerId: "user-alex",
      filename: "会议笔记.md",
      bytes: encode("你好"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.getDocument(result.document.id)).toMatchObject({
      title: "会议笔记",
      contentHtml: "<p>你好</p>",
    });
  });

  it("creates two documents when the same filename is imported twice", () => {
    store = createDocumentStore();
    const bytes = encode("Draft");

    const first = store.importFile({
      ownerId: "user-alex",
      filename: "notes.txt",
      bytes,
    });
    const second = store.importFile({
      ownerId: "user-alex",
      filename: "notes.txt",
      bytes,
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.document.id).not.toBe(second.document.id);
    expect(store.listDocumentIds()).toHaveLength(2);
  });

  it("treats quotes and SQL-like text as document content, not queries", () => {
    store = createDocumentStore();
    const payload = "'; DROP TABLE documents; --";

    const result = store.importFile({
      ownerId: "user-alex",
      filename: `${payload}.txt`,
      bytes: encode(payload),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reopened = store.getDocument(result.document.id);
    expect(reopened?.title).toBe(payload);
    expect(reopened?.contentHtml).toBe(`<p>${payload}</p>`);
    expect(store.listDocumentIds()).toHaveLength(1);
  });

  it("does not leak documents from a different in-memory database", () => {
    store = createDocumentStore();
    const created = store.importFile({
      ownerId: "user-alex",
      filename: "notes.txt",
      bytes: encode("Hello"),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const other = createDocumentStore();
    expect(other.getDocument(created.document.id)).toBeNull();
    other.close();
  });
});
