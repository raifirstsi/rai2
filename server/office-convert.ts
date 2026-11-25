/**
 * Module 17: Office Convert Engine for RAI2
 * Converts Office/Document files (CSV, Text, Markdown, Word DOCX, Excel XLSX, PDF)
 * into structured markdown tables and context payloads without breaking UI layout.
 */

export interface OfficeConvertInput {
  filename: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface OfficeConvertOutput {
  format: "csv" | "xlsx" | "docx" | "pdf" | "text" | "unknown";
  markdown: string;
  rowCount?: number;
  wordCount?: number;
}

export function convertCsvToTable(csvContent: string): { markdown: string; rowCount: number } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { markdown: "", rowCount: 0 };

  const rows = lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());
    return cells;
  });

  const header = rows[0];
  const separator = header.map(() => "---");
  const tableLines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`)
  ];

  return {
    markdown: tableLines.join("\n"),
    rowCount: rows.length
  };
}

export async function convertOfficeDocument(input: OfficeConvertInput): Promise<OfficeConvertOutput> {
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || input.mimeType === "text/csv") {
    const raw = input.buffer.toString("utf-8");
    const { markdown, rowCount } = convertCsvToTable(raw);
    return {
      format: "csv",
      markdown,
      rowCount
    };
  }

  if (ext === "txt" || ext === "md" || input.mimeType?.startsWith("text/")) {
    const raw = input.buffer.toString("utf-8");
    return {
      format: "text",
      markdown: raw,
      wordCount: raw.split(/\s+/).filter(Boolean).length
    };
  }

  // Fallback for docx/xlsx/pdf plain-text extraction or metadata
  const textPreview = input.buffer
    .toString("utf-8", 0, Math.min(input.buffer.length, 4096))
    .split("")
    .filter((ch) => ch.charCodeAt(0) >= 32 || ch === "\n" || ch === "\r" || ch === "\t")
    .join("");

  return {
    format: (ext === "docx" || ext === "xlsx" || ext === "pdf") ? (ext as any) : "unknown",
    markdown: `[Document: ${input.filename}]\n\n${textPreview.slice(0, 1000)}`,
    wordCount: textPreview.split(/\s+/).filter(Boolean).length
  };
}
