import { describe, it, expect } from "vitest";
import { evaluateStrategyMap7Zones } from "./strategy-map";
import type { TocDiagnosisResult } from "./toc-detector";

describe("strategy-map - 7-Zone Interactive Strategy Map Evaluation", () => {
  it("evaluates all 7 enterprise departments", () => {
    const summary = evaluateStrategyMap7Zones({
      activeBotIds: ["rai-lead", "rai-quote", "rai-task"],
      tocDiagnosis: null,
    });

    expect(summary.zones).toHaveLength(7);
    expect(summary.overallCoverageScore).toBeGreaterThan(0);
    expect(summary.primaryBottleneckZone).toBeNull();
  });

  it("identifies TOC constraint zone and flags it with CRITICAL_TOC status", () => {
    const mockDiagnosis: TocDiagnosisResult = {
      constraintType: "SALES_QUOTING_BOTTLENECK",
      primaryZone: "ZONE_3_SALES",
      zoneNumber: 3,
      departmentName: "Phòng Kinh Doanh & Chốt Hợp Đồng",
      recommendedAgentKey: "rai-quote",
      urgencyLevel: "CRITICAL",
      title: "Báo giá chậm khiến mất khách",
      description: "Thời gian gửi báo giá kéo dài",
      symptomExplanation: "Khách bỏ đi sang đối thủ",
      upstreamBlockWarning: "Khóa van tiếp thị: Không tăng chi phí quảng cáo!",
      levers: {
        lever1MarketingLeadGrowth: 20,
        lever2TurnaroundCompressionRatio: 50,
        lever3ErrorReductionCost: 20000000,
        lever4MarginExpansion: 35,
        lever5ReinvestmentPool: 10000000,
        projectedMonthlyRevenue: 300000000,
        projectedNetMargin: 35,
        projectedMonthlyProfit: 105000000,
      },
    };

    const summary = evaluateStrategyMap7Zones({
      activeBotIds: ["rai-lead"],
      tocDiagnosis: mockDiagnosis,
    });

    expect(summary.primaryBottleneckZone).toBe(3);
    const zone3 = summary.zones.find((z) => z.zoneNumber === 3);
    expect(zone3).toBeDefined();
    expect(zone3?.status).toBe("CRITICAL_TOC");
    expect(zone3?.isConstraintZone).toBe(true);
    expect(zone3?.urgencyWarning).toContain("ĐIỂM NGHẼN CỐT TỬ");
  });

  it("flags zones with 0 active agents as WARNING", () => {
    const summary = evaluateStrategyMap7Zones({
      activeBotIds: ["rai-lead"], // Only Zone 2 active
      tocDiagnosis: null,
    });

    const unstaffedZones = summary.zones.filter((z) => z.activeAgentsCount === 0);
    expect(unstaffedZones.length).toBeGreaterThan(0);
    for (const z of unstaffedZones) {
      expect(z.status).toBe("WARNING");
    }
  });

  it("matches bots by human names, titles or role tokens in addition to strict keys", () => {
    const summary = evaluateStrategyMap7Zones({
      activeBotIds: ["RAI Lead", "RAI Quote", "b_8f92_rai-task"],
      tocDiagnosis: null,
    });

    const zone2 = summary.zones.find((z) => z.zoneNumber === 2);
    const zone3 = summary.zones.find((z) => z.zoneNumber === 3);
    const zone4 = summary.zones.find((z) => z.zoneNumber === 4);

    expect(zone2?.activeAgentsCount).toBeGreaterThan(0);
    expect(zone3?.activeAgentsCount).toBeGreaterThan(0);
    expect(zone4?.activeAgentsCount).toBeGreaterThan(0);
  });
});
