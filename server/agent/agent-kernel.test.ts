import { describe, it, expect } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { ToolLoopGuard } from './loop-guard.ts';
import { safeJsonParse, repairJsonString } from './json-repair.ts';
import { RunReaper } from './reaper.ts';
import { MerkleAuditLedger } from './merkle-audit.ts';

describe('AgenticOS Kernel Resilience for RAI2', () => {
  it('ToolLoopGuard detects repeating tool calls and triggers soft then hard stop', () => {
    const guard = new ToolLoopGuard(2, 3);
    const call = { name: 'query_margin', args: { orderId: 'ORD-123' } };

    const first = guard.recordAndCheck(call);
    expect(first.allowed).toBe(true);
    expect(first.action).toBe('proceed');

    const second = guard.recordAndCheck(call);
    expect(second.allowed).toBe(true);
    expect(second.action).toBe('warn');

    const third = guard.recordAndCheck(call);
    expect(third.allowed).toBe(false);
    expect(third.action).toBe('block');
  });

  it('repairJsonString fixes truncated brackets and trailing commas', () => {
    const broken = '{"status": "ok", "items": [1, 2, ';
    const parsed = safeJsonParse(broken, { fallback: true });
    expect(parsed).toBeDefined();

    const markdownJson = '```json\n{"success": true,}\n```';
    const repaired = repairJsonString(markdownJson);
    expect(JSON.parse(repaired)).toEqual({ success: true });
  });

  it('MerkleAuditLedger persists to disk and reloads with intact chain', () => {
    const testPath = '/tmp/test-merkle-' + Date.now() + '.jsonl';
    try {
      const ledger1 = new MerkleAuditLedger(testPath);
      const r1 = ledger1.append('tenant-rai', 'ceo', 'approve_margin', { margin: 0.25 });
      ledger1.append('tenant-rai', 'bot-finance', 'calculate_pnl', { profit: 12500000 });
      expect(ledger1.verifyIntegrity().valid).toBe(true);

      // Reload in a brand new instance from the file
      const ledger2 = new MerkleAuditLedger(testPath);
      expect(ledger2.getRecords().length).toBe(2);
      expect(ledger2.verifyIntegrity().valid).toBe(true);
      expect(ledger2.getRecords()[1].previousHash).toBe(r1.hash);
    } finally {
      if (existsSync(testPath)) unlinkSync(testPath);
    }
  });

  it('RunReaper identifies stale inactive tasks', () => {
    const reaper = new RunReaper(50);
    reaper.register('task-1', 'tenant-a', undefined, 10);
    const start = Date.now();
    while (Date.now() - start < 20) {}
    const reaped = reaper.reapStale();
    expect(reaped).toContain('task-1');
  });
});
