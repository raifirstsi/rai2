import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";
import { getEnterpriseBrainStore } from "./enterprise-brain.ts";
import { getEnterpriseGovernanceStore } from "./enterprise-governance.ts";
import { getEnterpriseOmnichannelGateway } from "./enterprise-omnichannel.ts";
import { getEnterpriseTeamOrchestrator } from "./enterprise-team.ts";

export interface SealedTenantSecret {
  version: number;
  ciphertext: string; // enc:dek:v<N>:iv:tag:hex
  updatedAt: number;
  updatedBy: string;
}

export interface TenantKeyRecord {
  tenantId: string;
  keyVersion: number;
  wrappedDek: string; // enc:kek:iv:tag:hex
  createdAt: number;
  rotatedAt: number;
  rotatedBy: string;
  encryptedSecrets: Record<string, SealedTenantSecret>;
}

export interface SovereigntyKeyStoreState {
  tenants: Record<string, TenantKeyRecord>;
  updatedAt: number;
}

export interface CeoConsoleSnapshot {
  tenantId: string;
  generatedAt: string;
  organization: {
    activeEmployees: number;
    offboardedEmployees: number;
    zones: Array<{
      zone: string;
      employees: number;
      openTasks: number;
      completedTasks: number;
      blockedTasks: number;
      decisions: number;
      knowledge: number;
    }>;
  };
  productivity: {
    totalTasks: number;
    completedTasks: number;
    reviewNeededTasks: number;
    blockedTasks: number;
    completionRatePct: number;
    totalDagWorkflows: number;
    totalDagRuns: number;
    completedDagRuns: number;
  };
  knowledge: {
    approvedDecisions: number;
    proposedDecisions: number;
    approvedKnowledge: number;
    proposedKnowledge: number;
    totalKnowledgeUsage: number;
    handoversCount: number;
  };
  security: {
    dlpEventsCount: number;
    confidentialReroutesCount: number;
    offboardBlocksCount: number;
    dekKeyVersion: number;
    dekRotatedAt: number;
    sealedSecretsCount: number;
    sealedSecretNames: string[];
    omnichannelCount: number;
    activeChannelBindings: number;
  };
  aiSpend: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    byModel: Array<{ model: string; turns: number; costUsd: number }>;
  };
}

function deriveMasterKek(filePath: string): Buffer {
  const raw =
    process.env.RAI2_MASTER_KEK ||
    process.env.RAI2_VAULT_KEY ||
    process.env.OMB_SESSION_SECRET ||
    `${filePath}:rai2-master-kek-v1`;
  return scryptSync(raw, "rai2-envelope-kek-salt", 32);
}

function encryptWithKey(plaintext: string, key: Buffer, prefix: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${prefix}:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decryptWithKey(token: string, key: Buffer, expectedPrefix: string): string {
  if (!token.startsWith(`${expectedPrefix}:`)) {
    throw new Error("Invalid envelope ciphertext prefix");
  }
  const rest = token.slice(expectedPrefix.length + 1);
  const parts = rest.split(":");
  if (parts.length !== 3) throw new Error("Malformed envelope ciphertext");
  const iv = Buffer.from(parts[0]!, "hex");
  const tag = Buffer.from(parts[1]!, "hex");
  const data = Buffer.from(parts[2]!, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export class EnterpriseSovereigntyManager {
  private readonly filePath: string;
  private readonly masterKek: Buffer;
  private state: SovereigntyKeyStoreState;

  constructor(dataDir?: string) {
    const baseDir =
      dataDir ||
      process.env.RAI2_DATA_DIR ||
      process.env.OMB_DATA_DIR ||
      process.env.DATA_DIR ||
      "/tmp";
    this.filePath = join(baseDir, "enterprise-keys.json");
    this.masterKek = deriveMasterKek(this.filePath);
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): SovereigntyKeyStoreState {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<SovereigntyKeyStoreState>;
        return {
          tenants: parsed.tenants ?? {},
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      } catch {
        // Fallback
      }
    }
    return { tenants: {}, updatedAt: Date.now() };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  public ensureTenantKey(tenantId = "default", actor = "system"): TenantKeyRecord {
    const tid = tenantId.trim() || "default";
    let rec = this.state.tenants[tid];
    if (!rec) {
      const now = Date.now();
      const dek = randomBytes(32);
      rec = {
        tenantId: tid,
        keyVersion: 1,
        wrappedDek: encryptWithKey(dek.toString("hex"), this.masterKek, "enc:kek"),
        createdAt: now,
        rotatedAt: now,
        rotatedBy: actor,
        encryptedSecrets: {},
      };
      this.state.tenants[tid] = rec;
      this.state.updatedAt = now;
      this.saveToDisk();
    }
    return rec;
  }

  private unwrapDek(rec: TenantKeyRecord): Buffer {
    const hex = decryptWithKey(rec.wrappedDek, this.masterKek, "enc:kek");
    return Buffer.from(hex, "hex");
  }

  public getKeyStatusMasked(tenantId = "default"): {
    tenantId: string;
    keyVersion: number;
    rotatedAt: number;
    rotatedBy: string;
    secretNames: string[];
  } {
    const rec = this.ensureTenantKey(tenantId);
    return {
      tenantId: rec.tenantId,
      keyVersion: rec.keyVersion,
      rotatedAt: rec.rotatedAt,
      rotatedBy: rec.rotatedBy,
      secretNames: Object.keys(rec.encryptedSecrets),
    };
  }

  public sealTenantSecret(tenantId: string, secretName: string, plaintext: string, actor = "admin"): void {
    const name = secretName.trim().slice(0, 100);
    if (!name || !plaintext) throw new Error("secretName and plaintext are required");
    const rec = this.ensureTenantKey(tenantId, actor);
    const dek = this.unwrapDek(rec);
    const now = Date.now();
    rec.encryptedSecrets[name] = {
      version: rec.keyVersion,
      ciphertext: encryptWithKey(plaintext, dek, `enc:dek:v${rec.keyVersion}`),
      updatedAt: now,
      updatedBy: actor,
    };
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append(tenantId, actor, "enterprise.secret_sealed", {
      secretName: name,
      keyVersion: rec.keyVersion,
    });
  }

  public unsealTenantSecret(tenantId: string, secretName: string): string | null {
    const rec = this.state.tenants[tenantId];
    if (!rec) return null;
    const entry = rec.encryptedSecrets[secretName.trim()];
    if (!entry) return null;
    const dek = this.unwrapDek(rec);
    return decryptWithKey(entry.ciphertext, dek, `enc:dek:v${entry.version}`);
  }

  public rotateTenantDek(tenantId = "default", actor = "admin"): { keyVersion: number; reencryptedSecrets: number; rotatedAt: number } {
    const rec = this.ensureTenantKey(tenantId, actor);
    const oldDek = this.unwrapDek(rec);
    const newDek = randomBytes(32);
    const nextVersion = rec.keyVersion + 1;
    const now = Date.now();

    let count = 0;
    for (const [name, sec] of Object.entries(rec.encryptedSecrets)) {
      const plain = decryptWithKey(sec.ciphertext, oldDek, `enc:dek:v${sec.version}`);
      rec.encryptedSecrets[name] = {
        version: nextVersion,
        ciphertext: encryptWithKey(plain, newDek, `enc:dek:v${nextVersion}`),
        updatedAt: now,
        updatedBy: actor,
      };
      count += 1;
    }

    rec.keyVersion = nextVersion;
    rec.wrappedDek = encryptWithKey(newDek.toString("hex"), this.masterKek, "enc:kek");
    rec.rotatedAt = now;
    rec.rotatedBy = actor;
    this.state.updatedAt = now;
    this.saveToDisk();

    getWorkspaceAuditLedger().append(tenantId, actor, "enterprise.dek_rotated", {
      keyVersion: nextVersion,
      reencryptedSecrets: count,
    });
    return { keyVersion: nextVersion, reencryptedSecrets: count, rotatedAt: now };
  }

  public buildCeoConsoleSnapshot(tenantId = "default"): CeoConsoleSnapshot {
    const gov = getEnterpriseGovernanceStore().getState();
    const brain = getEnterpriseBrainStore().getState();
    const team = getEnterpriseTeamOrchestrator().getState();
    const omni = getEnterpriseOmnichannelGateway().getStateMasked();
    const keyStatus = this.getKeyStatusMasked(tenantId);

    const employees = Object.values(gov.employees);
    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const offboardedEmployees = employees.filter((e) => e.status === "offboarded").length;

    const tasks = Object.values(team.workItems);
    const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "approved").length;
    const reviewNeededTasks = tasks.filter((t) => t.status === "review_needed").length;
    const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
    const completionRatePct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const runs = Object.values(team.dagRuns);
    const completedDagRuns = runs.filter((r) => r.status === "completed").length;

    const decisions = Object.values(brain.decisions);
    const knowledge = Object.values(brain.knowledge);
    const totalKnowledgeUsage = knowledge.reduce((acc, k) => acc + (k.usageCount ?? 0), 0);

    // Zone breakdown
    const zoneSet = new Set<string>(["all"]);
    for (const e of employees) if (e.zone) zoneSet.add(e.zone);
    for (const t of tasks) if (t.zone) zoneSet.add(t.zone);
    for (const d of decisions) if (d.scopeZone) zoneSet.add(d.scopeZone);

    const zones = Array.from(zoneSet).map((z) => {
      const zNorm = z.trim().toLowerCase();
      return {
        zone: z,
        employees: employees.filter((e) => (e.zone ?? "all").trim().toLowerCase() === zNorm && e.status === "active").length,
        openTasks: tasks.filter((t) => t.zone.trim().toLowerCase() === zNorm && t.status !== "completed" && t.status !== "approved").length,
        completedTasks: tasks.filter((t) => t.zone.trim().toLowerCase() === zNorm && (t.status === "completed" || t.status === "approved")).length,
        blockedTasks: tasks.filter((t) => t.zone.trim().toLowerCase() === zNorm && t.status === "blocked").length,
        decisions: decisions.filter((d) => d.scopeZone.trim().toLowerCase() === zNorm && d.status === "approved").length,
        knowledge: knowledge.filter((k) => k.scopeZone.trim().toLowerCase() === zNorm && k.status === "approved").length,
      };
    });

    // Security & AI Spend telemetry from Merkle Audit
    const auditRecs = getEnterpriseGovernanceStore().queryAuditTrail({ limit: 200 }).records;
    let dlpEventsCount = 0;
    let confidentialReroutesCount = 0;
    let offboardBlocksCount = 0;
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const modelMap = new Map<string, { turns: number; costUsd: number }>();

    for (const r of auditRecs) {
      if (r.action.includes("dlp")) dlpEventsCount += 1;
      if (r.action === "enterprise.confidential_llm_rerouted") confidentialReroutesCount += 1;
      if (r.action.includes("offboarded")) offboardBlocksCount += 1;
      if (r.action === "turn_settled") {
        const d = ((r as { payload?: Record<string, unknown> }).payload ?? {}) as { model?: unknown; input?: unknown; output?: unknown; costUsd?: unknown };
        const model = typeof d.model === "string" && d.model ? d.model : "unknown";
        const cost = typeof d.costUsd === "number" && Number.isFinite(d.costUsd) ? d.costUsd : 0;
        const inp = typeof d.input === "number" && Number.isFinite(d.input) ? d.input : 0;
        const out = typeof d.output === "number" && Number.isFinite(d.output) ? d.output : 0;
        totalCostUsd += cost;
        totalInputTokens += inp;
        totalOutputTokens += out;
        const cur = modelMap.get(model) ?? { turns: 0, costUsd: 0 };
        cur.turns += 1;
        cur.costUsd += cost;
        modelMap.set(model, cur);
      }
    }

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      organization: {
        activeEmployees,
        offboardedEmployees,
        zones,
      },
      productivity: {
        totalTasks: tasks.length,
        completedTasks,
        reviewNeededTasks,
        blockedTasks,
        completionRatePct,
        totalDagWorkflows: Object.keys(team.workflows).length,
        totalDagRuns: runs.length,
        completedDagRuns,
      },
      knowledge: {
        approvedDecisions: decisions.filter((d) => d.status === "approved").length,
        proposedDecisions: decisions.filter((d) => d.status === "proposed").length,
        approvedKnowledge: knowledge.filter((k) => k.status === "approved").length,
        proposedKnowledge: knowledge.filter((k) => k.status === "proposed").length,
        totalKnowledgeUsage,
        handoversCount: Object.keys(brain.handovers).length,
      },
      security: {
        dlpEventsCount,
        confidentialReroutesCount,
        offboardBlocksCount,
        dekKeyVersion: keyStatus.keyVersion,
        dekRotatedAt: keyStatus.rotatedAt,
        sealedSecretsCount: keyStatus.secretNames.length,
        sealedSecretNames: keyStatus.secretNames,
        omnichannelCount: Object.keys(omni.channels).length,
        activeChannelBindings: Object.values(omni.bindings).filter((b) => b.status === "active").length,
      },
      aiSpend: {
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        totalInputTokens,
        totalOutputTokens,
        byModel: Array.from(modelMap.entries()).map(([model, v]) => ({
          model,
          turns: v.turns,
          costUsd: Number(v.costUsd.toFixed(6)),
        })),
      },
    };
  }

  public buildOpenExportBundle(tenantId = "default", actor = "admin"): {
    jsonBundle: Record<string, unknown>;
    markdownBundle: string;
    encryptedBackupPackage: {
      format: "rai2-envelope-backup-v1";
      tenantId: string;
      keyVersion: number;
      exportedAt: string;
      ciphertext: string;
    };
  } {
    const gov = getEnterpriseGovernanceStore().getState();
    const brain = getEnterpriseBrainStore().getState();
    const team = getEnterpriseTeamOrchestrator().getState();
    const omni = getEnterpriseOmnichannelGateway().getStateMasked();
    const keyStatus = this.getKeyStatusMasked(tenantId);
    const auditTrail = getEnterpriseGovernanceStore().queryAuditTrail({ limit: 200 });
    const consoleSnap = this.buildCeoConsoleSnapshot(tenantId);
    const exportedAt = new Date().toISOString();

    const jsonBundle = {
      schema: "rai2-enterprise-open-export-v1",
      exportedAt,
      exportedBy: actor,
      tenantId,
      keyStatus,
      ceoConsole: consoleSnap,
      governance: gov,
      brain,
      team,
      omnichannel: omni,
      auditRecordsCount: auditTrail.records.length,
      auditRecords: auditTrail.records,
    };

    const mdLines = [
      `# HỒ SƠ XUẤT DỮ LIỆU CHỦ QUYỀN DOANH NGHIỆP (${tenantId})`,
      `- Thời điểm xuất: ${exportedAt} | Người xuất: ${actor}`,
      `- Envelope DEK Version: v${keyStatus.keyVersion} | Nhân sự active: ${consoleSnap.organization.activeEmployees}`,
      "",
      "## 1. Quyết định Công ty (Decision Ledger)",
      ...Object.values(brain.decisions).map((d) => `- [${d.status} · ${d.effectiveFrom} · ${d.scopeZone}] **${d.title}**: ${d.summary}`),
      "",
      "## 2. Kho Tri thức & Quy trình SOP (Knowledge Flywheel)",
      ...Object.values(brain.knowledge).map((k) => `- [${k.status} · ${k.kind} · Dùng ${k.usageCount} lần] **${k.title}**: ${k.content}`),
      "",
      "## 3. Quy trình DAG & Công việc Đội ngũ",
      ...Object.values(team.workflows).map((w) => `- [DAG · ${w.scopeZone}] **${w.name}**: ${w.steps.map((s) => s.title).join(" -> ")}`),
      ...Object.values(team.workItems).map((t) => `- [Task · ${t.status} · ${t.progressPct}%] **${t.title}** (${t.assignedBotName})`),
    ];

    const rec = this.ensureTenantKey(tenantId, actor);
    const dek = this.unwrapDek(rec);
    const ciphertext = encryptWithKey(JSON.stringify(jsonBundle), dek, `enc:dek:v${rec.keyVersion}`);

    getWorkspaceAuditLedger().append(tenantId, actor, "enterprise.sovereign_export", {
      keyVersion: rec.keyVersion,
      decisions: Object.keys(brain.decisions).length,
      knowledge: Object.keys(brain.knowledge).length,
      tasks: Object.keys(team.workItems).length,
    });

    return {
      jsonBundle,
      markdownBundle: mdLines.join("\n"),
      encryptedBackupPackage: {
        format: "rai2-envelope-backup-v1",
        tenantId,
        keyVersion: rec.keyVersion,
        exportedAt,
        ciphertext,
      },
    };
  }
}

let globalSovereigntyManager: EnterpriseSovereigntyManager | null = null;
export function getEnterpriseSovereigntyManager(): EnterpriseSovereigntyManager {
  if (!globalSovereigntyManager) {
    globalSovereigntyManager = new EnterpriseSovereigntyManager();
  }
  return globalSovereigntyManager;
}

export function resetEnterpriseSovereigntyManagerForTest(): void {
  globalSovereigntyManager = null;
}
