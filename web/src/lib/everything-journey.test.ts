import { afterEach, describe, expect, it } from "vitest";
import { createDocumentStore, type DocumentStore } from "./documents";
import { exportDocument } from "./export-file";
import { inspectMarkdown } from "./markdown-structure";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function seed(store: DocumentStore) {
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
  if (!alex.ok || !jordan.ok) {
    throw new Error("seed failed");
  }
  return { alex: alex.user, jordan: jordan.user };
}

describe("full product journey", () => {
  let store: DocumentStore;

  afterEach(() => {
    store?.close();
  });

  it("inspects broken markdown, repairs on import, exports PDF, duplicates, and renames the copy", () => {
    store = createDocumentStore();
    const { alex, jordan } = seed(store);

    const source = "#CLZ Movie\n\n-cast\n\n**todo";
    const report = inspectMarkdown(source);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "HEADING_MISSING_SPACE",
      "LIST_MISSING_SPACE",
      "UNCLOSED_BOLD",
    ]);

    const asIs = store.importFile({
      ownerId: alex.id,
      filename: "clz-movie.md",
      bytes: encode(source),
    });
    expect(asIs.ok).toBe(true);
    if (!asIs.ok) return;
    expect(asIs.document.contentHtml).not.toContain("<h1>");

    const fixed = store.importFile({
      ownerId: alex.id,
      filename: "clz-movie.md",
      bytes: encode(source),
      repairMarkdown: true,
    });
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    expect(fixed.document.contentHtml).toContain("<h1>CLZ Movie</h1>");
    expect(fixed.document.contentHtml).toContain("<ul><li>cast</li></ul>");
    expect(fixed.document.contentHtml).toContain("<strong>todo</strong>");

    const pdf = exportDocument({
      title: fixed.document.title,
      contentHtml: fixed.document.contentHtml,
      format: "pdf",
    });
    expect(pdf.filename).toBe("clz-movie.pdf");
    const pdfText = new TextDecoder("latin1").decode(pdf.body as Uint8Array);
    expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfText).toContain("CLZ Movie");

    const markdown = exportDocument({
      title: fixed.document.title,
      contentHtml: fixed.document.contentHtml,
      format: "md",
    });
    expect(String(markdown.body)).toContain("# CLZ Movie");

    const copy = store.duplicateDocument({
      userId: alex.id,
      documentId: fixed.document.id,
    });
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.document.title).toBe("Copy of clz-movie");
    expect(copy.document.id).not.toBe(fixed.document.id);

    const renamed = store.renameDocument({
      userId: alex.id,
      documentId: copy.document.id,
      title: "CLZ Movie Notes",
    });
    expect(renamed).toMatchObject({
      ok: true,
      document: { title: "CLZ Movie Notes" },
    });
    expect(store.getAccessibleDocument(alex.id, copy.document.id)?.title).toBe(
      "CLZ Movie Notes",
    );

    store.shareDocument({
      documentId: copy.document.id,
      ownerId: alex.id,
      recipientEmail: jordan.email,
    });
    const comment = store.addComment({
      userId: jordan.id,
      documentId: copy.document.id,
      body: "Need a runtime.",
      quote: "CLZ Movie",
      anchorId: "anchor-clz",
    });
    expect(comment).toMatchObject({
      ok: true,
      comment: { authorName: "Jordan Lee", body: "Need a runtime." },
    });

    store.saveContent({
      userId: alex.id,
      documentId: copy.document.id,
      contentHtml: "<h1>CLZ Movie</h1><p>Edited after comment.</p>",
    });
    const history = store.listVersions({
      userId: alex.id,
      documentId: copy.document.id,
    });
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.versions.length).toBeGreaterThan(1);

    expect(store.listLibrary(jordan.id).shared.map((doc) => doc.title)).toEqual([
      "CLZ Movie Notes",
    ]);
    expect(store.listLibrary(alex.id).owned.map((doc) => doc.title)).toEqual([
      "clz-movie",
      "clz-movie",
      "CLZ Movie Notes",
    ]);
  });
});
