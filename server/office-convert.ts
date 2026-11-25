/**
 * Module 17: Office Convert Engine for RAI2
 * Converts Office/Document files (CSV, Text, Markdown, Word DOCX, Excel XLSX, PDF)
 * into structured markdown tables and context payloads without breaking UI layout.
 */

import zlib from "node:zlib";

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
 * Parses local file entries from a ZIP archive (DOCX, XLSX) in pure Node.js
 * without external dependencies, inflating DEFLATE-compressed streams.
 */
export function parseZipArchive(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buf.length) {
    // Check local header PK\x03\x04
    if (buf[offset] !== 0x50 || buf[offset + 1] !== 0x4b || buf[offset + 2] !== 0x03 || buf[offset + 3] !== 0x04) {
      break;
    }
    const compMethod = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const filename = buf.toString("utf-8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compSize;

    if (dataEnd > buf.length) break;

    const rawData = buf.subarray(dataStart, dataEnd);
    try {
      if (compMethod === 8) {
        const decompressed = zlib.inflateRawSync(rawData);
        entries.set(filename, decompressed);
      } else if (compMethod === 0) {
        entries.set(filename, rawData);
      }
    } catch {
      // Ignore corrupted sub-entries
    }

    offset = dataEnd;
  }
  return entries;
}

/**
 * Parses Excel OpenXML sheet XML and sharedStrings XML into a clean Markdown table.
 */
export function parseExcelXmlToTable(sheetXml: string, sharedStrings: string[]): { markdown: string; rowCount: number } {
  const rowMatches = Array.from(sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs));
  if (rowMatches.length === 0) return { markdown: "", rowCount: 0 };

  const parsedRows: string[][] = [];
  for (const rm of rowMatches) {
    const rowContent = rm[1];
    const cellMatches = Array.from(rowContent.matchAll(/<c\b([^>]*)>(.*?)<\/c>/gs));
    const cells: string[] = [];
    for (const cm of cellMatches) {
      const attrs = cm[1];
      const cellBody = cm[2];
      const isSharedString = /t=["']s["']/.test(attrs);
      const isInlineStr = /t=["']inlineStr["']/.test(attrs);
      let val = "";
      if (isSharedString) {
        const vMatch = cellBody.match(/<v>(\d+)<\/v>/);
        if (vMatch) {
          const idx = parseInt(vMatch[1], 10);
          val = sharedStrings[idx] ?? "";
        }
      } else if (isInlineStr) {
        const tMatch = cellBody.match(/<t[^>]*>([^<]+)<\/t>/);
        if (tMatch) val = tMatch[1];
      } else {
        const vMatch = cellBody.match(/<v>([^<]+)<\/v>/);
        if (vMatch) val = vMatch[1];
      }
      cells.push(val.trim());
    }
    if (cells.some((c) => c.length > 0)) {
      parsedRows.push(cells);
    }
  }

  if (parsedRows.length === 0) return { markdown: "", rowCount: 0 };

  const maxCols = Math.max(...parsedRows.map((r) => r.length));
  const normalized = parsedRows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push("");
    return padded;
  });

  const header = normalized[0];
  const separator = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...normalized.slice(1).map((r) => `| ${r.join(" | ")} |`)
  ];

  return {
    markdown: lines.join("\n"),
    rowCount: normalized.length
  };
}

/**
 * Parses Word OpenXML document XML into clean readable paragraphs and text.
 */
export function parseWordXmlToText(docXml: string): string {
  const paragraphs: string[] = [];
  const pMatches = Array.from(docXml.matchAll(/<w:p\b[^>]*>(.*?)<\/w:p>/gs));
  for (const pm of pMatches) {
    const textMatches = Array.from(pm[1].matchAll(/<w:t\b[^>]*>([^<]+)<\/w:t>/g), (m) => m[1]);
    const pText = textMatches.join("");
    if (pText.trim()) {
      paragraphs.push(pText.trim());
    }
  }
  return paragraphs.join("\n\n");
}

/**
 * Fast zero-allocation byte scanner to extract printable UTF-8 characters
 * without triggering V8 GC heap spikes or violating eslint(no-control-regex).
 */
export function sanitizeBufferPreview(buf: Buffer, maxLen = 4096): string {
  const slice = buf.subarray(0, Math.min(buf.length, maxLen));
  const cleanBytes: number[] = [];
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
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

  // 3. OpenXML ZIP archives (.xlsx, .docx)
  const isZip = input.buffer.length >= 4 && input.buffer[0] === 0x50 && input.buffer[1] === 0x4b && input.buffer[2] === 0x03 && input.buffer[3] === 0x04;
  if (isZip) {
    const entries = parseZipArchive(input.buffer);

    // 3a. Excel XLSX
    if (ext === "xlsx" || entries.has("xl/worksheets/sheet1.xml") || entries.has("xl/workbook.xml")) {
      const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf-8") ?? "";
      const sharedStrings = Array.from(sharedStringsXml.matchAll(/<t\b[^>]*>([^<]+)<\/t>/g), (m) => m[1]);

      // Find the first available sheet
      let sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf-8");
      if (!sheetXml) {
        for (const [name, buf] of entries) {
          if (name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml")) {
            sheetXml = buf.toString("utf-8");
            break;
          }
        }
      }

      if (sheetXml) {
        const { markdown, rowCount } = parseExcelXmlToTable(sheetXml, sharedStrings);
        if (markdown) {
          return {
            format: "xlsx",
            markdown: `[Excel Spreadsheet: ${input.filename} (${rowCount} rows)]\n\n${markdown}`,
            rowCount
          };
        }
      }
    }

    // 3b. Word DOCX
    if (ext === "docx" || entries.has("word/document.xml")) {
      const docXml = entries.get("word/document.xml")?.toString("utf-8");
      if (docXml) {
        const text = parseWordXmlToText(docXml);
        if (text) {
          return {
            format: "docx",
            markdown: `[Word Document: ${input.filename}]\n\n${text}`,
            wordCount: text.split(/\s+/).filter(Boolean).length
          };
        }
      }
    }
  }

  // 4. PDF or Fallback Preview
  const isPdf = ext === "pdf" || (input.buffer.length >= 4 && input.buffer.toString("ascii", 0, 4) === "%PDF");
  const sanitized = sanitizeBufferPreview(input.buffer, 4096);
  let documentPreview = sanitized;

  if (ext === "docx" && sanitized.includes("<w:t")) {
    const matches = Array.from(sanitized.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g), (m) => m[1]);
    if (matches.length > 0) {
      documentPreview = matches.join(" ");
    }
  }

  const format = ext === "docx" ? "docx" : ext === "xlsx" ? "xlsx" : isPdf ? "pdf" : "unknown";
  const wordCount = documentPreview.split(/\s+/).filter(Boolean).length;

  return {
    format,
    markdown: `[Document: ${input.filename} (${format.toUpperCase()})]\n\n${documentPreview.slice(0, 1000)}`,
    wordCount
  };
}
