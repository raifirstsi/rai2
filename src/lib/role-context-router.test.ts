import { describe, it, expect } from "vitest";
import {
  buildBotMemoryBundle,
  resolveBotContextAllocation,
  mergeMemoryWithCustomNotes,
  RAI2_DEPARTMENT_ZONES,
} from "./role-context-router";
import type { ContextPillarId } from "./context-vault";
import type { TocDiagnosisResult } from "./toc-detector";

describe("role-context-router - Role-Based Context Allocation & Injection", () => {
  const mockVaultContents: Record<ContextPillarId, string> = {
    brand_voice: "Tôn chỉ: Thực chiến, súc tích, câu 12-18 từ.",
    customer_avatar: "Chủ doanh nghiệp SME 5-20 nhân sự, MeOS trap.",
    offer_breakdown: "Hệ điều hành RAI2 First OS, biên lợi nhuận >= 35%.",
    competitive_positioning: "Định vị dẫn đầu về kiến trúc Retrofit AI.",
    sales_process: "Quy trình 5 bước tư vấn và chốt lịch demo.",
    case_studies: "Ca thành công xưởng nội thất tăng 45% doanh số.",
    sops: "SOP chuẩn hóa 7 bước tiếp nhận và xử lý khiếu nại.",
    industry_context: "Thị trường SME Việt Nam 2026 chuyển dịch số mạnh mẽ.",
  };

  const mockTocDiagnosis: TocDiagnosisResult = {
    constraintType: "SALES_QUOTING_BOTTLENECK",
    primaryZone: "ZONE_3_SALES",
    zoneNumber: 3,
    departmentName: "Phòng Bán Hàng & Chốt Hợp Đồng",
    recommendedAgentKey: "rai-closer",
    urgencyLevel: "CRITICAL",
    title: "Điểm Nghẽn Tắc Nghẽn Phản Hồi Báo Giá Chậm",
    description: "Thời gian gửi báo giá kéo dài làm mất 30% khách hàng tiềm năng.",
    symptomExplanation: "Báo giá chậm > 3 ngày khiến khách hàng sang đối thủ.",
    upstreamBlockWarning: "Khóa van tiếp thị: Không tăng ngân sách quảng cáo khi chưa xử lý báo giá!",
    levers: {
      lever1MarketingLeadGrowth: 25,
      lever2TurnaroundCompressionRatio: 50,
      lever3ErrorReductionCost: 35000000,
      lever4MarginExpansion: 35,
      lever5ReinvestmentPool: 15000000,
      projectedMonthlyRevenue: 450000000,
      projectedNetMargin: 35,
      projectedMonthlyProfit: 157500000,
    },
  };

  it("allocates brand voice and marketing pillars to rai-lead while omitting sensitive internal SOPs", () => {
    const bundle = buildBotMemoryBundle("rai-lead", mockVaultContents, mockTocDiagnosis);

    // Should include Marketing context
    expect(bundle["memory/brand_voice.md"]).toBeDefined();
    expect(bundle["memory/brand_voice.md"]).toContain("Tôn chỉ: Thực chiến");
    expect(bundle["memory/customer_avatar.md"]).toBeDefined();
    expect(bundle["memory/offer_breakdown.md"]).toBeDefined();

    // Should NOT leak internal execution SOPs or HR/Financial records
    expect(bundle["memory/standard_operating_procedures.md"]).toBeUndefined();
    expect(bundle["memory/industry_context.md"]).toBeUndefined();

    // Should include basic TOC warning
    expect(bundle["memory/business_toc.md"]).toBeDefined();
    expect(bundle["memory/business_toc.md"]).toContain("CẢNH BÁO KHÓA VAN");
  });

  it("allocates operational SOPs and TOC Levers to rai-coach (Operations)", () => {
    const bundle = buildBotMemoryBundle("rai-coach", mockVaultContents, mockTocDiagnosis);

    expect(bundle["memory/brand_voice.md"]).toBeDefined();
    expect(bundle["memory/standard_operating_procedures.md"]).toBeDefined();
    expect(bundle["memory/standard_operating_procedures.md"]).toContain("SOP chuẩn hóa 7 bước");

    // Coach does not need ad positioning or sales objection handling
    expect(bundle["memory/positioning.md"]).toBeUndefined();
    expect(bundle["memory/sales_process.md"]).toBeUndefined();

    // Coach gets full 5 Levers for operational compression
    expect(bundle["memory/business_toc.md"]).toContain("5 Đòn Bẩy P&L Cần Hướng Tới");
    expect(bundle["memory/business_toc.md"]).toContain("L2 (Nén thời gian phản hồi): +50%");
  });

  it("allocates full 8-pillar context to rai-strategy (Executive Overseer)", () => {
    const bundle = buildBotMemoryBundle("rai-strategy", mockVaultContents, mockTocDiagnosis);

    expect(Object.keys(bundle).length).toBe(9); // 8 pillars + 1 business_toc.md
    expect(bundle["memory/brand_voice.md"]).toBeDefined();
    expect(bundle["memory/customer_avatar.md"]).toBeDefined();
    expect(bundle["memory/offer_breakdown.md"]).toBeDefined();
    expect(bundle["memory/positioning.md"]).toBeDefined();
    expect(bundle["memory/sales_process.md"]).toBeDefined();
    expect(bundle["memory/case_studies.md"]).toBeDefined();
    expect(bundle["memory/standard_operating_procedures.md"]).toBeDefined();
    expect(bundle["memory/industry_context.md"]).toBeDefined();
    expect(bundle["memory/business_toc.md"]).toBeDefined();
  });

  it("only provides brand_voice to fallback/unknown bots to prevent token waste", () => {
    const bundle = buildBotMemoryBundle("unknown-custom-bot", mockVaultContents, mockTocDiagnosis);

    expect(Object.keys(bundle).length).toBe(1);
    expect(bundle["memory/brand_voice.md"]).toBeDefined();
    expect(bundle["memory/business_toc.md"]).toBeUndefined();
  });

  it("resolves business department zone names to correct context allocations", () => {
    // Custom bot with Section "Phòng Marketing & Thu Hút Lead"
    const marketingAlloc = resolveBotContextAllocation("Phòng Marketing & Thu Hút Lead");
    expect(marketingAlloc.pillars).toEqual(["brand_voice", "customer_avatar", "offer_breakdown"]);

    // Custom bot with Section "Phòng Kinh Doanh & Chốt Hợp Đồng"
    const salesAlloc = resolveBotContextAllocation("Phòng Kinh Doanh & Chốt Hợp Đồng");
    expect(salesAlloc.pillars).toContain("sales_process");
    expect(salesAlloc.pillars).toContain("case_studies");

    // Custom bot with Section "Phòng Thực Thi & Giám Sát Vận Hành"
    const opsAlloc = resolveBotContextAllocation("Phòng Thực Thi & Giám Sát Vận Hành");
    expect(opsAlloc.pillars).toContain("sops");

    // Verify 7 zones are defined
    expect(RAI2_DEPARTMENT_ZONES.length).toBe(7);
  });

  it("merges company standard knowledge with custom user notes without losing user data", () => {
    const originalCompanyText = "# 1. Brand Voice DNA\n\nTôn chỉ: Thực chiến, súc tích.";
    const userModifiedText = `${originalCompanyText}\n\n--- GHI CHÚ RIÊNG CỦA NHÂN SỰ ---\nQuy định riêng: Luôn xưng hô Em - Anh/Chị với khách VIP.`;

    const updatedCompanyText = "# 1. Brand Voice DNA v2\n\nTôn chỉ: Thực chiến, súc tích, câu 12-18 từ.";

    const merged = mergeMemoryWithCustomNotes(userModifiedText, updatedCompanyText);

    // Must contain updated company text
    expect(merged).toContain("Brand Voice DNA v2");
    expect(merged).toContain("câu 12-18 từ");

    // Must preserve user's custom additions
    expect(merged).toContain("--- GHI CHÚ RIÊNG CỦA NHÂN SỰ ---");
    expect(merged).toContain("Luôn xưng hô Em - Anh/Chị với khách VIP.");
  });
});

