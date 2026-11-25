import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { convertOfficeDocument } from './office-convert.ts';
import { TurnSteeringManager } from './turn-steering.ts';

function createZipBuffer(entries: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const rawData = Buffer.from(content, 'utf-8');
    const compData = zlib.deflateRawSync(rawData);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt32LE(compData.length, 18);
    header.writeUInt32LE(rawData.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    parts.push(header, nameBuf, compData);
  }
  return Buffer.concat(parts);
}

describe('Sprint 2 Enterprise Advanced Engine', () => {
  it('converts CSV to clean Markdown table', async () => {
    const csv = `name,department,profit\nAlice,Engineering,1500000\nBob,Sales,2800000`;
    const res = await convertOfficeDocument({
      filename: 'report.csv',
      buffer: Buffer.from(csv, 'utf-8')
    });

    expect(res.format).toBe('csv');
    expect(res.rowCount).toBe(3);
    expect(res.markdown).toContain('| name | department | profit |');
    expect(res.markdown).toContain('| Alice | Engineering | 1500000 |');
  });

  it('decompresses real OpenXML XLSX and extracts Markdown spreadsheet table', async () => {
    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Tháng</t></si>
  <si><t>Doanh Thu</t></si>
  <si><t>Lợi Nhuận</t></si>
  <si><t>Tháng 10</t></si>
  <si><t>Tháng 11</t></si>
</sst>`;

    const sheet1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2"><v>1200000</v></c>
      <c r="C2"><v>350000</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>4</v></c>
      <c r="B3"><v>1550000</v></c>
      <c r="C3"><v>480000</v></c>
    </row>
  </sheetData>
</worksheet>`;

    const zipBuffer = createZipBuffer({
      'xl/sharedStrings.xml': sharedStringsXml,
      'xl/worksheets/sheet1.xml': sheet1Xml
    });

    const res = await convertOfficeDocument({
      filename: 'q4_finance.xlsx',
      buffer: zipBuffer
    });

    expect(res.format).toBe('xlsx');
    expect(res.rowCount).toBe(3);
    expect(res.markdown).toContain('| Tháng | Doanh Thu | Lợi Nhuận |');
    expect(res.markdown).toContain('| Tháng 10 | 1200000 | 350000 |');
    expect(res.markdown).toContain('| Tháng 11 | 1550000 | 480000 |');
  });

  it('decompresses real OpenXML DOCX and extracts clean document paragraphs', async () => {
    const docXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Biên bản họp hội đồng quản trị Q4</w:t></w:r></w:p>
    <w:p><w:r><w:t>Mục tiêu hoàn vốn trong vòng 90 ngày đạt chuẩn.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

    const zipBuffer = createZipBuffer({
      'word/document.xml': docXml
    });

    const res = await convertOfficeDocument({
      filename: 'meeting_minutes.docx',
      buffer: zipBuffer
    });

    expect(res.format).toBe('docx');
    expect(res.markdown).toContain('Biên bản họp hội đồng quản trị Q4');
    expect(res.markdown).toContain('Mục tiêu hoàn vốn trong vòng 90 ngày đạt chuẩn.');
  });

  it('manages steering directives with handlers and TTL pruning', async () => {
    const mgr = new TurnSteeringManager();
    let handled = false;
    const unreg = mgr.registerHandler((directive) => {
      if (directive.action === 'redirect') handled = true;
    });

    const dir1 = mgr.submitSteer('turn-101', 'redirect', 'Focus on gross margin');
    expect(dir1.action).toBe('redirect');
    expect(handled).toBe(true);

    expect(mgr.hasPendingSteer('turn-101')).toBe(true);
    expect(mgr.getDirectivesCount()).toBe(1);

    const consumed = mgr.consumeDirectives('turn-101');
    expect(consumed.length).toBe(1);
    expect(mgr.hasPendingSteer('turn-101')).toBe(false);
    expect(mgr.getDirectivesCount()).toBe(0);

    // Test TTL cleanup
    mgr.submitSteer('turn-old', 'pause');
    const oldList = (mgr as any).directives.get('turn-old');
    if (oldList && oldList[0]) {
      oldList[0].injectedAt = Date.now() - 600_000;
    }
    const cleaned = mgr.cleanupStale(300_000);
    expect(cleaned).toBe(1);
    expect(mgr.hasPendingSteer('turn-old')).toBe(false);

    unreg();
  });
});
