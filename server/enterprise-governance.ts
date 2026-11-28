import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceAuditLedger, type AuditRecord } from "./agent/merkle-audit.ts";

export type DataClassificationTier = "public" | "internal" | "zone" | "confidential";

export type MemoryNamespaceKind = "private-personal" | "work-context" | "confidential";

export type EmployeeRole = "owner" | "admin" | "manager" | "member";

export interface EnterpriseConstitution {
  industry: string;
  toneOfVoice: string;
  languagePolicy: string;
  forbiddenTopics: string[];
  requireLocalLlmForConfidential: boolean;
  localLlmEngineHint: string;
  dlpEnabled: boolean;
  censorshipEnabled: boolean;
  updatedAt: number;
}

export interface EmployeeGovernanceProfile {
  email: string;
  name: string;
  role: EmployeeRole;
  zone?: string;
  maxDataTier: DataClassificationTier;
  personalBotId?: string;
  personalBotName?: string;
  namespaces: {
    privatePersonal: string;
    workContext: string;
  };
  status: "active" | "offboarded";
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseGovernanceState {
  constitution: EnterpriseConstitution;
  employees: Record<string, EmployeeGovernanceProfile>;
  zoneDataTiers: Record<string, DataClassificationTier>;
  updatedAt: number;
}

export const DATA_TIER_RANK: Record<DataClassificationTier, number> = {
  public: 0,
  internal: 1,
  zone: 2,
  confidential: 3,
};

export const ROLE_DEFAULT_MAX_TIER: Record<EmployeeRole, DataClassificationTier> = {
  owner: "confidential",
  admin: "confidential",
  manager: "zone",
  member: "internal",
};

const DEFAULT_CONSTITUTION: EnterpriseConstitution = {
  industry: "Doanh nghiệp tổng hợp",
  toneOfVoice: "Chuyên nghiệp, súc tích, dựa trên số liệu thực tế và tuân thủ quy trình nội bộ.",
  languagePolicy: "Tiếng Việt (mặc định)",
  forbiddenTopics: [],
  requireLocalLlmForConfidential: false,
  localLlmEngineHint: "ollama",
  dlpEnabled: true,
  censorshipEnabled: true,
  updatedAt: Date.now(),
};

export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function employeeNamespaces(email: string): { privatePersonal: string; workContext: string } {
  const safeSlug = normalizeEmailKey(email).replace(/[^a-z0-9._-]+/g, "_");
  return {
    privatePersonal: `private-personal/${safeSlug}`,
    workContext: `work-context/${safeSlug}`,
  };
}

export function evaluateDataAccess(input: {
  employee?: Pick<EmployeeGovernanceProfile, "email" | "role" | "zone" | "maxDataTier" | "status"> | null;
  targetTier: DataClassificationTier;
  targetZone?: string;
  targetNamespace?: MemoryNamespaceKind;
  targetOwnerEmail?: string;
}): { allowed: boolean; reason: string } {
  const emp = input.employee;
  if (!emp) {
    if (input.targetTier === "public") return { allowed: true, reason: "public_tier" };
    return { allowed: false, reason: "unauthenticated_or_unbound_employee" };
  }
  if (emp.status !== "active") {
    return { allowed: false, reason: "employee_offboarded" };
  }
  if (input.targetNamespace === "private-personal" && input.targetOwnerEmail) {
    if (normalizeEmailKey(input.targetOwnerEmail) !== normalizeEmailKey(emp.email)) {
      return { allowed: false, reason: "private_namespace_isolation" };
    }
  }
  const actorRank = DATA_TIER_RANK[emp.maxDataTier] ?? 0;
  const targetRank = DATA_TIER_RANK[input.targetTier] ?? 3;
  if (actorRank < targetRank) {
    return {
      allowed: false,
      reason: `insufficient_data_tier:${emp.maxDataTier}_lt_${input.targetTier}`,
    };
  }
  if (
    input.targetTier === "zone" &&
    input.targetZone &&
    emp.role !== "owner" &&
    emp.role !== "admin" &&
    emp.zone &&
    emp.zone.trim().toLowerCase() !== input.targetZone.trim().toLowerCase()
  ) {
    return {
      allowed: false,
      reason: `cross_zone_denied:${emp.zone}_ne_${input.targetZone}`,
    };
  }
  return { allowed: true, reason: "authorized" };
}

export function resolveSensitivityModelRoute(input: {
  constitution: Pick<EnterpriseConstitution, "requireLocalLlmForConfidential" | "localLlmEngineHint">;
  dataTier: DataClassificationTier;
  currentEngineId?: string;
  availableLocalEngineIds?: readonly string[];
}): {
  route: "cloud_ok" | "local_enforced" | "blocked_no_local_llm";
  targetEngineId?: string;
  reason: string;
} {
  if (input.dataTier !== "confidential" || !input.constitution.requireLocalLlmForConfidential) {
    return { route: "cloud_ok", targetEngineId: input.currentEngineId, reason: "policy_allows_current_engine" };
  }
  const current = (input.currentEngineId || "").toLowerCase();
  const isAlreadyLocal =
    current.includes("local") ||
    current.includes("ollama") ||
    current.includes("vllm") ||
    current.includes("llamacpp") ||
    current.includes("openai-compat");
  if (isAlreadyLocal) {
    return { route: "local_enforced", targetEngineId: input.currentEngineId, reason: "already_on_local_llm" };
  }
  const localMatch = (input.availableLocalEngineIds ?? []).find((id) =>
    /local|ollama|vllm|llamacpp|openai-compat/i.test(id),
  );
  if (localMatch) {
    return { route: "local_enforced", targetEngineId: localMatch, reason: "rerouted_to_local_llm" };
  }
  return {
    route: "blocked_no_local_llm",
    reason: `confidential_requires_local_llm:${input.constitution.localLlmEngineHint || "ollama"}`,
  };
}

export class EnterpriseGovernanceStore {
  private readonly filePath: string;
  private state: EnterpriseGovernanceState;

  constructor(dataDir?: string) {
    const baseDir =
      dataDir ||
      process.env.RAI2_DATA_DIR ||
      process.env.OMB_DATA_DIR ||
      process.env.DATA_DIR ||
      "/tmp";
    this.filePath = join(baseDir, "enterprise-governance.json");
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): EnterpriseGovernanceState {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<EnterpriseGovernanceState>;
        return {
          constitution: { ...DEFAULT_CONSTITUTION, ...parsed.constitution },
          employees: parsed.employees ?? {},
          zoneDataTiers: parsed.zoneDataTiers ?? {
            "Zone 6": "confidential",
            "Zone 7": "confidential",
          },
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      } catch {
        // Fallback to clean defaults on corrupt JSON
      }
    }
    return {
      constitution: { ...DEFAULT_CONSTITUTION },
      employees: {},
      zoneDataTiers: {
        "Zone 6": "confidential",
        "Zone 7": "confidential",
      },
      updatedAt: Date.now(),
    };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  public getState(): EnterpriseGovernanceState {
    return structuredClone(this.state);
  }

  public updateGovernance(
    patch: {
      constitution?: Partial<EnterpriseConstitution>;
      zoneDataTiers?: Record<string, DataClassificationTier>;
      employeeUpdates?: Record<string, Partial<EmployeeGovernanceProfile>>;
    },
    actor = "admin",
  ): EnterpriseGovernanceState {
    if (patch.constitution) {
      const c = patch.constitution;
      this.state.constitution = {
        ...this.state.constitution,
        industry: typeof c.industry === "string" ? c.industry.trim().slice(0, 120) : this.state.constitution.industry,
        toneOfVoice: typeof c.toneOfVoice === "string" ? c.toneOfVoice.trim().slice(0, 400) : this.state.constitution.toneOfVoice,
        languagePolicy: typeof c.languagePolicy === "string" ? c.languagePolicy.trim().slice(0, 100) : this.state.constitution.languagePolicy,
        localLlmEngineHint: typeof c.localLlmEngineHint === "string" ? c.localLlmEngineHint.trim().slice(0, 80) : this.state.constitution.localLlmEngineHint,
        requireLocalLlmForConfidential: typeof c.requireLocalLlmForConfidential === "boolean" ? c.requireLocalLlmForConfidential : this.state.constitution.requireLocalLlmForConfidential,
        dlpEnabled: typeof c.dlpEnabled === "boolean" ? c.dlpEnabled : this.state.constitution.dlpEnabled,
        censorshipEnabled: typeof c.censorshipEnabled === "boolean" ? c.censorshipEnabled : this.state.constitution.censorshipEnabled,
        forbiddenTopics: Array.isArray(c.forbiddenTopics)
          ? c.forbiddenTopics.map((s) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 100)
          : this.state.constitution.forbiddenTopics,
        updatedAt: Date.now(),
      };
    }
    if (patch.zoneDataTiers) {
      const nextTiers = { ...this.state.zoneDataTiers };
      for (const [zoneKey, tierVal] of Object.entries(patch.zoneDataTiers)) {
        if (zoneKey === "__proto__" || zoneKey === "constructor" || zoneKey === "prototype") continue;
        if (tierVal in DATA_TIER_RANK) {
          nextTiers[zoneKey] = tierVal;
        }
      }
      this.state.zoneDataTiers = nextTiers;
    }
    if (patch.employeeUpdates) {
      for (const [rawEmail, empPatch] of Object.entries(patch.employeeUpdates)) {
        const key = normalizeEmailKey(rawEmail);
        const existing = this.state.employees[key];
        if (!existing || !empPatch || typeof empPatch !== "object") continue;
        const safeRole = empPatch.role && empPatch.role in ROLE_DEFAULT_MAX_TIER ? empPatch.role : existing.role;
        const safeTier = empPatch.maxDataTier && empPatch.maxDataTier in DATA_TIER_RANK ? empPatch.maxDataTier : existing.maxDataTier;
        this.state.employees[key] = {
          ...existing,
          name: typeof empPatch.name === "string" && empPatch.name.trim() ? empPatch.name.trim().slice(0, 120) : existing.name,
          zone: typeof empPatch.zone === "string" ? empPatch.zone.trim().slice(0, 80) : existing.zone,
          role: safeRole,
          maxDataTier: safeTier,
          email: existing.email,
          status: existing.status,
          personalBotId: existing.personalBotId,
          namespaces: existing.namespaces,
          createdAt: existing.createdAt,
          updatedAt: Date.now(),
        };
      }
    }
    this.state.updatedAt = Date.now();
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "governance_updated", {
      requireLocalLlmForConfidential: this.state.constitution.requireLocalLlmForConfidential,
      dlpEnabled: this.state.constitution.dlpEnabled,
      censorshipEnabled: this.state.constitution.censorshipEnabled,
      forbiddenTopicsCount: this.state.constitution.forbiddenTopics.length,
    });
    return this.getState();
  }

  public upsertEmployee(
    input: {
      email: string;
      name: string;
      role?: EmployeeRole;
      zone?: string;
      maxDataTier?: DataClassificationTier;
      personalBotId?: string;
      personalBotName?: string;
    },
    actor = "admin",
  ): EmployeeGovernanceProfile {
    const key = normalizeEmailKey(input.email);
    const now = Date.now();
    const role: EmployeeRole = input.role ?? "member";
    const existing = this.state.employees[key];
    const profile: EmployeeGovernanceProfile = {
      email: key,
      name: input.name.trim() || existing?.name || key.split("@")[0]!,
      role,
      zone: input.zone?.trim() || existing?.zone,
      maxDataTier: input.maxDataTier ?? existing?.maxDataTier ?? ROLE_DEFAULT_MAX_TIER[role],
      personalBotId: input.personalBotId ?? existing?.personalBotId,
      personalBotName: input.personalBotName ?? existing?.personalBotName,
      namespaces: existing?.namespaces ?? employeeNamespaces(key),
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.state.employees[key] = profile;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "employee_provisioned", {
      email: profile.email,
      role: profile.role,
      zone: profile.zone ?? null,
      maxDataTier: profile.maxDataTier,
      personalBotId: profile.personalBotId ?? null,
    });
    return structuredClone(profile);
  }

  public offboardEmployee(email: string, actor = "admin"): EmployeeGovernanceProfile | null {
    const key = normalizeEmailKey(email);
    const existing = this.state.employees[key];
    if (!existing) return null;
    const updated: EmployeeGovernanceProfile = {
      ...existing,
      status: "offboarded",
      updatedAt: Date.now(),
    };
    this.state.employees[key] = updated;
    this.state.updatedAt = Date.now();
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "employee_offboarded", {
      email: updated.email,
      personalBotId: updated.personalBotId ?? null,
      preservedWorkNamespace: updated.namespaces.workContext,
      revokedPrivateNamespace: updated.namespaces.privatePersonal,
    });
    return structuredClone(updated);
  }

  public queryAuditTrail(opts?: {
    actor?: string;
    action?: string;
    q?: string;
    limit?: number;
  }): {
    records: AuditRecord[];
    integrity: { valid: boolean; corruptedAt?: number; totalRecords: number };
  } {
    const ledger = getWorkspaceAuditLedger();
    const integrity = ledger.verifyIntegrity();
    let records = ledger.getRecords().reverse();
    if (opts?.actor) {
      const a = opts.actor.trim().toLowerCase();
      records = records.filter((r) => (r.actor ?? '').toLowerCase().includes(a));
    }
    if (opts?.action) {
      const act = opts.action.trim().toLowerCase();
      records = records.filter((r) => (r.action ?? '').toLowerCase().includes(act));
    }
    if (opts?.q) {
      const needle = opts.q.trim().toLowerCase();
      records = records.filter((r) =>
        `${r.id} ${r.actor} ${r.action} ${JSON.stringify(r.payload)}`.toLowerCase().includes(needle),
      );
    }
    const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
    return { records: records.slice(0, limit), integrity };
  }
}

let globalGovernanceStore: EnterpriseGovernanceStore | null = null;
export function getEnterpriseGovernanceStore(): EnterpriseGovernanceStore {
  if (!globalGovernanceStore) {
    globalGovernanceStore = new EnterpriseGovernanceStore();
  }
  return globalGovernanceStore;
}

export function resetEnterpriseGovernanceStoreForTest(): void {
  globalGovernanceStore = null;
}
