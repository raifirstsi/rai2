import { api } from "@/state/store";
import { saveContextVaultToStorage, type ContextPillarId } from "./context-vault";
import { saveTocDiagnosis, type TocDiagnosisResult } from "./toc-detector";
import { saveAutonomyProfiles, type BotAutonomyProfile } from "./autonomy-graduation";
import { saveFridayPulseWebhookUrl } from "./friday-pulse";
import { saveMarginApproval } from "./margin-guard";

export interface EnterpriseServerState {
  workspaceId: string;
  updatedAt: number;
  contextVault?: {
    pillars?: Partial<Record<ContextPillarId, string>>;
    hardGateLocked?: boolean;
    updatedAt?: number;
  };
  tocDiagnosis?: TocDiagnosisResult | null;
  marginGuard?: {
    minThresholdPct?: number;
    maxDiscountPct?: number;
    approvals?: Record<string, { approvedAt: string; note?: string; approvedBy?: string }>;
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
  autonomyProfiles?: Record<string, BotAutonomyProfile>;
  fridayPulse?: {
    webhookUrl?: string;
    lastSentAt?: string;
    lastSentWeek?: string;
    reviewedWeek?: string;
  };
}

export interface LiveBusinessPulseSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  netMarginPercent: number;
  transactionCount: number;
  bottlenecks: Array<{ id: string; type: string; severity: string; title: string; impactValueVnd: number; suggestedAction: string }>;
}

export async function fetchEnterpriseState(workspaceId = "default"): Promise<{
  state: EnterpriseServerState | null;
  livePulse: LiveBusinessPulseSummary | null;
}> {
  try {
    const resp = await api<{
      success?: boolean;
      state?: EnterpriseServerState;
      livePulse?: LiveBusinessPulseSummary;
    }>(`/api/enterprise/state?workspaceId=${encodeURIComponent(workspaceId)}`);
    const st = resp?.state ?? null;
    if (st) {
      if (st.contextVault?.pillars && Object.keys(st.contextVault.pillars).length > 0) {
        saveContextVaultToStorage(st.contextVault.pillars as Record<ContextPillarId, string>);
      }
      if (st.contextVault && typeof st.contextVault.hardGateLocked === "boolean" && typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("rai2_quote_hard_gate_interlock", String(st.contextVault.hardGateLocked));
      }
      if (st.tocDiagnosis) {
        saveTocDiagnosis(st.tocDiagnosis);
      }
      if (st.autonomyProfiles && Object.keys(st.autonomyProfiles).length > 0) {
        saveAutonomyProfiles(st.autonomyProfiles);
      }
      if (st.fridayPulse?.webhookUrl) {
        saveFridayPulseWebhookUrl(st.fridayPulse.webhookUrl);
      }
      if (st.marginGuard?.approvals) {
        for (const [msgId, info] of Object.entries(st.marginGuard.approvals)) {
          saveMarginApproval(msgId, info.note);
        }
      }
    }
    return { state: st, livePulse: resp?.livePulse ?? null };
  } catch {
    return { state: null, livePulse: null };
  }
}

export async function patchEnterpriseState(
  patch: Partial<Omit<EnterpriseServerState, "workspaceId" | "updatedAt">>,
  workspaceId = "default",
): Promise<EnterpriseServerState | null> {
  try {
    const resp = await api<{ success?: boolean; state?: EnterpriseServerState }>("/api/enterprise/state", {
      method: "PUT",
      body: JSON.stringify({ workspaceId, ...patch }),
    });
    return resp?.state ?? null;
  } catch {
    return null;
  }
}

export async function approveMarginExceptionOnServer(payload: {
  workspaceId?: string;
  messageId: string;
  note?: string;
  proposedPrice?: number;
  directCosts?: number;
  marginPct?: number;
}): Promise<boolean> {
  try {
    const resp = await api<{ success?: boolean }>("/api/enterprise/margin-guard/approve", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return resp?.success === true;
  } catch {
    return false;
  }
}

export async function sendFridayPulseOnServer(payload: {
  workspaceId?: string;
  webhookUrl?: string;
  markdown: string;
  weekDisplay: string;
  dispatchZalo?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await api<{ success?: boolean; error?: string }>("/api/enterprise/friday-pulse/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: resp?.success === true, error: resp?.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gửi báo cáo thất bại" };
  }
}

export async function recordAutonomyOnServer(
  botId: string,
  profile: BotAutonomyProfile,
  workspaceId = "default",
): Promise<boolean> {
  try {
    const resp = await api<{ success?: boolean }>("/api/enterprise/autonomy/record", {
      method: "POST",
      body: JSON.stringify({ workspaceId, botId, profile }),
    });
    return resp?.success === true;
  } catch {
    return false;
  }
}

