/**
 * Markdown is a convention, not a schema. This checker only looks at the
 * subset Paper actually converts: ATX h1–h3, lists with a space after the
 * marker, **bold**, and fenced code as plain text.
 *
 * Anything we can repair, we do conservatively (insert a missing space,
 * close a fence). We do not try to pretty-print or interpret intent.
 */

export type MarkdownIssueCode =
  | "HEADING_MISSING_SPACE"
  | "HEADING_TOO_DEEP"
  | "LIST_MISSING_SPACE"
  | "ORDERED_LIST_MISSING_SPACE"
  | "UNCLOSED_FENCE"
  | "UNCLOSED_BOLD";

export type MarkdownIssue = {
  code: MarkdownIssueCode;
  line: number;
  message: string;
  fixable: boolean;
};

export type MarkdownReport = {
  issues: MarkdownIssue[];
};

export function inspectMarkdown(source: string): MarkdownReport {
  const lines = normalizeNewlines(source).split("\n");
  const issues: MarkdownIssue[] = [];
  let inFence = false;
  let fenceStart = 1;
  let boldMarks = 0;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^\s*```/.test(line)) {
      if (inFence) {
        inFence = false;
      } else {
        inFence = true;
        fenceStart = lineNumber;
      }
      return;
    }
    if (inFence) {
      return;
    }

    if (/^#{4,}/.test(line)) {
      issues.push({
        code: "HEADING_TOO_DEEP",
        line: lineNumber,
        message: `Line ${lineNumber}: heading is deeper than h3, which Paper does not convert.`,
        fixable: true,
      });
    } else if (/^#{1,3}\S/.test(line)) {
      issues.push({
        code: "HEADING_MISSING_SPACE",
        line: lineNumber,
        message: `Line ${lineNumber}: ATX headings need a space after # (CommonMark).`,
        fixable: true,
      });
    }

    // Only `-item`. `*item` is usually emphasis; `---` is a thematic break.
    if (/^-[^-\s]/.test(line)) {
      issues.push({
        code: "LIST_MISSING_SPACE",
        line: lineNumber,
        message: `Line ${lineNumber}: list items need a space after -.`,
        fixable: true,
      });
    }

    if (/^\d+\.(\S)/.test(line)) {
      issues.push({
        code: "ORDERED_LIST_MISSING_SPACE",
        line: lineNumber,
        message: `Line ${lineNumber}: numbered items need a space after the dot.`,
        fixable: true,
      });
    }

    boldMarks += countBoldMarkers(line);
  });

  if (inFence) {
    issues.push({
      code: "UNCLOSED_FENCE",
      line: fenceStart,
      message: `Line ${fenceStart}: fenced code block is never closed.`,
      fixable: true,
    });
  }

  if (boldMarks % 2 === 1) {
    issues.push({
      code: "UNCLOSED_BOLD",
      line: lines.length,
      message: "Unmatched ** — bold never closes.",
      fixable: true,
    });
  }

  return { issues };
}

export function repairMarkdown(source: string): string {
  const normalized = normalizeNewlines(source);
  const lines = normalized.split("\n");
  let inFence = false;
  let boldMarks = 0;

  const repaired = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }

    let next = line.replace(/^(#{1,6})([^#\s])/, "$1 $2");
    next = next.replace(/^(#{4,}) /, "### ");
    next = next.replace(/^-([^-\s])/, "- $1");
    next = next.replace(/^(\d+\.)(\S)/, "$1 $2");
    boldMarks += countBoldMarkers(next);
    return next;
  });

  if (inFence) {
    repaired.push("```");
  }
  if (boldMarks % 2 === 1) {
    repaired[repaired.length - 1] = `${repaired[repaired.length - 1]}**`;
  }

  return repaired.join("\n");
}

function normalizeNewlines(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function countBoldMarkers(line: string): number {
  return line.match(/\*\*/g)?.length ?? 0;
}
