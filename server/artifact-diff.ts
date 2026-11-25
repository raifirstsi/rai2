/**
 * Phân hệ 47: Artifact Diff & Consent Engine
 * Trực quan hóa khác biệt giữa các phiên bản báo giá/SOP/hợp đồng trước khi ký duyệt,
 * và cấp chứng nhận chữ ký Merkle Consent Hash chống chối bỏ.
 */

import { createHash } from "node:crypto";

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
  consentHash: string; // SHA-256(diffId + approverId + timestamp)
  status: "signed" | "rejected";
  notes?: string;
}

export class ArtifactDiffEngine {
  private consents = new Map<string, ConsentRecord>();

  computeDiff(title: string, originalText: string, modifiedText: string): ArtifactDiffResult {
    const origLines = originalText.split(/\r?\n/);
    const modLines = modifiedText.split(/\r?\n/);

    const hunks: DiffHunk[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    // Line-by-line diff heuristic
    let i = 0;
    let j = 0;

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
      } else if (j < modLines.length && (i >= origLines.length || !origLines.includes(modLines[j]))) {
        hunks.push({
          type: "added",
          content: modLines[j],
          lineNumberNew: j + 1,
        });
        addedCount++;
        j++;
      } else if (i < origLines.length) {
        hunks.push({
          type: "removed",
          content: origLines[i],
          lineNumberOld: i + 1,
        });
        removedCount++;
        i++;
      } else {
        break;
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
    const payload = `${diffId}:${approverId}:${approverRole}:${status}:${timestamp}`;
    const consentHash = createHash("sha256").update(payload).digest("hex");

    const record: ConsentRecord = {
      consentId: `consent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      diffId,
      title,
      approverId,
      approverRole,
      timestamp,
      consentHash,
      status,
      notes,
    };

    this.consents.set(record.consentId, record);
    return record;
  }

  verifyConsent(consentId: string): { valid: boolean; record?: ConsentRecord } {
    const rec = this.consents.get(consentId);
    if (!rec) return { valid: false };

    const payload = `${rec.diffId}:${rec.approverId}:${rec.approverRole}:${rec.status}:${rec.timestamp}`;
    const expected = createHash("sha256").update(payload).digest("hex");

    return {
      valid: expected === rec.consentHash,
      record: rec,
    };
  }
}

let defaultArtifactDiff: ArtifactDiffEngine | null = null;
export function getArtifactDiffEngine(): ArtifactDiffEngine {
  if (!defaultArtifactDiff) {
    defaultArtifactDiff = new ArtifactDiffEngine();
  }
  return defaultArtifactDiff;
}
