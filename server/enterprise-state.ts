import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface MarginApprovalRecord {
  approvedAt: string;
  note?: string;
  approvedBy?: string;
  proposedPrice?: number;
  directCosts?: number;
  marginPct?: number;
}

export interface EnterpriseWorkspaceState {
  workspaceId: string;
  updatedAt: number;
  contextVault?: {
    pillars: Record<string, string>;
    hardGateLocked?: boolean;
    updatedAt?: number;
  };
  tocDiagnosis?: Record<string, unknown> | null;
  marginGuard?: {
    minThresholdPct?: number;
    maxDiscountPct?: number;
    approvals?: Record<string, MarginApprovalRecord>;
  };
  fiveLevers?: {
    input?: Record<string, unknown>;
    improvements?: Record<string, unknown>;
    targetGrossMargin?: number;
    updatedAt?: number;
  };
  architectureAssessment?: {
    tasks?: unknown[];
    answers?: Record<string, number>;
    totalScore?: number;
    maxScore?: number;
    updatedAt?: number;
  };
  autonomyProfiles?: Record<string, unknown>;
  fridayPulse?: {
    webhookUrl?: string;
    lastSentAt?: string;
    lastSentWeek?: string;
    reviewedWeek?: string;
  };
}

const clampPct = (val: unknown): number | undefined =>
  typeof val === "number" && Number.isFinite(val) ? Math.min(95, Math.max(0, Math.round(val * 10) / 10)) : undefined;

export type EnterpriseStatePatch = Omit<Partial<EnterpriseWorkspaceState>, "workspaceId" | "updatedAt">;

export class EnterpriseStateStore {
  private readonly filePath: string | null;
  private workspaces = new Map<string, EnterpriseWorkspaceState>();

  constructor(filePath?: string | null) {
    this.filePath = filePath ?? null;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, EnterpriseWorkspaceState>;
      if (raw && typeof raw === "object") {
        for (const [wsId, wsState] of Object.entries(raw)) {
          if (wsState && typeof wsState === "object") {
            this.workspaces.set(wsId, wsState);
          }
        }
      }
    } catch {
      // Ignore corrupt disk state and start clean
    }
  }

  private saveToDisk(): void {
    if (!this.filePath) return;
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const obj: Record<string, EnterpriseWorkspaceState> = {};
      for (const [k, v] of this.workspaces.entries()) obj[k] = v;
      const tmp = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
      renameSync(tmp, this.filePath);
    } catch {
      // Non-fatal
    }
  }

  public getState(workspaceId = "default"): EnterpriseWorkspaceState {
    const ws = workspaceId.trim() || "default";
    return (
      this.workspaces.get(ws) ?? {
        workspaceId: ws,
        updatedAt: 0,
      }
    );
  }

  public updateState(workspaceId: string, patch: EnterpriseStatePatch): EnterpriseWorkspaceState {
    const ws = workspaceId.trim() || "default";
    const current = this.getState(ws);
    const next: EnterpriseWorkspaceState = {
      ...current,
      workspaceId: ws,
      updatedAt: Date.now(),
    };

    if (patch.contextVault && typeof patch.contextVault === "object") {
      next.contextVault = {
        pillars: { ...current.contextVault?.pillars, ...patch.contextVault.pillars },
        hardGateLocked:
          typeof patch.contextVault.hardGateLocked === "boolean"
            ? patch.contextVault.hardGateLocked
            : current.contextVault?.hardGateLocked,
        updatedAt: Date.now(),
      };
    }

    if (patch.tocDiagnosis !== undefined) {
      next.tocDiagnosis = patch.tocDiagnosis;
    }

    if (patch.marginGuard && typeof patch.marginGuard === "object") {
      const safeThreshold = clampPct(patch.marginGuard.minThresholdPct);
      const safeDiscount = clampPct(patch.marginGuard.maxDiscountPct);
      next.marginGuard = {
        ...current.marginGuard,
        ...(safeThreshold !== undefined ? { minThresholdPct: safeThreshold } : {}),
        ...(safeDiscount !== undefined ? { maxDiscountPct: safeDiscount } : {}),
        approvals: {
          ...current.marginGuard?.approvals,
          ...patch.marginGuard.approvals,
        },
      };
    }

    if (patch.fiveLevers && typeof patch.fiveLevers === "object") {
      next.fiveLevers = {
        ...current.fiveLevers,
        ...patch.fiveLevers,
        updatedAt: Date.now(),
      };
    }

    if (patch.architectureAssessment && typeof patch.architectureAssessment === "object") {
      next.architectureAssessment = {
        ...current.architectureAssessment,
        ...patch.architectureAssessment,
        updatedAt: Date.now(),
      };
    }

    if (patch.autonomyProfiles && typeof patch.autonomyProfiles === "object") {
      next.autonomyProfiles = {
        ...current.autonomyProfiles,
        ...patch.autonomyProfiles,
      };
    }

    if (patch.fridayPulse && typeof patch.fridayPulse === "object") {
      next.fridayPulse = {
        ...current.fridayPulse,
        ...patch.fridayPulse,
      };
    }

    this.workspaces.set(ws, next);
    this.saveToDisk();
    return next;
  }

  public recordMarginApproval(
    workspaceId: string,
    messageId: string,
    record: MarginApprovalRecord,
  ): EnterpriseWorkspaceState {
    return this.updateState(workspaceId, {
      marginGuard: {
        approvals: { [messageId]: record },
      },
    });
  }
}

let globalStore: EnterpriseStateStore | null = null;
export function getEnterpriseStateStore(dataDir?: string): EnterpriseStateStore {
  if (!globalStore) {
    const resolvedDir = dataDir ?? process.env.OMB_DATA_DIR ?? process.env.RAI2_DATA_DIR ?? process.env.DATA_DIR;
    const file = resolvedDir ? join(resolvedDir, "enterprise-os-state.json") : null;
    globalStore = new EnterpriseStateStore(file);
  }
  return globalStore;
}

