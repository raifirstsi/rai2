import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseBrainStore, matchesZone, resetEnterpriseBrainStoreForTest } from "./enterprise-brain.ts";
import { autoProposeDecisionFromBotReply, autoProposeKnowledgeFromBotReply, buildEnterprisePromptSection, stripEnterpriseControlTags } from "./enterprise-runtime-hooks.ts";

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
    const rolledBack = brain.reviewDecision(dec.id, "deprecated", "founder@company.vn");
    expect(rolledBack?.deprecatedBy).toBe("founder@company.vn");

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
    expect(brief.knowledge[0]?.usageCount).toBe(1);
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

  it("prevents Zone 1 from leaking into Zone 10 and enforces ABAC scoped state", () => {
    expect(matchesZone("Zone 1", "Zone 10")).toBe(false);
    expect(matchesZone("Zone 10", "Zone 1")).toBe(false);
    expect(matchesZone("Zone 3", "Zone 3 - Sales")).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), "rai2-brain-"));
    dirs.push(dir);
    const store = new EnterpriseBrainStore(dir);
    store.proposeDecision({ title: "Quyết định Zone 1", summary: "Nội bộ Zone 1", scopeZone: "Zone 1", autoApprove: true }, "admin");
    store.proposeDecision({ title: "Quyết định Zone 10", summary: "Nội bộ Zone 10", scopeZone: "Zone 10", autoApprove: true }, "admin");
    const scoped = store.getScopedState({ isAdmin: false, employeeZone: "Zone 10", employeeEmail: "staff10@co.vn" });
    const titles = Object.values(scoped.decisions).map((d) => d.title);
    expect(titles).toContain("Quyết định Zone 10");
    expect(titles).not.toContain("Quyết định Zone 1");
  });

  it("scrubs secrets via DLP before persisting, auto-proposes knowledge, and deduplicates", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-brain-"));
    dirs.push(dir);
    const store = new EnterpriseBrainStore(dir);
    const k = store.proposeKnowledge(
      { title: "SOP Key Test", content: "Dùng key sk-1234567890abcdef1234567890abcdef để gọi API", scopeZone: "Zone 2", sourceRef: "msg-1" },
      "staff@co.vn",
    );
    expect(k.content).not.toContain("sk-1234567890abcdef1234567890abcdef");
    const dup = store.proposeKnowledge(
      { title: "SOP Key Test", content: "Bản lặp lại", scopeZone: "Zone 2", sourceRef: "msg-1" },
      "staff@co.vn",
    );
    expect(dup.id).toBe(k.id);

    process.env.RAI2_DATA_DIR = dir;
    resetEnterpriseBrainStoreForTest();
    const autoK = autoProposeKnowledgeFromBotReply(
      'Tuyệt vời! [KNOWLEDGE_PROPOSE: title="Quy trình CSKH 5 bước" kind="sop" content="Bước 1 chào hỏi, bước 2 xác nhận nhu cầu." zone="Zone 3"]',
      "Zone 3",
      "bot-cs",
      "msg-k-1",
    );
    expect(autoK.proposed).toBe(true);
    expect(autoK.title).toBe("Quy trình CSKH 5 bước");
    expect(stripEnterpriseControlTags('OK [KNOWLEDGE_PROPOSE: title="ABC" kind="sop" content="XYZ"]')).toBe("OK");
    // multi-tag strip check
    expect(stripEnterpriseControlTags('Chốt xong [PULSE_RECORD: orderId=D1 revenue=1000 cost=500] và [KNOWLEDGE_PROPOSE: title="Quy trình 1" content="Nội dung 1"] [KNOWLEDGE_PROPOSE: title="Quy trình 2" content="Nội dung 2"]')).toBe("Chốt xong  và");
  });
});
