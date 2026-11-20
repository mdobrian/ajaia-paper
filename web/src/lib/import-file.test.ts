import { describe, expect, it } from "vitest";
import { IMPORT_MAX_BYTES, importUploadedFile } from "./import-file";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function importText(filename: string, text: string, maxBytes?: number) {
  return importUploadedFile({
    filename,
    bytes: encode(text),
    maxBytes,
  });
}

describe("importUploadedFile", () => {
  describe("plain text", () => {
    it("creates a document title from the filename and wraps paragraphs", () => {
      const result = importText("meeting-notes.txt", "Hello team\n\nPlease review.");

      expect(result).toEqual({
        ok: true,
        title: "meeting-notes",
        sourceType: "txt",
        contentHtml: "<p>Hello team</p><p>Please review.</p>",
      });
    });

    it("treats .TXT as text even when the extension is uppercase", () => {
      const result = importText("AGENDA.TXT", "Standup");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sourceType).toBe("txt");
        expect(result.title).toBe("AGENDA");
      }
    });

    it("escapes HTML so a .txt file cannot inject markup", () => {
      const result = importText("notes.txt", "<script>alert(1)</script>");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toBe(
          "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
        );
      }
    });

    it("preserves a single line break as a break inside a paragraph", () => {
      const result = importText("notes.txt", "Line one\nLine two");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toBe("<p>Line one<br>Line two</p>");
      }
    });
  });

  describe("markdown", () => {
    it("converts headings, emphasis, and lists into editor HTML", () => {
      const result = importText(
        "spec.md",
        "# Title\n\nThis is **bold** and *italic*.\n\n- one\n- two\n",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sourceType).toBe("md");
        expect(result.title).toBe("spec");
        expect(result.contentHtml).toBe(
          "<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em>.</p><ul><li>one</li><li>two</li></ul>",
        );
      }
    });

    it("converts numbered lists", () => {
      const result = importText("steps.md", "1. first\n2. second");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toBe(
          "<ol><li>first</li><li>second</li></ol>",
        );
      }
    });

    it("escapes raw HTML embedded in markdown", () => {
      const result = importText("evil.md", "# Safe\n\n<script>alert(1)</script>");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toContain("<h1>Safe</h1>");
        expect(result.contentHtml).not.toContain("<script>");
        expect(result.contentHtml).toContain("&lt;script&gt;");
      }
    });
  });

  describe("filename and type corner cases", () => {
    it("rejects an empty filename", () => {
      expect(importText("", "hello")).toEqual({
        ok: false,
        code: "EMPTY_FILENAME",
        error: "A filename is required.",
      });
    });

    it("rejects a filename that is only whitespace", () => {
      expect(importText("   ", "hello")).toEqual({
        ok: false,
        code: "EMPTY_FILENAME",
        error: "A filename is required.",
      });
    });

    it("rejects files with no extension", () => {
      expect(importText("README", "hello")).toEqual({
        ok: false,
        code: "UNSUPPORTED_TYPE",
        error: "Only .txt and .md files can be imported.",
      });
    });

    it("rejects unsupported types, including .docx and executables", () => {
      for (const filename of ["resume.docx", "photo.png", "setup.exe", "notes.pdf"]) {
        expect(importText(filename, "hello")).toEqual({
          ok: false,
          code: "UNSUPPORTED_TYPE",
          error: "Only .txt and .md files can be imported.",
        });
      }
    });

    it("rejects a double extension that is not actually text", () => {
      expect(importText("notes.txt.exe", "hello")).toEqual({
        ok: false,
        code: "UNSUPPORTED_TYPE",
        error: "Only .txt and .md files can be imported.",
      });
    });

    it("uses the name before the final extension when there are multiple dots", () => {
      const result = importText("my.meeting.notes.md", "Hi");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.title).toBe("my.meeting.notes");
      }
    });

    it("strips directory components so a path cannot become the document title", () => {
      const result = importText("..\\..\\windows\\secret.txt", "leak");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.title).toBe("secret");
        expect(result.title).not.toMatch(/[\\/]/);
      }
    });

    it("strips unix path components from the filename", () => {
      const result = importText("../../etc/passwd.txt", "root:x");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.title).toBe("passwd");
      }
    });

    it("rejects a filename that is only an extension", () => {
      expect(importText(".txt", "hello")).toEqual({
        ok: false,
        code: "INVALID_FILENAME",
        error: "The file needs a name before the extension.",
      });
    });

    it("keeps unicode characters in the title", () => {
      const result = importText("会议笔记.md", "你好");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.title).toBe("会议笔记");
      }
    });
  });

  describe("empty, huge, and unreadable files", () => {
    it("rejects a zero-byte upload", () => {
      expect(importUploadedFile({ filename: "empty.txt", bytes: new Uint8Array() })).toEqual({
        ok: false,
        code: "EMPTY_FILE",
        error: "The file is empty.",
      });
    });

    it("rejects whitespace-only content", () => {
      expect(importText("blank.txt", "  \n\t\n  ")).toEqual({
        ok: false,
        code: "EMPTY_CONTENT",
        error: "The file does not contain any readable text.",
      });
    });

    it("rejects files over the default size limit", () => {
      const bytes = new Uint8Array(IMPORT_MAX_BYTES + 1);
      bytes.fill(65);

      expect(importUploadedFile({ filename: "big.txt", bytes })).toEqual({
        ok: false,
        code: "FILE_TOO_LARGE",
        error: `Files must be ${IMPORT_MAX_BYTES} bytes or smaller.`,
      });
    });

    it("accepts a file that is exactly at the size limit", () => {
      const text = "a".repeat(IMPORT_MAX_BYTES);
      const result = importText("exact.txt", text);

      expect(result.ok).toBe(true);
    });

    it("honors a caller-supplied size limit", () => {
      expect(importText("tiny.txt", "hello world", 4)).toEqual({
        ok: false,
        code: "FILE_TOO_LARGE",
        error: "Files must be 4 bytes or smaller.",
      });
    });

    it("rejects bytes that are not valid UTF-8", () => {
      expect(
        importUploadedFile({
          filename: "binary.txt",
          bytes: new Uint8Array([0xff, 0xfe, 0x00, 0x41]),
        }),
      ).toEqual({
        ok: false,
        code: "INVALID_ENCODING",
        error: "The file must be UTF-8 text.",
      });
    });

    it("strips a UTF-8 BOM before importing", () => {
      const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode("Hello")]);
      const result = importUploadedFile({ filename: "bom.txt", bytes });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toBe("<p>Hello</p>");
      }
    });

    it("normalizes Windows line endings before wrapping paragraphs", () => {
      const result = importText("windows.txt", "One\r\n\r\nTwo\r\n");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contentHtml).toBe("<p>One</p><p>Two</p>");
      }
    });
  });
});
