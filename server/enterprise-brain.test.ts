import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseBrainStore, resetEnterpriseBrainStoreForTest } from "./enterprise-brain.ts";
import { autoProposeDecisionFromBotReply, buildEnterprisePromptSection } from "./enterprise-runtime-hooks.ts";

describe("Enterprise Phase 2 Brain: Decision Ledger, Knowledge Flywheel, Handover & Onboarding", () => {
  const dirs: string[] = [];
  afterEach(() => {
    resetEnterpriseBrainStoreForTest();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("enforces 2-stage promotion gate for Org Decisions and filters by Zone", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-brain-"));
    dirs.push(dir);
    const brain = new EnterpriseBrainStore(dir);

    const dec = brain.proposeDecision(
      { title: "Ngừng giảm giá quá 10%", summary: "Áp dụng từ tuần này cho toàn bộ đơn mới", scopeZone: "Zone 3" },
      "sales@company.vn",
    );
    expect(dec.status).toBe("proposed");
    expect(brain.getRelevantContextForBot("Zone 3").decisions).toHaveLength(0);

    brain.reviewDecision(dec.id, "approved", "ceo@company.vn");
    expect(brain.getRelevantContextForBot("Zone 3 - Kinh doanh").decisions).toHaveLength(1);
    expect(brain.getRelevantContextForBot("Zone 6 - Tài chính").decisions).toHaveLength(0);

    brain.reviewDecision(dec.id, "deprecated", "ceo@company.vn");
    expect(brain.getRelevantContextForBot("Zone 3").decisions).toHaveLength(0);
  });

  it("harvests work-context on employee offboarding and builds instant onboarding brief", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-handover-"));
    dirs.push(dir);
    const brain = new EnterpriseBrainStore(dir);

    brain.proposeDecision(
      { title: "Chuẩn phản hồi CSKH 15 phút", summary: "Ưu tiên xử lý qua Zalo trước", scopeZone: "all", autoApprove: true },
      "ceo@company.vn",
    );
    const pkg = brain.recordOffboardingHandover(
      {
        departedEmail: "an@company.vn",
        departedName: "An Nguyễn",
        zone: "Zone 5",
        successorEmail: "binh@company.vn",
        workSummary: "Quy trình xử lý khiếu nại đơn hàng trễ và danh sách VIP Q4.",
        preservedWorkNamespace: "work-context/an_company.vn",
        purgedPrivateNamespace: "private-personal/an_company.vn",
      },
      "admin@company.vn",
    );
    expect(pkg.extractedKnowledgeIds).toHaveLength(1);
    expect(pkg.successorEmail).toBe("binh@company.vn");

    const brief = brain.buildOnboardingBrief({ zone: "Zone 5", employeeEmail: "newbie@company.vn" });
    expect(brief.decisions.length).toBe(1);
    expect(brief.knowledge.length).toBe(1);
    expect(brief.handovers.length).toBe(1);
    expect(brief.markdown).toContain("Chuẩn phản hồi CSKH 15 phút");
    expect(brief.markdown).toContain("An Nguyễn");
  });

  it("extracts [DECISION_PROPOSE] tags from bot replies as proposed (never auto-approved)", () => {
    const res = autoProposeDecisionFromBotReply(
      'Đã chốt phương án. [DECISION_PROPOSE: title="Chốt nhà cung cấp A" summary="Ký hợp đồng thử nghiệm 3 tháng" zone="Zone 4"]',
      "Zone 4",
      "ops-bot",
      "msg-123",
    );
    expect(res.proposed).toBe(true);
    expect(res.title).toBe("Chốt nhà cung cấp A");

    const section = buildEnterprisePromptSection({ section: "Zone 4" });
    expect(section).toContain("ENTERPRISE OS RUNTIME CONTEXT");
  });
});
