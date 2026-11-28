import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";
import { getEnterpriseGovernanceStore } from "./enterprise-governance.ts";

export type PromotionStatus = "proposed" | "approved" | "deprecated";

export interface OrgDecisionRecord {
  id: string;
  title: string;
  summary: string;
  scopeZone: string; // "all" or specific Zone e.g. "Zone 3"
  status: PromotionStatus;
  effectiveFrom: string; // ISO date
  proposedBy: string;
  approvedBy?: string;
  sourceRef?: string;
  createdAt: number;
  updatedAt: number;
}

export type KnowledgeKind = "sop" | "best_practice" | "project_brief" | "operational_pattern";

export interface OrgKnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  scopeZone: string;
  authorEmail: string;
  status: PromotionStatus;
  approvedBy?: string;
  sourceRef?: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeHandoverPackage {
  id: string;
  departedEmail: string;
  departedName: string;
  zone: string;
  successorEmail?: string;
  preservedWorkNamespace: string;
  purgedPrivateNamespace: string;
  summary: string;
  extractedKnowledgeIds: string[];
  createdBy: string;
  createdAt: number;
}

export interface EnterpriseBrainState {
  decisions: Record<string, OrgDecisionRecord>;
  knowledge: Record<string, OrgKnowledgeEntry>;
  handovers: Record<string, KnowledgeHandoverPackage>;
  updatedAt: number;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function matchesZone(itemZone: string, botSection?: string): boolean {
  const z = itemZone.trim().toLowerCase();
  if (!z || z === "all" || z === "chung") return true;
  if (!botSection) return false;
  const sec = botSection.trim().toLowerCase();
  return sec.includes(z) || z.includes(sec);
}

export class EnterpriseBrainStore {
  private readonly filePath: string;
  private state: EnterpriseBrainState;

  constructor(dataDir?: string) {
    const baseDir =
      dataDir ||
      process.env.RAI2_DATA_DIR ||
      process.env.OMB_DATA_DIR ||
      process.env.DATA_DIR ||
      "/tmp";
    this.filePath = join(baseDir, "enterprise-brain.json");
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): EnterpriseBrainState {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<EnterpriseBrainState>;
        return {
          decisions: parsed.decisions ?? {},
          knowledge: parsed.knowledge ?? {},
          handovers: parsed.handovers ?? {},
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      } catch {
        // Fallback to empty state on corrupt file
      }
    }
    return { decisions: {}, knowledge: {}, handovers: {}, updatedAt: Date.now() };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  public getState(): EnterpriseBrainState {
    return structuredClone(this.state);
  }

  public proposeDecision(
    input: {
      title: string;
      summary: string;
      scopeZone?: string;
      effectiveFrom?: string;
      sourceRef?: string;
      autoApprove?: boolean;
    },
    actor = "bot",
  ): OrgDecisionRecord {
    const now = Date.now();
    const status: PromotionStatus = input.autoApprove ? "approved" : "proposed";
    const rec: OrgDecisionRecord = {
      id: makeId("dec"),
      title: input.title.trim().slice(0, 180),
      summary: input.summary.trim().slice(0, 1500),
      scopeZone: (input.scopeZone ?? "all").trim() || "all",
      status,
      effectiveFrom: input.effectiveFrom ?? new Date(now).toISOString().slice(0, 10),
      proposedBy: actor,
      ...(status === "approved" ? { approvedBy: actor } : {}),
      ...(input.sourceRef ? { sourceRef: input.sourceRef.slice(0, 200) } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.state.decisions[rec.id] = rec;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.decision_proposed", {
      decisionId: rec.id,
      title: rec.title,
      scopeZone: rec.scopeZone,
      status: rec.status,
    });
    return structuredClone(rec);
  }

  public reviewDecision(id: string, status: PromotionStatus, actor = "admin"): OrgDecisionRecord | null {
    const existing = this.state.decisions[id];
    if (!existing) return null;
    const now = Date.now();
    const updated: OrgDecisionRecord = {
      ...existing,
      status,
      ...(status === "approved" ? { approvedBy: actor } : {}),
      updatedAt: now,
    };
    this.state.decisions[id] = updated;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, `enterprise.decision_${status}`, {
      decisionId: id,
      title: updated.title,
    });
    return structuredClone(updated);
  }

  public proposeKnowledge(
    input: {
      kind?: KnowledgeKind;
      title: string;
      content: string;
      scopeZone?: string;
      sourceRef?: string;
      autoApprove?: boolean;
    },
    actor = "employee",
  ): OrgKnowledgeEntry {
    const now = Date.now();
    const status: PromotionStatus = input.autoApprove ? "approved" : "proposed";
    const entry: OrgKnowledgeEntry = {
      id: makeId("know"),
      kind: input.kind ?? "best_practice",
      title: input.title.trim().slice(0, 180),
      content: input.content.trim().slice(0, 4000),
      scopeZone: (input.scopeZone ?? "all").trim() || "all",
      authorEmail: actor,
      status,
      ...(status === "approved" ? { approvedBy: actor } : {}),
      ...(input.sourceRef ? { sourceRef: input.sourceRef.slice(0, 200) } : {}),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.state.knowledge[entry.id] = entry;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.knowledge_proposed", {
      knowledgeId: entry.id,
      kind: entry.kind,
      title: entry.title,
      status: entry.status,
    });
    return structuredClone(entry);
  }

  public reviewKnowledge(id: string, status: PromotionStatus, actor = "admin"): OrgKnowledgeEntry | null {
    const existing = this.state.knowledge[id];
    if (!existing) return null;
    const now = Date.now();
    const updated: OrgKnowledgeEntry = {
      ...existing,
      status,
      ...(status === "approved" ? { approvedBy: actor } : {}),
      updatedAt: now,
    };
    this.state.knowledge[id] = updated;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, `enterprise.knowledge_${status}`, {
      knowledgeId: id,
      title: updated.title,
    });
    return structuredClone(updated);
  }

  public recordOffboardingHandover(
    input: {
      departedEmail: string;
      departedName: string;
      zone: string;
      successorEmail?: string;
      workSummary: string;
      preservedWorkNamespace: string;
      purgedPrivateNamespace: string;
    },
    actor = "admin",
  ): KnowledgeHandoverPackage {
    const now = Date.now();
    const extractedIds: string[] = [];
    if (input.workSummary.trim()) {
      const k = this.proposeKnowledge(
        {
          kind: "project_brief",
          title: `Bàn giao công việc từ ${input.departedName} (${input.zone || "Chung"})`,
          content: input.workSummary.trim(),
          scopeZone: input.zone || "all",
          sourceRef: `offboarding:${input.departedEmail}`,
          autoApprove: true,
        },
        actor,
      );
      extractedIds.push(k.id);
    }
    const pkg: KnowledgeHandoverPackage = {
      id: makeId("handover"),
      departedEmail: input.departedEmail.trim().toLowerCase(),
      departedName: input.departedName.trim(),
      zone: input.zone || "all",
      ...(input.successorEmail?.trim() ? { successorEmail: input.successorEmail.trim().toLowerCase() } : {}),
      preservedWorkNamespace: input.preservedWorkNamespace,
      purgedPrivateNamespace: input.purgedPrivateNamespace,
      summary: input.workSummary.trim() || `Đã đóng gói tri thức work-context của ${input.departedName}.`,
      extractedKnowledgeIds: extractedIds,
      createdBy: actor,
      createdAt: now,
    };
    this.state.handovers[pkg.id] = pkg;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.knowledge_handover", {
      handoverId: pkg.id,
      departedEmail: pkg.departedEmail,
      successorEmail: pkg.successorEmail ?? null,
      extractedKnowledgeIds: extractedIds,
    });
    return structuredClone(pkg);
  }

  public getRelevantContextForBot(botSection?: string): {
    decisions: OrgDecisionRecord[];
    knowledge: OrgKnowledgeEntry[];
  } {
    const decisions = Object.values(this.state.decisions)
      .filter((d) => d.status === "approved" && matchesZone(d.scopeZone, botSection))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8);
    const knowledge = Object.values(this.state.knowledge)
      .filter((k) => k.status === "approved" && matchesZone(k.scopeZone, botSection))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8);
    return { decisions, knowledge };
  }

  public buildOnboardingBrief(input: { zone?: string; employeeEmail?: string }): {
    zone: string;
    constitutionSummary: string;
    decisions: OrgDecisionRecord[];
    knowledge: OrgKnowledgeEntry[];
    handovers: KnowledgeHandoverPackage[];
    markdown: string;
  } {
    const zone = input.zone?.trim() || "all";
    const { decisions, knowledge } = this.getRelevantContextForBot(zone === "all" ? undefined : zone);
    let dirty = false;
    for (const k of knowledge) {
      const stored = this.state.knowledge[k.id];
      if (stored) {
        stored.usageCount = (stored.usageCount ?? 0) + 1;
        k.usageCount = stored.usageCount;
        dirty = true;
      }
    }
    if (dirty) {
      this.state.updatedAt = Date.now();
      this.saveToDisk();
    }
    const handovers = Object.values(this.state.handovers)
      .filter((h) => matchesZone(h.zone, zone === "all" ? undefined : zone))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    const gov = getEnterpriseGovernanceStore().getState();
    const c = gov.constitution;
    const constitutionSummary = `Ngành: ${c.industry} | Văn phong: ${c.toneOfVoice}`;

    const mdLines = [
      `# BRIEFING ONBOARDING DỰ ÁN / NHÂN SỰ MỚI (${zone})`,
      input.employeeEmail ? `- Nhân sự: ${input.employeeEmail}` : "",
      `- ${constitutionSummary}`,
      "",
      "## 1. Quyết định công ty đang có hiệu lực (Decision Ledger)",
      ...(decisions.length > 0
        ? decisions.map((d) => `- **[${d.effectiveFrom}] ${d.title}**: ${d.summary}`)
        : ["- Chưa có quyết định nào được duyệt trong phạm vi này."]),
      "",
      "## 2. Tri thức & Quy trình chuẩn đã duyệt (Knowledge Flywheel)",
      ...(knowledge.length > 0
        ? knowledge.map((k) => `- **[${k.kind}] ${k.title}**: ${k.content.slice(0, 300)}`)
        : ["- Chưa có tri thức nào được duyệt trong phạm vi này."]),
      "",
      "## 3. Hồ sơ Bàn giao từ nhân sự trước (Handovers)",
      ...(handovers.length > 0
        ? handovers.map((h) => `- **Từ ${h.departedName} (${h.departedEmail})**: ${h.summary}`)
        : ["- Không có hồ sơ bàn giao."]),
    ].filter((line) => line !== "");

    return {
      zone,
      constitutionSummary,
      decisions,
      knowledge,
      handovers,
      markdown: mdLines.join("\n"),
    };
  }
}

let globalBrainStore: EnterpriseBrainStore | null = null;
export function getEnterpriseBrainStore(): EnterpriseBrainStore {
  if (!globalBrainStore) {
    globalBrainStore = new EnterpriseBrainStore();
  }
  return globalBrainStore;
}

export function resetEnterpriseBrainStoreForTest(): void {
  globalBrainStore = null;
}
