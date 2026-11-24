import { createHash } from 'node:crypto';

export interface AuditRecord {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
  previousHash: string;
  hash: string;
}

export class MerkleAuditLedger {
  private chain: AuditRecord[] = [];
  private static readonly GENESIS_HASH = '0'.repeat(64);

  private computeHash(record: Omit<AuditRecord, 'hash'>): string {
    const serialized = JSON.stringify({
      id: record.id,
      tenantId: record.tenantId,
      actor: record.actor,
      action: record.action,
      payload: record.payload,
      timestamp: record.timestamp,
      previousHash: record.previousHash,
    });
    return createHash('sha256').update(serialized).digest('hex');
  }

  public append(tenantId: string, actor: string, action: string, payload: Record<string, unknown>): AuditRecord {
    const previousHash = this.chain.length === 0 ? MerkleAuditLedger.GENESIS_HASH : this.chain[this.chain.length - 1].hash;
    const baseRecord = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
      tenantId,
      actor,
      action,
      payload,
      timestamp: Date.now(),
      previousHash,
    };
    const hash = this.computeHash(baseRecord);
    const completeRecord: AuditRecord = { ...baseRecord, hash };
    this.chain.push(completeRecord);
    return completeRecord;
  }

  public verifyIntegrity(): { valid: boolean; corruptedAt?: number } {
    for (let i = 0; i < this.chain.length; i++) {
      const record = this.chain[i];
      const expectedPrev = i === 0 ? MerkleAuditLedger.GENESIS_HASH : this.chain[i - 1].hash;
      if (record.previousHash !== expectedPrev) return { valid: false, corruptedAt: i };
      const recalculated = this.computeHash({
        id: record.id,
        tenantId: record.tenantId,
        actor: record.actor,
        action: record.action,
        payload: record.payload,
        timestamp: record.timestamp,
        previousHash: record.previousHash,
      });
      if (record.hash !== recalculated) return { valid: false, corruptedAt: i };
    }
    return { valid: true };
  }

  public getRecords(tenantId?: string): AuditRecord[] {
    return tenantId ? this.chain.filter((r) => r.tenantId === tenantId) : [...this.chain];
  }
}
