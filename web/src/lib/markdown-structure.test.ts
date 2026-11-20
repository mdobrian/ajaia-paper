import { describe, expect, it } from "vitest";
import { importUploadedFile } from "./import-file";
import { inspectMarkdown, repairMarkdown } from "./markdown-structure";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("inspectMarkdown", () => {
  it("accepts the subset Paper actually converts", () => {
    const report = inspectMarkdown(
      "# Title\n\nThis is **bold** and *italic*.\n\n- one\n1. first\n",
    );
    expect(report.issues).toEqual([]);
  });

  it("flags ATX headings that omit the required space", () => {
    const report = inspectMarkdown("#Title\n##Also");
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "HEADING_MISSING_SPACE",
      "HEADING_MISSING_SPACE",
    ]);
    expect(report.issues[0]?.line).toBe(1);
    expect(report.issues[0]?.fixable).toBe(true);
  });

  it("flags headings deeper than h3, because the importer only maps h1-h3", () => {
    const report = inspectMarkdown("#### Deep");
    expect(report.issues).toEqual([
      expect.objectContaining({ code: "HEADING_TOO_DEEP", fixable: true, line: 1 }),
    ]);
  });

  it("flags list markers that omit the space Paper's converter requires", () => {
    const report = inspectMarkdown("-one\n2.two");
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "LIST_MISSING_SPACE",
      "ORDERED_LIST_MISSING_SPACE",
    ]);
  });

  it("flags an unclosed fenced code block", () => {
    const report = inspectMarkdown("Intro\n```\ncode");
    expect(report.issues).toEqual([
      expect.objectContaining({ code: "UNCLOSED_FENCE", fixable: true }),
    ]);
  });

  it("flags unmatched bold markers", () => {
    const report = inspectMarkdown("This is **bold");
    expect(report.issues).toEqual([
      expect.objectContaining({ code: "UNCLOSED_BOLD", fixable: true }),
    ]);
  });
});

describe("repairMarkdown", () => {
  it("inserts the missing heading space so the importer can make an h1", () => {
    expect(repairMarkdown("#Title\n")).toBe("# Title\n");
    const imported = importUploadedFile({
      filename: "notes.md",
      bytes: encode("#Title"),
      repairMarkdown: true,
    });
    expect(imported).toMatchObject({
      ok: true,
      contentHtml: "<h1>Title</h1>",
    });
  });

  it("caps h4+ to h3, the deepest heading the editor toolbar supports", () => {
    expect(repairMarkdown("#### Deep")).toBe("### Deep");
  });

  it("does not rewrite valid markdown", () => {
    const source = "# Title\n\n- one\n";
    expect(repairMarkdown(source)).toBe(source);
  });
});
