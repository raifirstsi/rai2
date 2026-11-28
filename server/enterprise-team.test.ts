import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseTeamOrchestrator, resetEnterpriseTeamOrchestratorForTest } from "./enterprise-team.ts";

describe("Enterprise Phase 3: Team Orchestrator, DAG Engine & Proactive Escalations", () => {
  const dirs: string[] = [];
  afterEach(() => {
    resetEnterpriseTeamOrchestratorForTest();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("supports hierarchical delegation, review gate, and zone-isolated awareness", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-team-"));
    dirs.push(dir);
    const team = new EnterpriseTeamOrchestrator(dir);

    const parent = team.createTask(
      { title: "Chiến dịch Q4", assignedBotId: "bot-lead-3", assignedBotName: "Trưởng nhóm Kinh doanh", zone: "Zone 3", leadBotId: "bot-lead-3" },
      "ceo@co.vn",
    );
    const subs = team.delegateSubtasks(
      parent.id,
      [{ title: "Soạn kịch bản chốt đơn", assignedBotId: "bot-sales-1", assignedBotName: "Sales AI #1" }],
      "bot-lead-3",
    );
    expect(subs).toHaveLength(1);
    expect(subs[0]?.hopDepth).toBe(1);

    // Cross-bot awareness filters strictly by Zone (Zone 3 must not leak to Zone 10 or Zone 1)
    expect(team.getAwarenessSummaryForBot("Zone 3")).toHaveLength(2);
    expect(team.getAwarenessSummaryForBot("Zone 1")).toHaveLength(0);

    // Submit for review -> creates approval_needed escalation -> approve resolves both
    team.updateTaskProgress(subs[0]!.id, { status: "review_needed", progressPct: 95, deliverable: "Kịch bản 5 bước" }, "bot-sales-1");
    const openEsc = Object.values(team.getState().escalations).filter((e) => e.status === "open");
    expect(openEsc).toHaveLength(1);

    const reviewed = team.reviewTeamTask(subs[0]!.id, "approved", "Đạt chuẩn doanh nghiệp", "bot-lead-3");
    expect(reviewed?.status).toBe("completed");
    expect(Object.values(team.getState().escalations)[0]?.status).toBe("approved");
  });

  it("runs DAG workflow with human approval checkpoint and enforces loop guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-dag-"));
    dirs.push(dir);
    const team = new EnterpriseTeamOrchestrator(dir);

    const wf = team.createDagWorkflow(
      {
        name: "Phê duyệt báo giá lớn",
        scopeZone: "Zone 3",
        publish: true,
        steps: [
          { id: "s1", title: "Tính giá vốn & Margin", kind: "agent_task", assigneeBotId: "bot-fin" },
          { id: "s2", title: "Giám đốc duyệt ngoại lệ", kind: "human_approval" },
          { id: "s3", title: "Gửi báo giá cho khách", kind: "notify" },
        ],
      },
      "admin@co.vn",
    );

    const run = team.startDagRun(wf.id, "sales@co.vn");
    expect(run.status).toBe("waiting_approval");
    expect(run.stepCheckpoints["s1"]?.status).toBe("completed");
    expect(run.stepCheckpoints["s2"]?.status).toBe("waiting_approval");

    const esc = Object.values(team.getState().escalations).find((e) => e.relatedRunId === run.id);
    expect(esc?.status).toBe("open");

    const resolved = team.resolveEscalation(esc!.id, "approved", "ceo@co.vn", "Đồng ý ngoại lệ");
    expect(resolved?.status).toBe("approved");

    const after = team.getState().dagRuns[run.id];
    expect(after?.status).toBe("completed");
    expect(after?.stepCheckpoints["s3"]?.status).toBe("completed");
  });

  it("sweeps overdue tasks into proactive deadline_overdue escalations and digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-sweep-"));
    dirs.push(dir);
    const team = new EnterpriseTeamOrchestrator(dir);

    team.createTask(
      { title: "Gửi hợp đồng KH VIP", assignedBotId: "bot-legal", zone: "Zone 6", dueAt: Date.now() - 60_000 },
      "manager@co.vn",
    );
    team.createReminder({ title: "Nhắc việc 17:00 hàng ngày", targetZone: "Zone 6" }, "admin@co.vn");

    const sweep = team.runProactiveSweep("scheduler");
    expect(sweep.overdueCount).toBe(1);
    expect(sweep.openEscalations).toBe(1);
    expect(sweep.digestMarkdown).toContain("BÁO CÁO TIẾN ĐỘ ĐỘI NGŨ AI");
  });
  it("breaks DAG cycle infinite loops via hopCount loop guard and creates escalation", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-cycle-"));
    dirs.push(dir);
    const team = new EnterpriseTeamOrchestrator(dir);
    const wf = team.createDagWorkflow(
      {
        name: "DAG Cycle Test",
        scopeZone: "Zone 2",
        maxHops: 4,
        steps: [
          { id: "s1", title: "Step 1", kind: "agent_task", nextOnPass: "s2" },
          { id: "s2", title: "Step 2", kind: "agent_task", nextOnPass: "s1" },
        ],
      },
      "admin@co.vn",
    );
    const run = team.startDagRun(wf.id, "user@co.vn");
    expect(run.status).toBe("failed");
    expect(run.hopCount).toBe(4);
    const esc = Object.values(team.getState().escalations).find((e) => e.kind === "loop_guard");
    expect(esc?.status).toBe("open");
  });
});
