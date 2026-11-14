import { describe, it, expect } from "vitest";
import { computeFridayPulseReport, formatFridayPulseMarkdown } from "./friday-pulse";
import type { TocDiagnosisResult } from "./toc-detector";

describe("friday-pulse - Friday 17:00 Pulse & Dynamic Absence Readiness", () => {
  const mockToc: TocDiagnosisResult = {
    constraintType: "DELIVERY_BOTTLENECK",
    primaryZone: "ZONE_4_OPERATIONS",
    zoneNumber: 4,
    departmentName: "Phòng Thực Thi & Vận Hành",
    recommendedAgentKey: "rai-task",
    urgencyLevel: "CRITICAL",
    title: "Công suất xưởng quá tải",
    description: "Không thể nhận thêm đơn",
    symptomExplanation: "Thợ làm tăng ca trễ hẹn",
    upstreamBlockWarning: "Khóa van bán hàng ngay lập tức!",
    levers: {
      lever1MarketingLeadGrowth: 10,
      lever2TurnaroundCompressionRatio: 40,
      lever3ErrorReductionCost: 25000000,
      lever4MarginExpansion: 35,
      lever5ReinvestmentPool: 10000000,
      projectedMonthlyRevenue: 300000000,
      projectedNetMargin: 35,
      projectedMonthlyProfit: 105000000,
    },
  };

  it("computes Friday pulse report with single priority pointing to TOC bottleneck", () => {
    const report = computeFridayPulseReport({
      activeBotIds: ["rai-lead", "rai-quote"],
      tocDiagnosis: mockToc,
      backlogCount: 2,
    });

    expect(report.absenceReadinessScore).toBeGreaterThan(0);
    expect(report.absenceReadinessScore).toBeLessThanOrEqual(100);
    expect(report.singlePriorityForNextWeek).toContain("Công suất xưởng quá tải");
    expect(report.actionItems.some((a) => a.includes("Khóa van bán hàng"))).toBe(true);
    expect(report.metrics.backlogOver48hCount).toBe(2);
  });

  it("advances absence readiness level to Level 3 when fully staffed and zero backlog", () => {
    const allBots = [
      "rai-strategy",
      "rai-lead",
      "rai-copy",
      "rai-quote",
      "rai-close",
      "rai-task",
      "rai-qc",
      "rai-care",
      "rai-review",
      "rai-margin",
      "rai-cash",
      "rai-coach",
      "rai-talent",
    ];

    const report = computeFridayPulseReport({
      activeBotIds: allBots,
      tocDiagnosis: null,
      backlogCount: 0,
      customMarginScore: 42,
    });

    expect(report.absenceReadinessScore).toBeGreaterThanOrEqual(80);
    expect(report.absenceLevel.levelNumber).toBe(3);
    expect(report.absenceLevel.title).toContain("Sẵn Sàng Vắng Mặt 14 Ngày");
  });

  it("formats Friday pulse into clear Markdown report with all sections", () => {
    const report = computeFridayPulseReport({
      activeBotIds: ["rai-lead"],
      tocDiagnosis: null,
      backlogCount: 1,
    });
    const md = formatFridayPulseMarkdown(report);

    expect(md).toContain("BÁO CÁO NHỊP THỞ THỨ SÁU 17:00");
    expect(md).toContain("Thước Đo Sẵn Sàng Vắng Mặt ($ARI$)");
    expect(md).toContain("MỤC TIÊU ƯU TIÊN DUY NHẤT TUẦN TỚI");
    expect(md).toContain("Chỉ Số Vận Hành Cốt Lõi");
  });
});
