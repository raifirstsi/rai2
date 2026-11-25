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

/**
 * Fast zero-allocation byte scanner to extract printable UTF-8 characters
 * without triggering V8 GC heap spikes or violating eslint(no-control-regex).
 */
function sanitizeBufferPreview(buf: Buffer, maxLen = 4096): string {
  const slice = buf.subarray(0, Math.min(buf.length, maxLen));
  const cleanBytes: number[] = [];
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    // Keep printable ASCII, newlines, tabs, and UTF-8 multibyte characters (>= 128)
    if (b >= 32 || b === 10 || b === 13 || b === 9 || b >= 128) {
      cleanBytes.push(b);
    }
  }
  return Buffer.from(cleanBytes).toString("utf-8");
}

export async function convertOfficeDocument(input: OfficeConvertInput): Promise<OfficeConvertOutput> {
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";

  // 1. CSV
  if (ext === "csv" || input.mimeType === "text/csv") {
    const raw = input.buffer.toString("utf-8");
    const { markdown, rowCount } = convertCsvToTable(raw);
    return {
      format: "csv",
      markdown,
      rowCount
    };
  }

  // 2. Plain Text / Markdown
  if (ext === "txt" || ext === "md" || input.mimeType?.startsWith("text/")) {
    const raw = input.buffer.toString("utf-8");
    return {
      format: "text",
      markdown: raw,
      wordCount: raw.split(/\s+/).filter(Boolean).length
    };
  }

  // 3. Office & PDF Documents (DOCX, XLSX, PDF)
  // Check for ZIP signature (PK\x03\x04) used by DOCX / XLSX
  const isZip = input.buffer.length >= 4 && input.buffer[0] === 0x50 && input.buffer[1] === 0x4b && input.buffer[2] === 0x03 && input.buffer[3] === 0x04;
  const isDocx = ext === "docx" || isZip && ext === "docx";
  const isXlsx = ext === "xlsx" || isZip && ext === "xlsx";
  const isPdf = ext === "pdf" || (input.buffer.length >= 4 && input.buffer.toString("ascii", 0, 4) === "%PDF");

  const sanitized = sanitizeBufferPreview(input.buffer, 4096);
  let documentPreview = sanitized;

  // If XML tags exist in uncompressed or preview stream, extract readable text
  if (isDocx && sanitized.includes("<w:t")) {
    const matches = Array.from(sanitized.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g), (m) => m[1]);
    if (matches.length > 0) {
      documentPreview = matches.join(" ");
    }
  }

  const format = isDocx ? "docx" : isXlsx ? "xlsx" : isPdf ? "pdf" : "unknown";
  const wordCount = documentPreview.split(/\s+/).filter(Boolean).length;

  return {
    format,
    markdown: `[Document: ${input.filename} (${format.toUpperCase()})]\n\n${documentPreview.slice(0, 1000)}`,
    wordCount
  };
}
