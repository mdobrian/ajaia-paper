import { describe, expect, it } from "vitest";
import {
  documentDownloadName,
  exportDocument,
  htmlToMarkdown,
  htmlToPlainText,
} from "./export-file";

describe("htmlToMarkdown", () => {
  it("round-trips headings, emphasis, lists, and paragraphs", () => {
    const html =
      "<h1>Kickoff</h1><p><strong>Bold</strong> and <em>italic</em> and <u>underlined</u></p><ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>";

    expect(htmlToMarkdown(html)).toBe(
      [
        "# Kickoff",
        "",
        "**Bold** and *italic* and underlined",
        "",
        "- One",
        "- Two",
        "",
        "1. First",
      ].join("\n"),
    );
  });

  it("does not keep script tags in an export", () => {
    expect(htmlToMarkdown("<p>Hello<script>alert(1)</script></p>")).toBe("Hello");
  });
});

describe("htmlToPlainText", () => {
  it("strips tags and keeps readable line breaks", () => {
    expect(htmlToPlainText("<h1>Title</h1><p>Line one<br>Line two</p>")).toBe(
      "Title\n\nLine one\nLine two",
    );
  });
});

describe("documentDownloadName", () => {
  it("uses the title and a safe extension", () => {
    expect(documentDownloadName("Kickoff notes", "md")).toBe("Kickoff-notes.md");
  });

  it("strips path characters so an export cannot escape a download folder", () => {
    expect(documentDownloadName("../secret.txt", "txt")).toBe("secret.txt");
  });

  it("names a PDF from the title", () => {
    expect(documentDownloadName("Kickoff notes", "pdf")).toBe("Kickoff-notes.pdf");
  });
});

describe("exportDocument pdf", () => {
  it("builds a PDF that contains the title and body text", () => {
    const file = exportDocument({
      title: "Kickoff",
      contentHtml: "<h1>Hello</h1><p>Team notes</p>",
      format: "pdf",
    });
    expect(file.filename).toBe("Kickoff.pdf");
    expect(file.contentType).toBe("application/pdf");
    expect(file.body).toBeInstanceOf(Uint8Array);
    const pdf = new TextDecoder("latin1").decode(file.body as Uint8Array);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Kickoff");
    expect(pdf).toContain("Team notes");
  });
});

