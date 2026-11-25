import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

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
  private readonly storagePath: string | null;

  constructor(storagePath: string | null = null) {
    this.storagePath = storagePath;
    if (this.storagePath && existsSync(this.storagePath)) {
      try {
        const raw = readFileSync(this.storagePath, 'utf8');
        const lines = raw.trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const record = JSON.parse(line.trim()) as AuditRecord;
          this.chain.push(record);
        }
      } catch (err) {
        console.error('Failed to load existing audit ledger:', err);
      }
    }
  }

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

    if (this.storagePath) {
      try {
        const dir = dirname(this.storagePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        appendFileSync(this.storagePath, JSON.stringify(completeRecord) + '\n', 'utf8');
      } catch (err) {
        console.error('Failed to append to audit ledger file:', err);
      }
    }

    return completeRecord;
  }

  public verifyIntegrity(): { valid: boolean; corruptedAt?: number; totalRecords: number } {
    for (let i = 0; i < this.chain.length; i++) {
      const record = this.chain[i];
      const expectedPrev = i === 0 ? MerkleAuditLedger.GENESIS_HASH : this.chain[i - 1].hash;
      if (record.previousHash !== expectedPrev) return { valid: false, corruptedAt: i, totalRecords: this.chain.length };
      const recalculated = this.computeHash({
        id: record.id,
        tenantId: record.tenantId,
        actor: record.actor,
        action: record.action,
        payload: record.payload,
        timestamp: record.timestamp,
        previousHash: record.previousHash,
      });
      if (record.hash !== recalculated) return { valid: false, corruptedAt: i, totalRecords: this.chain.length };
    }
    return { valid: true, totalRecords: this.chain.length };
  }

  public getRecords(tenantId?: string): AuditRecord[] {
    return tenantId ? this.chain.filter((r) => r.tenantId === tenantId) : [...this.chain];
  }
}


let globalAuditLedger: MerkleAuditLedger | null = null;
export function getWorkspaceAuditLedger(customPath?: string): MerkleAuditLedger {
  if (!globalAuditLedger) {
    const defaultPath = process.env.RAI2_DATA_DIR ? `${process.env.RAI2_DATA_DIR}/audit-ledger.jsonl` : '/tmp/rai2-workspace-audit.jsonl';
    globalAuditLedger = new MerkleAuditLedger(customPath ?? defaultPath);
  }
  return globalAuditLedger;
}
