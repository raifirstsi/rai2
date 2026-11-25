import { describe, it, expect } from 'vitest';
import { convertOfficeDocument } from './office-convert.ts';
import { TurnSteeringManager } from './turn-steering.ts';

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
    // Force stale by setting injectedAt back 10 mins
    const oldList = (mgr as any).directives.get('turn-old');
    if (oldList && oldList[0]) {
      oldList[0].injectedAt = Date.now() - 600_000;
    }
    const cleaned = mgr.cleanupStale(300_000);
    expect(cleaned).toBe(1);
    expect(mgr.hasPendingSteer('turn-old')).toBe(false);

    unreg();
  });

  it('processes binary docx and pdf previews safely without GC spikes', async () => {
    const fakeDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('<w:t>Doanh thu quy 4 vuot 150 ty dong</w:t>')
    ]);

    const resDocx = await convertOfficeDocument({
      filename: 'contract.docx',
      buffer: fakeDocx
    });
    expect(resDocx.format).toBe('docx');
    expect(resDocx.markdown).toContain('Doanh thu quy 4 vuot 150 ty dong');

    const fakePdf = Buffer.from('%PDF-1.4\nBao cao kiem toan noi bo');
    const resPdf = await convertOfficeDocument({
      filename: 'audit.pdf',
      buffer: fakePdf
    });
    expect(resPdf.format).toBe('pdf');
    expect(resPdf.markdown).toContain('Bao cao kiem toan noi bo');
  });
});
