import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";
import { matchesZone } from "./enterprise-brain.ts";
import { scanAndRedactText } from "./enterprise-dlp.ts";
import { getEnterpriseGovernanceStore } from "./enterprise-governance.ts";

export type WorkItemStatus =
  | "pending"
  | "in_progress"
  | "review_needed"
  | "approved"
  | "rejected"
  | "blocked"
  | "completed";

export type WorkPriority = "normal" | "high" | "urgent";

export interface TeamWorkItem {
  id: string;
  title: string;
  description: string;
  zone: string;
  priority: WorkPriority;
  assignedBotId: string;
  assignedBotName: string;
  leadBotId?: string;
  parentTaskId?: string;
  hopDepth: number;
  status: WorkItemStatus;
  progressPct: number;
  blockerReason?: string;
  deliverable?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  dueAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type DagStepKind = "agent_task" | "condition" | "human_approval" | "notify";

export interface DagWorkflowStep {
  id: string;
  title: string;
  kind: DagStepKind;
  assigneeBotId?: string;
  zone?: string;
  nextOnPass?: string;
  nextOnFail?: string;
}

export interface DagWorkflowPackage {
  id: string;
  name: string;
  description: string;
  scopeZone: string;
  trigger: "manual" | "schedule" | "event";
  maxHops: number;
  budgetCapUsd: number;
  steps: DagWorkflowStep[];
  status: "draft" | "published";
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface DagStepCheckpoint {
  status: "pending" | "completed" | "waiting_approval" | "failed";
  output?: string;
  actor?: string;
  completedAt?: number;
}

export interface DagRunInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  scopeZone: string;
  status: "running" | "waiting_approval" | "completed" | "failed" | "budget_exceeded";
  currentStepId: string | null;
  stepCheckpoints: Record<string, DagStepCheckpoint>;
  hopCount: number;
  spentUsd: number;
  startedBy: string;
  startedAt: number;
  updatedAt: number;
}

export type EscalationKind =
  | "approval_needed"
  | "blocker"
  | "margin_alert"
  | "deadline_overdue"
  | "loop_guard";

export interface ActionableEscalationCard {
  id: string;
  kind: EscalationKind;
  title: string;
  summaryLines: string[];
  zone: string;
  relatedTaskId?: string;
  relatedRunId?: string;
  assignedToEmail?: string;
  status: "open" | "approved" | "reassigned" | "dismissed";
  createdBy: string;
  createdAt: number;
  resolvedBy?: string;
  resolvedAt?: number;
  resolutionNote?: string;
}

export interface ProactiveReminderRule {
  id: string;
  title: string;
  schedule: "hourly" | "daily_0900" | "daily_1700" | "weekly_mon";
  targetZone: string;
  targetChannel: "dashboard" | "group_chat";
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface EnterpriseTeamState {
  workItems: Record<string, TeamWorkItem>;
  workflows: Record<string, DagWorkflowPackage>;
  dagRuns: Record<string, DagRunInstance>;
  escalations: Record<string, ActionableEscalationCard>;
  reminders: Record<string, ProactiveReminderRule>;
  updatedAt: number;
}

const MAX_TASK_DELEGATION_HOPS = 6;
const DEFAULT_DAG_MAX_HOPS = 12;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scrubTeamText(raw: string, actor: string): string {
  const text = raw.trim();
  if (!text) return "";
  try {
    const gov = getEnterpriseGovernanceStore().getState();
    return scanAndRedactText(text, {
      dlpEnabled: gov.constitution.dlpEnabled,
      censorshipEnabled: gov.constitution.censorshipEnabled,
      forbiddenTopics: gov.constitution.forbiddenTopics,
      blockOnForbiddenTopic: false,
      auditActor: actor,
      auditAction: "enterprise.team_dlp_scrub",
    }).sanitizedText;
  } catch {
    return text;
  }
}

export class EnterpriseTeamOrchestrator {
  private readonly filePath: string;
  private state: EnterpriseTeamState;

  constructor(dataDir?: string) {
    const baseDir =
      dataDir ||
      process.env.RAI2_DATA_DIR ||
      process.env.OMB_DATA_DIR ||
      process.env.DATA_DIR ||
      "/tmp";
    this.filePath = join(baseDir, "enterprise-team.json");
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): EnterpriseTeamState {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<EnterpriseTeamState>;
        return {
          workItems: parsed.workItems ?? {},
          workflows: parsed.workflows ?? {},
          dagRuns: parsed.dagRuns ?? {},
          escalations: parsed.escalations ?? {},
          reminders: parsed.reminders ?? {},
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      } catch {
        // Fallback to clean state
      }
    }
    return {
      workItems: {},
      workflows: {},
      dagRuns: {},
      escalations: {},
      reminders: {},
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

  public getState(): EnterpriseTeamState {
    return structuredClone(this.state);
  }

  public getScopedState(opts: {
    isAdmin: boolean;
    employeeZone?: string;
    employeeEmail?: string;
  }): EnterpriseTeamState {
    if (opts.isAdmin) return this.getState();
    const zone = opts.employeeZone?.trim();
    const email = opts.employeeEmail?.trim().toLowerCase();
    const filterMap = <T extends { zone?: string; scopeZone?: string; targetZone?: string; createdBy?: string }>(
      rec: Record<string, T>,
    ): Record<string, T> => {
      const out: Record<string, T> = {};
      for (const [k, v] of Object.entries(rec)) {
        const z = v.zone ?? v.scopeZone ?? v.targetZone ?? "all";
        const isOwner = Boolean(email && v.createdBy?.toLowerCase() === email);
        if (isOwner || matchesZone(z, zone)) {
          out[k] = structuredClone(v);
        }
      }
      return out;
    };
    return {
      workItems: filterMap(this.state.workItems),
      workflows: filterMap(this.state.workflows),
      dagRuns: filterMap(this.state.dagRuns),
      escalations: filterMap(this.state.escalations),
      reminders: filterMap(this.state.reminders),
      updatedAt: this.state.updatedAt,
    };
  }

  // ── 1. Cross-Bot Work Graph & Hierarchical Team Delegation ──

  public createTask(
    input: {
      title: string;
      description?: string;
      zone?: string;
      priority?: WorkPriority;
      assignedBotId: string;
      assignedBotName?: string;
      leadBotId?: string;
      parentTaskId?: string;
      dueAt?: number;
    },
    actor = "manager",
  ): TeamWorkItem {
    const title = scrubTeamText(input.title, actor).slice(0, 180);
    if (!title) throw new Error("Task title must not be empty");
    const description = scrubTeamText(input.description ?? "", actor).slice(0, 2000);
    let hopDepth = 0;
    if (input.parentTaskId) {
      const parent = this.state.workItems[input.parentTaskId];
      if (!parent) throw new Error("Parent task not found");
      hopDepth = parent.hopDepth + 1;
      if (hopDepth > MAX_TASK_DELEGATION_HOPS) {
        this.createEscalation(
          {
            kind: "loop_guard",
            title: `Vượt giới hạn phân rã công việc (${MAX_TASK_DELEGATION_HOPS} tầng)`,
            summaryLines: [
              `Công việc gốc: ${parent.title}`,
              `Độ sâu phân rã chạm ngưỡng ${hopDepth} — dừng tự động để tránh lặp vô hạn.`,
              "Cần Trưởng phòng kiểm tra và gộp lại đầu việc.",
            ],
            zone: parent.zone,
            relatedTaskId: parent.id,
          },
          actor,
        );
        throw new Error(`Delegation loop guard exceeded max depth (${MAX_TASK_DELEGATION_HOPS})`);
      }
    }
    const now = Date.now();
    const item: TeamWorkItem = {
      id: makeId("task"),
      title,
      description,
      zone: (input.zone ?? "all").trim() || "all",
      priority: input.priority ?? "normal",
      assignedBotId: input.assignedBotId.trim() || "bot-unassigned",
      assignedBotName: (input.assignedBotName ?? input.assignedBotId).trim() || "AI Agent",
      ...(input.leadBotId?.trim() ? { leadBotId: input.leadBotId.trim() } : {}),
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
      hopDepth,
      status: "in_progress",
      progressPct: 0,
      ...(typeof input.dueAt === "number" && Number.isFinite(input.dueAt) ? { dueAt: input.dueAt } : {}),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    this.state.workItems[item.id] = item;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.team_task_created", {
      taskId: item.id,
      title: item.title,
      zone: item.zone,
      assignedBotId: item.assignedBotId,
      leadBotId: item.leadBotId ?? null,
    });
    return structuredClone(item);
  }

  public delegateSubtasks(
    parentTaskId: string,
    subtasks: Array<{ title: string; description?: string; assignedBotId: string; assignedBotName?: string }>,
    actor = "lead-bot",
  ): TeamWorkItem[] {
    const parent = this.state.workItems[parentTaskId];
    if (!parent) throw new Error("Parent task not found");
    return subtasks.slice(0, 10).map((sub) =>
      this.createTask(
        {
          title: sub.title,
          description: sub.description,
          zone: parent.zone,
          priority: parent.priority,
          assignedBotId: sub.assignedBotId,
          assignedBotName: sub.assignedBotName,
          leadBotId: parent.leadBotId || parent.assignedBotId,
          parentTaskId: parent.id,
          dueAt: parent.dueAt,
        },
        actor,
      ),
    );
  }

  public updateTaskProgress(
    taskId: string,
    patch: { status?: WorkItemStatus; progressPct?: number; blockerReason?: string; deliverable?: string },
    actor = "bot",
  ): TeamWorkItem | null {
    const existing = this.state.workItems[taskId];
    if (!existing) return null;
    const now = Date.now();
    const nextStatus = patch.status ?? existing.status;
    const nextProgress =
      typeof patch.progressPct === "number" && Number.isFinite(patch.progressPct)
        ? Math.max(0, Math.min(100, Math.round(patch.progressPct)))
        : existing.progressPct;
    const updated: TeamWorkItem = {
      ...existing,
      status: nextStatus,
      progressPct: nextStatus === "completed" || nextStatus === "approved" ? 100 : nextProgress,
      ...(patch.blockerReason !== undefined
        ? { blockerReason: scrubTeamText(patch.blockerReason, actor).slice(0, 500) }
        : {}),
      ...(patch.deliverable !== undefined
        ? { deliverable: scrubTeamText(patch.deliverable, actor).slice(0, 3000) }
        : {}),
      updatedAt: now,
    };
    this.state.workItems[taskId] = updated;
    this.state.updatedAt = now;
    this.saveToDisk();

    if (nextStatus === "blocked") {
      this.createEscalation(
        {
          kind: "blocker",
          title: `Công việc bị kẹt: ${updated.title}`,
          summaryLines: [
            `Phụ trách: ${updated.assignedBotName} (${updated.zone})`,
            `Lý do: ${updated.blockerReason || "Chưa rõ nguyên nhân, cần con người tháo gỡ."}`,
            `Tiến độ hiện tại: ${updated.progressPct}%`,
          ],
          zone: updated.zone,
          relatedTaskId: updated.id,
        },
        actor,
      );
    } else if (nextStatus === "review_needed") {
      this.createEscalation(
        {
          kind: "approval_needed",
          title: `Chờ duyệt kết quả: ${updated.title}`,
          summaryLines: [
            `Thực hiện: ${updated.assignedBotName} (${updated.zone})`,
            `Kết quả tóm tắt: ${(updated.deliverable || "Đã hoàn thành đầu việc").slice(0, 160)}`,
            "Bấm [Duyệt] để hoàn tất hoặc [Giao lại] để yêu cầu chỉnh sửa.",
          ],
          zone: updated.zone,
          relatedTaskId: updated.id,
        },
        actor,
      );
    }
    return structuredClone(updated);
  }

  public reviewTeamTask(
    taskId: string,
    decision: "approved" | "rejected",
    notes: string,
    actor = "lead-or-manager",
  ): TeamWorkItem | null {
    const existing = this.state.workItems[taskId];
    if (!existing) return null;
    const now = Date.now();
    const updated: TeamWorkItem = {
      ...existing,
      status: decision === "approved" ? "completed" : "rejected",
      progressPct: decision === "approved" ? 100 : Math.min(existing.progressPct, 75),
      reviewedBy: actor,
      reviewNotes: scrubTeamText(notes, actor).slice(0, 1000),
      updatedAt: now,
    };
    this.state.workItems[taskId] = updated;
    // Auto-resolve matching open approval escalations
    for (const esc of Object.values(this.state.escalations)) {
      if (esc.relatedTaskId === taskId && esc.status === "open") {
        esc.status = decision === "approved" ? "approved" : "reassigned";
        esc.resolvedBy = actor;
        esc.resolvedAt = now;
        esc.resolutionNote = updated.reviewNotes;
      }
    }
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, `enterprise.team_task_${decision}`, {
      taskId,
      title: updated.title,
      notes: updated.reviewNotes ?? null,
    });
    return structuredClone(updated);
  }

  public getAwarenessSummaryForBot(botSection?: string): TeamWorkItem[] {
    return Object.values(this.state.workItems)
      .filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "approved" &&
          matchesZone(t.zone, botSection),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6);
  }

  // ── 2. Enterprise DAG Workflow Engine (Checkpointing + Loop Guard + Human Gate) ──

  public createDagWorkflow(
    input: {
      name: string;
      description?: string;
      scopeZone?: string;
      trigger?: "manual" | "schedule" | "event";
      maxHops?: number;
      budgetCapUsd?: number;
      steps: DagWorkflowStep[];
      publish?: boolean;
    },
    actor = "admin",
  ): DagWorkflowPackage {
    const name = scrubTeamText(input.name, actor).slice(0, 160);
    if (!name || !Array.isArray(input.steps) || input.steps.length === 0) {
      throw new Error("Workflow name and at least 1 step are required");
    }
    const now = Date.now();
    const pkg: DagWorkflowPackage = {
      id: makeId("dag"),
      name,
      description: scrubTeamText(input.description ?? "", actor).slice(0, 1000),
      scopeZone: (input.scopeZone ?? "all").trim() || "all",
      trigger: input.trigger ?? "manual",
      maxHops: Math.max(1, Math.min(30, input.maxHops ?? DEFAULT_DAG_MAX_HOPS)),
      budgetCapUsd: Math.max(0.1, Math.min(1000, input.budgetCapUsd ?? 10)),
      steps: input.steps.slice(0, 20).map((s, idx) => ({
        id: (s.id || `step-${idx + 1}`).trim(),
        title: scrubTeamText(s.title || `BÆ°á»›c ${idx + 1}`, actor).slice(0, 140),
        kind: (["agent_task", "condition", "human_approval", "notify"].includes(s.kind) ? s.kind : "agent_task") as DagStepKind,
        ...(s.assigneeBotId ? { assigneeBotId: s.assigneeBotId.trim() } : {}),
        ...(s.zone ? { zone: s.zone.trim() } : {}),
        ...(s.nextOnPass ? { nextOnPass: s.nextOnPass.trim() } : {}),
        ...(s.nextOnFail ? { nextOnFail: s.nextOnFail.trim() } : {}),
      })),
      status: input.publish ? "published" : "draft",
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    this.state.workflows[pkg.id] = pkg;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.dag_workflow_saved", {
      workflowId: pkg.id,
      name: pkg.name,
      steps: pkg.steps.length,
      status: pkg.status,
    });
    return structuredClone(pkg);
  }

  public startDagRun(workflowId: string, actor = "user"): DagRunInstance {
    const wf = this.state.workflows[workflowId];
    if (!wf) throw new Error("DAG workflow not found");
    const firstStep = wf.steps[0];
    if (!firstStep) throw new Error("DAG workflow has no steps");
    const now = Date.now();
    const run: DagRunInstance = {
      id: makeId("run"),
      workflowId: wf.id,
      workflowName: wf.name,
      scopeZone: wf.scopeZone,
      status: "running",
      currentStepId: firstStep.id,
      stepCheckpoints: {},
      hopCount: 0,
      spentUsd: 0,
      startedBy: actor,
      startedAt: now,
      updatedAt: now,
    };
    this.state.dagRuns[run.id] = run;
    this.saveToDisk();
    return this.advanceDagRun(run.id, "continue", actor, "Bắt đầu chạy DAG");
  }

  public advanceDagRun(
    runId: string,
    action: "continue" | "approve" | "reject",
    actor = "system",
    notes?: string,
  ): DagRunInstance {
    const run = this.state.dagRuns[runId];
    if (!run) throw new Error("DAG run not found");
    const wf = this.state.workflows[run.workflowId];
    if (!wf) throw new Error("Workflow definition missing");

    if (run.status === "completed" || run.status === "failed" || run.status === "budget_exceeded") {
      return structuredClone(run);
    }

    const now = Date.now();
    while (run.currentStepId) {
      const step = wf.steps.find((s) => s.id === run.currentStepId);
      if (!step) {
        run.status = "completed";
        run.currentStepId = null;
        break;
      }

      // Loop Guard
      if (run.hopCount >= wf.maxHops) {
        run.status = "failed";
        this.createEscalation(
          {
            kind: "loop_guard",
            title: `DAG Loop Guard: ${wf.name}`,
            summaryLines: [
              `Quy trình vượt ngưỡng ${wf.maxHops} bước (Hop limit).`,
              `Bước hiện tại: ${step.title}`,
              "Hệ thống tự động dừng để chống tiêu hao token.",
            ],
            zone: wf.scopeZone,
            relatedRunId: run.id,
          },
          actor,
        );
        break;
      }

      // Budget Cap Guard
      if (run.spentUsd >= wf.budgetCapUsd) {
        run.status = "budget_exceeded";
        break;
      }

      // Idempotent checkpoint: skip already completed step (still counts a hop to prevent cycle DoS)
      const existingCp = run.stepCheckpoints[step.id];
      if (existingCp?.status === "completed") {
        run.hopCount += 1;
        run.currentStepId = step.nextOnPass ?? this.findNextSequentialStepId(wf.steps, step.id);
        continue;
      }

      // Human Approval Gate
      if (step.kind === "human_approval") {
        if (action === "continue" && existingCp?.status !== "waiting_approval") {
          run.stepCheckpoints[step.id] = { status: "waiting_approval", actor };
          run.status = "waiting_approval";
          this.createEscalation(
            {
              kind: "approval_needed",
              title: `DAG Chờ duyệt: ${step.title}`,
              summaryLines: [
                `Quy trình: ${wf.name} (${wf.scopeZone})`,
                `Đang dừng tại cổng phê duyệt của con người.`,
                "Bấm [Duyệt] để chạy tiếp các bước còn lại.",
              ],
              zone: step.zone || wf.scopeZone,
              relatedRunId: run.id,
            },
            actor,
          );
          break;
        }
        if (action === "reject") {
          run.stepCheckpoints[step.id] = { status: "failed", output: notes || "Rejected by human", actor, completedAt: now };
          if (step.nextOnFail) {
            run.hopCount += 1;
            run.currentStepId = step.nextOnFail;
            action = "continue";
            continue;
          }
          run.status = "failed";
          run.currentStepId = null;
          break;
        }
        if (action !== "approve") {
          break;
        }
      }

      // Execute / checkpoint step
      run.hopCount += 1;
      run.spentUsd = Number((run.spentUsd + 0.02).toFixed(4));
      run.stepCheckpoints[step.id] = {
        status: "completed",
        output: scrubTeamText(notes || `Completed ${step.title}`, actor).slice(0, 500),
        actor,
        completedAt: now,
      };
      run.status = "running";
      action = "continue";
      run.currentStepId = step.nextOnPass ?? this.findNextSequentialStepId(wf.steps, step.id);
    }

    if (!run.currentStepId && run.status === "running") {
      run.status = "completed";
    }
    run.updatedAt = Date.now();
    this.state.dagRuns[run.id] = run;
    this.state.updatedAt = run.updatedAt;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.dag_run_progressed", {
      runId: run.id,
      workflowId: wf.id,
      status: run.status,
      hopCount: run.hopCount,
    });
    return structuredClone(run);
  }

  private findNextSequentialStepId(steps: DagWorkflowStep[], currentId: string): string | null {
    const idx = steps.findIndex((s) => s.id === currentId);
    if (idx < 0 || idx + 1 >= steps.length) return null;
    return steps[idx + 1]!.id;
  }

  // ── 3. Actionable Escalation Cards & Proactive Reminders ──

  public createEscalation(
    input: {
      kind: EscalationKind;
      title: string;
      summaryLines: string[];
      zone?: string;
      relatedTaskId?: string;
      relatedRunId?: string;
      assignedToEmail?: string;
    },
    actor = "system",
  ): ActionableEscalationCard {
    const dup = Object.values(this.state.escalations).find(
      (e) =>
        e.status === "open" &&
        e.kind === input.kind &&
        ((input.relatedTaskId && e.relatedTaskId === input.relatedTaskId) ||
          (input.relatedRunId && e.relatedRunId === input.relatedRunId)),
    );
    if (dup) return structuredClone(dup);

    const now = Date.now();
    const card: ActionableEscalationCard = {
      id: makeId("esc"),
      kind: input.kind,
      title: scrubTeamText(input.title, actor).slice(0, 180),
      summaryLines: input.summaryLines.slice(0, 3).map((l) => scrubTeamText(l, actor).slice(0, 220)),
      zone: (input.zone ?? "all").trim() || "all",
      ...(input.relatedTaskId ? { relatedTaskId: input.relatedTaskId } : {}),
      ...(input.relatedRunId ? { relatedRunId: input.relatedRunId } : {}),
      ...(input.assignedToEmail ? { assignedToEmail: input.assignedToEmail.trim().toLowerCase() } : {}),
      status: "open",
      createdBy: actor,
      createdAt: now,
    };
    this.state.escalations[card.id] = card;
    this.state.updatedAt = now;
    this.saveToDisk();
    return structuredClone(card);
  }

  public resolveEscalation(
    id: string,
    decision: "approved" | "reassigned" | "dismissed",
    actor = "manager",
    note?: string,
  ): ActionableEscalationCard | null {
    const card = this.state.escalations[id];
    if (!card) return null;
    const now = Date.now();
    card.status = decision;
    card.resolvedBy = actor;
    card.resolvedAt = now;
    if (note) card.resolutionNote = scrubTeamText(note, actor).slice(0, 500);

    if (card.relatedTaskId && this.state.workItems[card.relatedTaskId]) {
      if (decision === "approved") {
        this.reviewTeamTask(card.relatedTaskId, "approved", note || "Approved via Escalation Card", actor);
      } else if (decision === "reassigned") {
        this.reviewTeamTask(card.relatedTaskId, "rejected", note || "Reassigned via Escalation Card", actor);
      }
    }
    if (card.relatedRunId && this.state.dagRuns[card.relatedRunId]) {
      if (decision === "approved") {
        this.advanceDagRun(card.relatedRunId, "approve", actor, note);
      } else if (decision === "reassigned" || decision === "dismissed") {
        this.advanceDagRun(card.relatedRunId, "reject", actor, note);
      }
    }
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.escalation_resolved", {
      escalationId: id,
      decision,
    });
    return structuredClone(card);
  }

  public createReminder(
    input: {
      title: string;
      schedule?: ProactiveReminderRule["schedule"];
      targetZone?: string;
      targetChannel?: ProactiveReminderRule["targetChannel"];
    },
    actor = "admin",
  ): ProactiveReminderRule {
    const title = scrubTeamText(input.title, actor).slice(0, 180);
    if (!title) throw new Error("Reminder title is required");
    const now = Date.now();
    const rule: ProactiveReminderRule = {
      id: makeId("rem"),
      title,
      schedule: input.schedule ?? "daily_1700",
      targetZone: (input.targetZone ?? "all").trim() || "all",
      targetChannel: input.targetChannel ?? "dashboard",
      enabled: true,
      createdBy: actor,
      createdAt: now,
    };
    this.state.reminders[rule.id] = rule;
    this.state.updatedAt = now;
    this.saveToDisk();
    return structuredClone(rule);
  }

  public runProactiveSweep(actor = "scheduler"): {
    overdueCount: number;
    blockedCount: number;
    openEscalations: number;
    digestMarkdown: string;
  } {
    const now = Date.now();
    let overdueCount = 0;
    let blockedCount = 0;
    const allTasks = Object.values(this.state.workItems);
    for (const task of allTasks) {
      if (task.status === "completed" || task.status === "approved") continue;
      if (task.status === "blocked") blockedCount += 1;
      if (task.dueAt && task.dueAt < now) {
        overdueCount += 1;
        this.createEscalation(
          {
            kind: "deadline_overdue",
            title: `Quá hạn: ${task.title}`,
            summaryLines: [
              `Phụ trách: ${task.assignedBotName} (${task.zone})`,
              `Tiến độ: ${task.progressPct}% — đã quá hạn hoàn thành.`,
              "Cần đốc thúc hoặc điều phối lại nhân sự AI.",
            ],
            zone: task.zone,
            relatedTaskId: task.id,
          },
          actor,
        );
      }
    }
    for (const r of Object.values(this.state.reminders)) {
      if (r.enabled) r.lastTriggeredAt = now;
    }
    this.state.updatedAt = now;
    this.saveToDisk();

    const openEsc = Object.values(this.state.escalations).filter((e) => e.status === "open");
    const activeTasks = allTasks.filter((t) => t.status !== "completed" && t.status !== "approved");
    const digestMarkdown = [
      `# BÁO CÁO TIẾN ĐỘ ĐỘI NGŨ AI (${new Date(now).toISOString().slice(0, 10)})`,
      `- Tổng đầu việc đang mở: **${activeTasks.length}** (Quá hạn: **${overdueCount}**, Bị kẹt: **${blockedCount}**)`,
      `- Cảnh báo cần con người xử lý: **${openEsc.length}**`,
      ...(openEsc.slice(0, 5).map((e) => `  - [${e.kind}] ${e.title} (${e.zone})`)),
    ].join("\n");

    getWorkspaceAuditLedger().append("default", actor, "enterprise.proactive_sweep", {
      overdueCount,
      blockedCount,
      openEscalations: openEsc.length,
    });

    return { overdueCount, blockedCount, openEscalations: openEsc.length, digestMarkdown };
  }
}

let globalTeamOrchestrator: EnterpriseTeamOrchestrator | null = null;
export function getEnterpriseTeamOrchestrator(): EnterpriseTeamOrchestrator {
  if (!globalTeamOrchestrator) {
    globalTeamOrchestrator = new EnterpriseTeamOrchestrator();
  }
  return globalTeamOrchestrator;
}

export function resetEnterpriseTeamOrchestratorForTest(): void {
  globalTeamOrchestrator = null;
}
