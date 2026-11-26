/**
 * Phân hệ 47: Artifact Diff & Consent Engine
 * Trực quan hóa khác biệt giữa các phiên bản báo giá/SOP/hợp đồng trước khi ký duyệt,
 * và cấp chứng nhận chữ ký Merkle Consent Hash chống chối bỏ.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

export interface DiffHunk {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export interface ArtifactDiffResult {
  diffId: string;
  title: string;
  originalHash: string;
  modifiedHash: string;
  hunks: DiffHunk[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  hasChanges: boolean;
}

export interface ConsentRecord {
  consentId: string;
  diffId: string;
  title: string;
  approverId: string;
  approverRole: string;
  timestamp: number;
  previousConsentHash?: string;
  consentHash: string; // SHA-256(previousConsentHash + ":" + diffId + ":" + approverId + ":" + approverRole + ":" + status + ":" + timestamp)
  status: "signed" | "rejected";
  notes?: string;
}

export class ArtifactDiffEngine {
  private consents = new Map<string, ConsentRecord>();
  private storageFile: string | null = null;
  private lastConsentHash: string | null = null;

  constructor(storageFile?: string) {
    const dataDir = process.env.OMB_DATA_DIR || process.env.RAI2_DATA_DIR || process.env.DATA_DIR;
    this.storageFile = storageFile ?? (
      process.env.RAI2_CONSENTS_FILE ?? (
        dataDir
          ? join(dataDir, "artifact-consents-state.json")
          : "/tmp/artifact-consents-state.json"
      )
    );
    this.loadState();
  }

  private loadState(): void {
    if (!this.storageFile || !existsSync(this.storageFile)) return;
    try {
      const raw = readFileSync(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.consents)) {
        for (const c of parsed.consents) {
          if (c && typeof c.consentId === "string") {
            this.consents.set(c.consentId, c);
            this.lastConsentHash = c.consentHash;
          }
        }
      }
    } catch {
      // Ignore load error
    }
  }

  private saveState(): void {
    if (!this.storageFile) return;
    try {
      const dir = dirname(this.storageFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = {
        consents: Array.from(this.consents.values()),
      };
      const tmpFile = `${this.storageFile}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      renameSync(tmpFile, this.storageFile);
    } catch {
      // Ignore save error
    }
  }

  computeDiff(title: string, originalText: string, modifiedText: string): ArtifactDiffResult {
    const origLines = originalText.split(/\r?\n/);
    const modLines = modifiedText.split(/\r?\n/);

    const hunks: DiffHunk[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    let i = 0;
    let j = 0;
    const windowSize = 5;

    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
        hunks.push({
          type: "unchanged",
          content: origLines[i],
          lineNumberOld: i + 1,
          lineNumberNew: j + 1,
        });
        unchangedCount++;
        i++;
        j++;
      } else {
        // Lookahead in windowSize lines
        let matchOffsetMod = -1;
        let matchOffsetOrig = -1;

        if (i < origLines.length && j < modLines.length) {
          for (let k = 1; k <= windowSize; k++) {
            if (j + k < modLines.length && origLines[i] === modLines[j + k] && origLines[i].trim() !== "") {
              matchOffsetMod = k;
              break;
            }
            if (i + k < origLines.length && origLines[i + k] === modLines[j] && modLines[j].trim() !== "") {
              matchOffsetOrig = k;
              break;
            }
          }
        }

        if (matchOffsetMod !== -1) {
          // Lines j .. j + matchOffsetMod - 1 in mod are added
          for (let k = 0; k < matchOffsetMod; k++) {
            hunks.push({
              type: "added",
              content: modLines[j + k],
              lineNumberNew: j + k + 1,
            });
            addedCount++;
          }
          j += matchOffsetMod;
        } else if (matchOffsetOrig !== -1) {
          // Lines i .. i + matchOffsetOrig - 1 in orig are removed
          for (let k = 0; k < matchOffsetOrig; k++) {
            hunks.push({
              type: "removed",
              content: origLines[i + k],
              lineNumberOld: i + k + 1,
            });
            removedCount++;
          }
          i += matchOffsetOrig;
        } else if (i < origLines.length && (j >= modLines.length || origLines[i] !== modLines[j])) {
          hunks.push({
            type: "removed",
            content: origLines[i],
            lineNumberOld: i + 1,
          });
          removedCount++;
          i++;
        } else if (j < modLines.length) {
          hunks.push({
            type: "added",
            content: modLines[j],
            lineNumberNew: j + 1,
          });
          addedCount++;
          j++;
        } else {
          break;
        }
      }
    }

    const origHash = createHash("sha256").update(originalText).digest("hex");
    const modHash = createHash("sha256").update(modifiedText).digest("hex");
    const diffId = createHash("sha256").update(`${origHash}:${modHash}`).digest("hex").substring(0, 16);

    return {
      diffId,
      title,
      originalHash: origHash,
      modifiedHash: modHash,
      hunks,
      addedCount,
      removedCount,
      unchangedCount,
      hasChanges: addedCount > 0 || removedCount > 0,
    };
  }

  signConsent(
    diffId: string,
    title: string,
    approverId: string,
    approverRole = "Director",
    status: "signed" | "rejected" = "signed",
    notes?: string
  ): ConsentRecord {
    const timestamp = Date.now();
    const previousConsentHash = this.lastConsentHash ?? "GENESIS_CONSENT_ROOT";
    const payload = `${previousConsentHash}:${diffId}:${approverId}:${approverRole}:${status}:${timestamp}`;
    const consentHash = createHash("sha256").update(payload).digest("hex");

    const record: ConsentRecord = {
      consentId: `consent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      diffId,
      title,
      approverId,
      approverRole,
      timestamp,
      previousConsentHash,
      consentHash,
      status,
      notes,
    };

    this.consents.set(record.consentId, record);
    this.lastConsentHash = consentHash;
    this.saveState();
    return record;
  }

  verifyConsent(consentId: string): { valid: boolean; record?: ConsentRecord } {
    const rec = this.consents.get(consentId);
    if (!rec) return { valid: false };

    const payload = rec.previousConsentHash !== undefined
      ? `${rec.previousConsentHash}:${rec.diffId}:${rec.approverId}:${rec.approverRole}:${rec.status}:${rec.timestamp}`
      : `${rec.diffId}:${rec.approverId}:${rec.approverRole}:${rec.status}:${rec.timestamp}`;
    const expected = createHash("sha256").update(payload).digest("hex");

    return {
      valid: expected === rec.consentHash,
      record: rec,
    };
  }

  verifyConsentChain(): { valid: boolean; length: number; brokenAtIndex?: number } {
    const list = Array.from(this.consents.values()).sort((a, b) => a.timestamp - b.timestamp);
    let prev: string | null = null;
    for (let idx = 0; idx < list.length; idx++) {
      const rec = list[idx];
      let expected: string;

      if (rec.previousConsentHash !== undefined) {
        const payload = `${rec.previousConsentHash}:${rec.diffId}:${rec.approverId}:${rec.approverRole}:${rec.status}:${rec.timestamp}`;
        expected = createHash("sha256").update(payload).digest("hex");

        if (prev !== null && rec.previousConsentHash !== prev && rec.previousConsentHash !== "GENESIS_CONSENT_ROOT") {
          return { valid: false, length: list.length, brokenAtIndex: idx };
        }
      } else {
        const payload = `${rec.diffId}:${rec.approverId}:${rec.approverRole}:${rec.status}:${rec.timestamp}`;
        expected = createHash("sha256").update(payload).digest("hex");
      }

      if (expected !== rec.consentHash) {
        return { valid: false, length: list.length, brokenAtIndex: idx };
      }
      prev = rec.consentHash;
    }
    return { valid: true, length: list.length };
  }

  listConsents(): ConsentRecord[] {
    return Array.from(this.consents.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}

let defaultArtifactDiff: ArtifactDiffEngine | null = null;
export function getArtifactDiffEngine(): ArtifactDiffEngine {
  if (!defaultArtifactDiff) {
    defaultArtifactDiff = new ArtifactDiffEngine();
  }
  return defaultArtifactDiff;
}
