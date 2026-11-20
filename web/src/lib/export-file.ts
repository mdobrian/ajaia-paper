/**
 * Turn stored HTML back into a downloadable .md or .txt file.
 *
 * Import is conversion, not file storage, so export has to reconstruct text
 * from TipTap HTML. This is lossy on purpose: we keep headings, lists, and
 * emphasis, not a pixel-perfect round trip.
 */

export type ExportFormat = "md" | "txt" | "pdf";

export function htmlToMarkdown(html: string): string {
  const blocks = splitBlocks(stripScripts(html));
  return blocks
    .map(blockToMarkdown)
    .filter((block) => block.length > 0)
    .join("\n\n");
}

export function htmlToPlainText(html: string): string {
  return htmlToMarkdown(html)
    .replace(/^#{1,3} /gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*] /gm, "")
    .replace(/^\d+\. /gm, "");
}

export function documentDownloadName(title: string, ext: ExportFormat): string {
  const safeExt = ext === "txt" ? "txt" : ext === "pdf" ? "pdf" : "md";
  const withoutPath = title.replace(/[/\\]+/g, " ").trim();
  const withoutExt = withoutPath.replace(/\.[^.]+$/, "");
  const cleaned =
    withoutExt
      .replace(/[<>:"|?*]/g, "")
      .replace(/^\.+/, "")
      .trim()
      .replace(/\s+/g, "-") || "document";
  return `${cleaned}.${safeExt}`;
}

export function exportDocument(input: {
  title: string;
  contentHtml: string;
  format: ExportFormat;
}): { filename: string; body: string | Uint8Array; contentType: string } {
  const format: ExportFormat =
    input.format === "txt" ? "txt" : input.format === "pdf" ? "pdf" : "md";
  if (format === "pdf") {
    return {
      filename: documentDownloadName(input.title, "pdf"),
      body: htmlToPdf(input.title, input.contentHtml),
      contentType: "application/pdf",
    };
  }
  const body =
    format === "txt"
      ? htmlToPlainText(input.contentHtml)
      : htmlToMarkdown(input.contentHtml);
  return {
    filename: documentDownloadName(input.title, format),
    body,
    contentType: format === "txt" ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8",
  };
}

/**
 * Small text PDF, no Chromium. Good enough for the stretch item; it is not a
 * print-preview of TipTap.
 */
export function htmlToPdf(title: string, html: string): Uint8Array {
  const lines = wrapPdfLines(
    [toPdfAscii(title), "", ...toPdfAscii(htmlToPlainText(html)).split("\n")],
    86,
  );
  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push([""]);
  }
  return buildPdf(pages);
}

function toPdfAscii(text: string): string {
  return text.replace(/[^\t\n\r\x20-\x7E]/g, "?");
}

function escapePdfText(text: string): string {
  return toPdfAscii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLines(lines: string[], width: number): string[] {
  const wrapped: string[] = [];
  for (const line of lines) {
    if (line.length <= width) {
      wrapped.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > width) {
      let cut = rest.lastIndexOf(" ", width);
      if (cut < 1) {
        cut = width;
      }
      wrapped.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) {
      wrapped.push(rest);
    }
  }
  return wrapped;
}

function buildPdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const id = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = id("placeholder");
  const pagesId = id("placeholder");
  const fontId = id("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const pageIds: number[] = [];

  for (const lines of pages) {
    let stream = "BT\n/F1 12 Tf\n14 TL\n72 720 Td\n";
    lines.forEach((line, index) => {
      const op = index === 0 ? "" : "T* ";
      stream += `${op}(${escapePdfText(line)}) Tj\n`;
    });
    stream += "ET\n";
    const contentId = id(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    pageIds.push(
      id(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function splitBlocks(html: string): string[] {
  return html
    .replace(/<\/(h[1-3]|p|ul|ol)>/gi, "</$1>\n")
    .split("\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function blockToMarkdown(block: string): string {
  const heading = /^<h([1-3])>([\s\S]*)<\/h\1>$/i.exec(block);
  if (heading) {
    return `${"#".repeat(Number(heading[1]))} ${inlineToMarkdown(heading[2])}`;
  }

  const paragraph = /^<p>([\s\S]*)<\/p>$/i.exec(block);
  if (paragraph) {
    return inlineToMarkdown(paragraph[1].replace(/<br\s*\/?>/gi, "\n"));
  }

  const list = /^<(ul|ol)>([\s\S]*)<\/\1>$/i.exec(block);
  if (list) {
    const items = [...list[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)];
    return items
      .map((item, index) => {
        const prefix = list[1].toLowerCase() === "ol" ? `${index + 1}. ` : "- ";
        return prefix + inlineToMarkdown(item[1]);
      })
      .join("\n");
  }

  return inlineToMarkdown(block);
}

function inlineToMarkdown(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/?(strong|b)>/gi, "**")
      .replace(/<\/?(em|i)>/gi, "*")
      .replace(/<\/?u>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
