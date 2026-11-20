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

describe("comments", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("ties a comment to the commenter and the document id, not the title", () => {
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
    store.renameDocument({
      userId: alex.id,
      documentId: created.document.id,
      title: "Kickoff",
    });

    const posted = store.addComment({
      userId: jordan.id,
      documentId: created.document.id,
      body: "Can we tighten this?",
      quote: "Draft one",
      anchorId: "anchor-1",
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    expect(posted.comment).toMatchObject({
      documentId: created.document.id,
      authorId: jordan.id,
      authorName: "Jordan",
      authorEmail: "jordan@ajaia.test",
      body: "Can we tighten this?",
      quote: "Draft one",
      anchorId: "anchor-1",
      resolvedAt: null,
    });

    const listed = store.listComments({
      userId: alex.id,
      documentId: created.document.id,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.comments).toHaveLength(1);
    expect(listed.comments[0]?.authorId).toBe(jordan.id);
  });

  it("lets anyone with access comment or resolve, and only author or owner delete", () => {
    store = createDocumentStore();
    const { alex, jordan, sam } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    store.shareDocument({
      documentId: created.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });

    expect(
      store.addComment({
        userId: sam.id,
        documentId: created.document.id,
        body: "Nope",
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const posted = store.addComment({
      userId: jordan.id,
      documentId: created.document.id,
      body: "Looks good",
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;

    expect(
      store.deleteComment({
        userId: sam.id,
        documentId: created.document.id,
        commentId: posted.comment.id,
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(
      store.resolveComment({
        userId: alex.id,
        documentId: created.document.id,
        commentId: posted.comment.id,
      }),
    ).toMatchObject({ ok: true });

    const resolved = store.listComments({
      userId: jordan.id,
      documentId: created.document.id,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.comments[0]?.resolvedAt).toEqual(expect.any(String));

    expect(
      store.deleteComment({
        userId: alex.id,
        documentId: created.document.id,
        commentId: posted.comment.id,
      }),
    ).toEqual({ ok: true });
    expect(
      store.listComments({
        userId: alex.id,
        documentId: created.document.id,
      }),
    ).toMatchObject({ ok: true, comments: [] });
  });

  it("rejects a blank comment body", () => {
    store = createDocumentStore();
    const { alex } = seed(store);
    const created = store.createDocument({ ownerId: alex.id });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      store.addComment({
        userId: alex.id,
        documentId: created.document.id,
        body: "   ",
      }),
    ).toEqual({
      ok: false,
      code: "COMMENT_REQUIRED",
      error: "A comment is required.",
    });
  });
});
