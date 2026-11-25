/**
 * Test Suite cho Sprint 5
 * Business Pulse (17:00 Widget), TOC Bottlenecks, 90-Day Payback ROI & Exporting Engine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BusinessPulseEngine } from "./business-pulse.ts";
import { ExportingEngine } from "./exporting.ts";
import { PaybackRoiCalculator } from "./payback-roi.ts";

describe("Sprint 5: Business Pulse 17:00 & TOC Bottlenecks", () => {
  let pulseEngine: BusinessPulseEngine;

  beforeEach(() => {
    pulseEngine = new BusinessPulseEngine("/tmp/test-business-pulse.json");
    pulseEngine.clearWorkspaceData("test-ws");
  });

  it("tính toán chính xác doanh thu, giá vốn, lãi ròng và tỷ suất margin", () => {
    const today = new Date().toISOString().slice(0, 10);
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-001",
      revenue: 50_000_000,
      cost: 35_000_000,
      customerName: "Công ty ABC",
      timestamp: `${today}T10:00:00.000Z`,
      status: "approved",
    });

    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-002",
      revenue: 78_500_000,
      cost: 65_300_000,
      customerName: "Công ty XYZ",
      timestamp: `${today}T14:30:00.000Z`,
      status: "approved",
    });

    const pulse = pulseEngine.getDailyPulse("test-ws", today);
    expect(pulse.totalRevenue).toBe(128_500_000);
    expect(pulse.totalCost).toBe(100_300_000);
    expect(pulse.grossProfit).toBe(28_200_000);
    expect(pulse.netMarginPercent).toBe(21.9);
    expect(pulse.transactionCount).toBe(2);
    expect(pulse.formattedWidget.headline).toContain("128.5 tr");
    expect(pulse.formattedWidget.headline).toContain("28.2 tr");
  });

  it("nhận diện chuẩn xác các điểm nghẽn TOC (báo giá treo >2h, rò rỉ margin, giao trễ)", () => {
    const today = new Date().toISOString().slice(0, 10);
    // Điểm nghẽn 1: Báo giá chờ duyệt 3 tiếng
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-PENDING",
      revenue: 80_000_000,
      cost: 60_000_000,
      customerName: "Đối tác lớn",
      timestamp: `${today}T08:00:00.000Z`,
      status: "pending_approval",
      createdHoursAgo: 3,
    });

    // Điểm nghẽn 2: Margin mỏng 8% (<15%)
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-LOW-MARGIN",
      revenue: 100_000_000,
      cost: 92_000_000,
      customerName: "Khách lẻ",
      timestamp: `${today}T11:00:00.000Z`,
      status: "approved",
    });

    // Điểm nghẽn 3: Giao hàng trễ
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-DELAYED",
      revenue: 40_000_000,
      cost: 25_000_000,
      customerName: "Khách VIP",
      timestamp: `${today}T15:00:00.000Z`,
      status: "delayed",
    });

    const bottlenecks = pulseEngine.detectBottlenecks("test-ws", today);
    expect(bottlenecks.length).toBe(3);

    const quoteBn = bottlenecks.find(b => b.type === "unapproved_quote");
    expect(quoteBn).toBeDefined();
    expect(quoteBn?.severity).toBe("critical");
    expect(quoteBn?.title).toContain("ORD-PENDING");

    const marginBn = bottlenecks.find(b => b.type === "margin_leakage");
    expect(marginBn).toBeDefined();
    expect(marginBn?.severity).toBe("warning");
    expect(marginBn?.title).toContain("8.0%");

    const delayBn = bottlenecks.find(b => b.type === "delayed_fulfillment");
    expect(delayBn).toBeDefined();
    expect(delayBn?.severity).toBe("critical");

    const pulse = pulseEngine.getDailyPulse("test-ws", today);
    expect(pulse.healthStatus).toBe("critical_risk");
    expect(pulse.formattedWidget.headline).toContain("3 Điểm nghẽn");
  });
});

describe("Sprint 5: Exporting Engine & Merkle Audit Bundle", () => {
  const exporting = new ExportingEngine();

  it("sinh báo cáo P&L dạng CSV chuẩn kế toán đối soát", () => {
    const txList = [
      {
        id: "tx_01",
        workspaceId: "test-ws",
        orderCode: "ORD-SP88",
        revenue: 42_500_000,
        cost: 31_800_000,
        customerName: 'Đại lý "Toàn Cầu"',
        timestamp: "2026-11-25T10:00:00.000Z",
        status: "approved" as const,
      },
    ];

    const csv = exporting.generatePnlCsv(txList);
    expect(csv).toContain("STT,Mã đơn hàng,Khách hàng,Thời gian,Doanh thu (VND),Giá vốn (VND),Lợi nhuận (VND),Tỷ suất margin (%),Trạng thái");
    expect(csv).toContain('"ORD-SP88"');
    expect(csv).toContain('""Toàn Cầu""');
    expect(csv).toContain("42500000,31800000,10700000,25.2%");
  });

  it("đóng gói và xác thực Merkle Audit Bundle chống sửa đổi", () => {
    const dummyPulse = {
      workspaceId: "test-ws",
      date: "2026-11-25",
      pulseAt: new Date().toISOString(),
      totalRevenue: 50_000_000,
      totalCost: 35_000_000,
      grossProfit: 15_000_000,
      netMarginPercent: 30.0,
      transactionCount: 1,
      bottlenecks: [],
      healthStatus: "healthy" as const,
      formattedWidget: {
        revenueDisplay: "50 tr",
        profitDisplay: "15 tr",
        marginDisplay: "30.0%",
        bottleneckCount: 0,
        headline: "Healthy",
      },
    };

    const bundle = exporting.createAuditBundle("test-ws", [], dummyPulse, []);
    expect(bundle.bundleId).toBeDefined();
    expect(bundle.files.length).toBe(3);
    expect(bundle.merkleRootHash).toHaveLength(64);

    // Xác thực tính hợp lệ gói nguyên bản
    const verif = exporting.verifyAuditBundle(bundle);
    expect(verif.valid).toBe(true);

    // Giả mạo 1 ký tự trong file và kiểm tra phát hiện lỗi
    const tamperedBundle = JSON.parse(JSON.stringify(bundle));
    tamperedBundle.files[0].content += " "; // sửa 1 dấu cách
    const tamperedVerif = exporting.verifyAuditBundle(tamperedBundle);
    expect(tamperedVerif.valid).toBe(false);
    expect(tamperedVerif.reason).toContain("Sai lệch mã băm SHA-256");
  });
});

describe("Sprint 5: 90-Day Payback Period ROI Calculator", () => {
  const calc = new PaybackRoiCalculator();

  it("tính toán hoàn vốn chuẩn xác cho kịch bản doanh nghiệp vừa và nhỏ (Tier 2)", () => {
    const res = calc.calculate({
      totalInvestmentVnd: 50_000_000, // Đầu tư ban đầu 50 triệu
      monthlyAIOpexVnd: 2_000_000,
      hoursSavedPerDay: 4, // 4h x 65.000 = 260.000 đ/ngày
      hourlyLaborCostVnd: 65_000,
      incrementalMonthlyRevenueVnd: 30_000_000, // 30tr x 25% / 30 = 250.000 đ/ngày
      averageGrossMarginPercent: 25,
      leakagePreventionMonthlyVnd: 6_000_000, // 6tr / 30 = 200.000 đ/ngày
    });

    // Lợi ích ròng ngày = (260k + 250k + 200k) - (2tr / 30 = 66.666k) = ~643.333 đ/ngày
    // Số ngày hoàn vốn = 50.000.000 / 643.333 = ~77.7 ngày (< 90 ngày)
    expect(res.achieves90DayPayback).toBe(true);
    expect(res.paybackPeriodDays).toBeGreaterThan(60);
    expect(res.paybackPeriodDays).toBeLessThanOrEqual(90);
    expect(res.financialHealthTier).toBe("tier_2_viable");
    expect(res.ninetyDayProjection.netProfitAfterPaybackVnd).toBeGreaterThan(0);
    expect(res.ninetyDayProjection.roiPercent).toBeGreaterThan(0);
  });

  it("phân loại chuẩn mực Tier 1 cho dự án thu hồi vốn dưới 45 ngày", () => {
    const res = calc.calculate({
      totalInvestmentVnd: 30_000_000, // Đầu tư 30 triệu
      monthlyAIOpexVnd: 1_500_000,
      hoursSavedPerDay: 8, // 8h tiết kiệm = 640k/ngày
      hourlyLaborCostVnd: 80_000,
      incrementalMonthlyRevenueVnd: 60_000_000, // 60tr x 30% / 30 = 600k/ngày
      averageGrossMarginPercent: 30,
      leakagePreventionMonthlyVnd: 15_000_000, // 500k/ngày
    });

    expect(res.achieves90DayPayback).toBe(true);
    expect(res.paybackPeriodDays).toBeLessThanOrEqual(45);
    expect(res.financialHealthTier).toBe("tier_1_exceptional");
    expect(res.recommendations[0]).toContain("dưới 45 ngày");
  });

  it("cảnh báo Tier 3 khi thời gian hoàn vốn vượt quá 90 ngày", () => {
    const res = calc.calculate({
      totalInvestmentVnd: 200_000_000, // Đầu tư 200 triệu quá lớn
      monthlyAIOpexVnd: 5_000_000,
      hoursSavedPerDay: 1, // Tiết kiệm ít
      hourlyLaborCostVnd: 50_000,
      incrementalMonthlyRevenueVnd: 5_000_000,
      averageGrossMarginPercent: 15,
      leakagePreventionMonthlyVnd: 0,
    });

    expect(res.achieves90DayPayback).toBe(false);
    expect(res.paybackPeriodDays).toBeGreaterThan(90);
    expect(res.financialHealthTier).toBe("tier_3_high_risk");
    expect(res.recommendations[0]).toContain("CẢNH BÁO");
  });
});
