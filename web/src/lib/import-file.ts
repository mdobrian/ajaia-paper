/**
 * Convert an uploaded .txt/.md file into document HTML.
 *
 * Product choice: import is conversion, not file storage. We never write the
 * raw bytes to disk, which removes a class of path-traversal bugs. Attachments
 * can be added later if reviewers want that workflow.
 *
 * .docx is out of scope on purpose. It is a zip+XML format and would eat the
 * timebox without making the editor demo stronger.
 */

export const IMPORT_MAX_BYTES = 1_048_576;

export type ImportErrorCode =
  | "EMPTY_FILENAME"
  | "UNSUPPORTED_TYPE"
  | "INVALID_FILENAME"
  | "EMPTY_FILE"
  | "EMPTY_CONTENT"
  | "FILE_TOO_LARGE"
  | "INVALID_ENCODING";

export type ImportResult =
  | {
      ok: true;
      title: string;
      sourceType: "txt" | "md";
      contentHtml: string;
    }
  | {
      ok: false;
      code: ImportErrorCode;
      error: string;
    };

type ImportInput = {
  filename: string;
  bytes: Uint8Array;
  maxBytes?: number;
};

const UNSUPPORTED_TYPE_ERROR = "Only .txt and .md files can be imported.";

/**
 * Validate and convert an upload.
 *
 * Order matters for the error the user sees: name, size, empty bytes, type,
 * then encoding. A 20 MB binary should fail as "too large", not "invalid UTF-8".
 */
export function importUploadedFile(input: ImportInput): ImportResult {
  const filename = input.filename.trim();
  if (!filename) {
    return fail("EMPTY_FILENAME", "A filename is required.");
  }

  const maxBytes = input.maxBytes ?? IMPORT_MAX_BYTES;
  if (input.bytes.byteLength > maxBytes) {
    return fail("FILE_TOO_LARGE", `Files must be ${maxBytes} bytes or smaller.`);
  }

  if (input.bytes.byteLength === 0) {
    return fail("EMPTY_FILE", "The file is empty.");
  }

  const parsed = parseFilename(filename);
  if (!parsed.ok) {
    return parsed;
  }

  const decoded = decodeUtf8(input.bytes);
  if (decoded === null) {
    return fail("INVALID_ENCODING", "The file must be UTF-8 text.");
  }

  const text = decoded
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (text.trim() === "") {
    return fail("EMPTY_CONTENT", "The file does not contain any readable text.");
  }

  const contentHtml =
    parsed.sourceType === "md"
      ? markdownToHtml(text.trim())
      : textToHtml(text.trim());

  return {
    ok: true,
    title: parsed.title,
    sourceType: parsed.sourceType,
    contentHtml,
  };
}

function fail(code: ImportErrorCode, error: string): ImportResult {
  return { ok: false, code, error };
}

function parseFilename(filename: string): ImportResult {
  const base = filename.split(/[/\\]+/).filter(Boolean).at(-1) ?? "";
  const separator = base.lastIndexOf(".");

  // Trust only the final extension so notes.txt.exe cannot pass as text.
  if (separator <= 0) {
    if (separator === 0) {
      const ext = base.slice(1).toLowerCase();
      if (ext === "txt" || ext === "md") {
        return fail("INVALID_FILENAME", "The file needs a name before the extension.");
      }
    }
    return fail("UNSUPPORTED_TYPE", UNSUPPORTED_TYPE_ERROR);
  }

  const title = base.slice(0, separator);
  const ext = base.slice(separator + 1).toLowerCase();
  if (ext !== "txt" && ext !== "md") {
    return fail("UNSUPPORTED_TYPE", UNSUPPORTED_TYPE_ERROR);
  }
  if (!title) {
    return fail("INVALID_FILENAME", "The file needs a name before the extension.");
  }

  return { ok: true, title, sourceType: ext, contentHtml: "" };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  // Ampersands first so we do not double-escape the other replacements.
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyInline(value: string): string {
  // Bold before italic; otherwise **bold** becomes nested em tags.
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function textToHtml(text: string): string {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ""))
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function markdownToHtml(text: string): string {
  // Escape first so **bold** still works and <script> cannot.
  const lines = escapeHtml(text).split("\n");
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${applyInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index])) {
        items.push(`<li>${applyInline(lines[index].slice(2))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(`<li>${applyInline(lines[index].replace(/^\d+\. /, ""))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(#{1,3}) /.test(lines[index]) &&
      !/^[-*] /.test(lines[index]) &&
      !/^\d+\. /.test(lines[index])
    ) {
      paragraph.push(applyInline(lines[index]));
      index += 1;
    }
    html.push(`<p>${paragraph.join("<br>")}</p>`);
  }

  return html.join("");
}
