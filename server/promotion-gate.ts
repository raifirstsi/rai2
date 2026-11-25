/**
 * Phân hệ 61: Promotion Gate
 * Cổng kiểm soát thẩm quyền tiếp khách của Bot.
 * Chỉ cấp cờ 'promoted' khi bot đạt tối thiểu 19/21 điểm trong bài sát hạch tự động.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EvalRunResult } from "./evals-runner.ts";

export type BotDeploymentStatus = "draft" | "evaluating" | "promoted" | "quarantined";

export interface BotPromotionRecord {
  botId: string;
  botName: string;
  workspaceId: string;
  status: BotDeploymentStatus;
  lastEvalId?: string;
  lastScore?: number;
  promotedAt?: number;
  promotedBy?: string;
  rejectionReason?: string;
  updatedAt: number;
}

export interface PromotionGateOptions {
  storageFile?: string;
  minScoreToPromote?: number;
}

export class PromotionGate {
  private records = new Map<string, BotPromotionRecord>();
  private storageFile: string | null = null;
  public readonly minScoreToPromote: number;

  constructor(options?: PromotionGateOptions) {
    this.minScoreToPromote = options?.minScoreToPromote ?? 19.0;
    this.storageFile = options?.storageFile ?? (
      process.env.RAI2_PROMOTION_FILE ?? (
        process.env.DATA_DIR
          ? join(process.env.DATA_DIR, "promotion-gate-state.json")
          : (existsSync("/var/lib/openmausbot") ? "/var/lib/openmausbot/promotion-gate-state.json" : "/tmp/promotion-gate-state.json")
      )
    );
    this.loadState();
  }

  private getRecordKey(workspaceId: string, botId: string): string {
    return `${workspaceId}:${botId}`;
  }

  private loadState(): void {
    if (!this.storageFile || !existsSync(this.storageFile)) return;
    try {
      const raw = readFileSync(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.records)) {
        for (const r of parsed.records) {
          if (r && typeof r.botId === "string") {
            const ws = typeof r.workspaceId === "string" ? r.workspaceId : "default";
            this.records.set(this.getRecordKey(ws, r.botId), r);
          }
        }
      }
    } catch {
      // Ignore load errors
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
        records: Array.from(this.records.values()),
      };
      writeFileSync(this.storageFile, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignore save errors
    }
  }

  getRecord(botId: string, workspaceId = "default", botName = "Assistant"): BotPromotionRecord {
    const key = this.getRecordKey(workspaceId, botId);
    let rec = this.records.get(key);
    if (!rec) {
      rec = {
        botId,
        botName,
        workspaceId,
        status: "draft",
        updatedAt: Date.now(),
      };
      this.records.set(key, rec);
    }
    return rec;
  }

  evaluateAndPromote(
    evalResult: EvalRunResult,
    workspaceId = "default",
    promotedBy = "system"
  ): BotPromotionRecord {
    const rec = this.getRecord(evalResult.botId, workspaceId, evalResult.botName);

    rec.lastEvalId = evalResult.evalId;
    rec.lastScore = evalResult.totalScore;
    rec.updatedAt = Date.now();

    if (evalResult.totalScore >= this.minScoreToPromote && evalResult.passed) {
      rec.status = "promoted";
      rec.promotedAt = Date.now();
      rec.promotedBy = promotedBy;
      rec.rejectionReason = undefined;
    } else {
      rec.status = "quarantined";
      rec.rejectionReason = `Điểm sát hạch (${evalResult.totalScore}/21) không đạt chuẩn hoặc vi phạm tiêu chí an toàn bắt buộc. Bot bị cách ly tiếp khách.`;
    }

    this.records.set(this.getRecordKey(workspaceId, rec.botId), rec);
    this.saveState();
    return rec;
  }

  canServeCustomer(botId: string, workspaceId = "default"): { allowed: boolean; status: BotDeploymentStatus; reason?: string } {
    const rec = this.records.get(this.getRecordKey(workspaceId, botId));
    if (!rec || rec.status !== "promoted") {
      return {
        allowed: false,
        status: rec?.status ?? "draft",
        reason: rec?.rejectionReason ?? "Bot chưa vượt qua kỳ sát hạch năng lực (Promotion Gate: Yêu cầu tối thiểu 19/21 điểm).",
      };
    }
    return {
      allowed: true,
      status: "promoted",
    };
  }

  listRecords(workspaceId?: string): BotPromotionRecord[] {
    const all = Array.from(this.records.values());
    if (workspaceId) {
      return all.filter((r) => r.workspaceId === workspaceId);
    }
    return all;
  }
}

let defaultPromotionGate: PromotionGate | null = null;
export function getPromotionGate(): PromotionGate {
  if (!defaultPromotionGate) {
    defaultPromotionGate = new PromotionGate();
  }
  return defaultPromotionGate;
}
