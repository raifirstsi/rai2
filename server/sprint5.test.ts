/**
 * Test Suite cho Sprint 5 (Hardened Edition)
 * Business Pulse (17:00 Widget), TOC Bottlenecks, 90-Day Payback ROI & Exporting Engine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BusinessPulseEngine, getVietnamDateString } from "./business-pulse.ts";
import { AutonomousPulseScheduler, format0830MorningReport, format17PmZaloReport } from "./pulse-scheduler.ts";
import { ExportingEngine, sanitizeCsvField } from "./exporting.ts";
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
    expect(pulse.formattedWidget.headline).toContain("🟢 Lãi ròng: 28.2 tr");
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

  it("tự động phát hiện báo giá treo > 2h dựa trên timestamp mà không cần createdHoursAgo", () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    pulseEngine.recordTransaction({
      workspaceId: "test-ws-dynamic",
      orderCode: "ORD-AUTO-PENDING",
      revenue: 55_000_000,
      cost: 40_000_000,
      customerName: "Khách hàng chờ duyệt giá",
      timestamp: fourHoursAgo,
      status: "pending_approval",
      // Không truyền createdHoursAgo
    });

    const bottlenecks = pulseEngine.detectBottlenecks("test-ws-dynamic");
    const quoteBn = bottlenecks.find(b => b.orderCode === "ORD-AUTO-PENDING");
    expect(quoteBn).toBeDefined();
    expect(quoteBn?.type).toBe("unapproved_quote");
    expect(quoteBn?.severity).toBe("critical");
  });

  it("hiển thị chính xác trạng thái Lỗ ròng 🔴 và format tiền tệ âm", () => {
    const today = new Date().toISOString().slice(0, 10);
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-LOSS",
      revenue: 20_000_000,
      cost: 35_000_000, // chi phí lớn hơn doanh thu
      status: "approved",
      timestamp: `${today}T12:00:00.000Z`,
    });

    const pulse = pulseEngine.getDailyPulse("test-ws", today);
    expect(pulse.grossProfit).toBe(-15_000_000);
    expect(pulse.healthStatus).toBe("critical_risk");
    expect(pulse.formattedWidget.headline).toContain("🔴 Lỗ ròng: -15.0 tr");
    expect(pulse.formattedWidget.profitDisplay).toBe("-15.0 tr");
  });

  it("kích hoạt và lưu snapshot chốt sổ 17:00 chiều", () => {
    const today = new Date().toISOString().slice(0, 10);
    pulseEngine.recordTransaction({
      workspaceId: "test-ws",
      orderCode: "ORD-SNAPSHOT",
      revenue: 10_000_000,
      cost: 7_000_000,
      status: "approved",
      timestamp: `${today}T16:55:00.000Z`,
    });

    const snap = pulseEngine.trigger17PmPulse("test-ws", today);
    expect(snap.is17PmSnapshot).toBe(true);

    const savedSnap = pulseEngine.get17PmSnapshot("test-ws", today);
    expect(savedSnap).not.toBeNull();
    expect(savedSnap?.totalRevenue).toBe(10_000_000);
    expect(savedSnap?.is17PmSnapshot).toBe(true);
  });

  it("chuyển đổi chuẩn xác múi giờ Việt Nam UTC+7", () => {
    const vnStr = getVietnamDateString(new Date());
    expect(vnStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Sprint 5: Exporting Engine & Merkle Audit Bundle", () => {
  const exporting = new ExportingEngine();

  it("phòng chống lỗ hổng CSV Formula Injection (CWE-1236)", () => {
    expect(sanitizeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvField("+84901234567")).toBe("'+84901234567");
    expect(sanitizeCsvField("-100")).toBe("'-100");
    expect(sanitizeCsvField("@malicious_cmd")).toBe("'@malicious_cmd");
    expect(sanitizeCsvField('Bình thường "VIP"')).toBe('Bình thường ""VIP""');

    const maliciousTx = [
      {
        id: "tx_mal",
        workspaceId: "test-ws",
        orderCode: "=cmd|' /C calc'!A0",
        revenue: 10_000_000,
        cost: 5_000_000,
        customerName: "+Tập đoàn tấn công",
        timestamp: "2026-11-25T10:00:00.000Z",
        status: "approved" as const,
      },
    ];

    const csv = exporting.generatePnlCsv(maliciousTx);
    expect(csv).toContain('"\'=cmd|\' /C calc\'!A0"');
    expect(csv).toContain('"\'+Tập đoàn tấn công"');
  });

  it("khử triệt để CSV Formula Injection khi có khoảng trắng dẫn đầu và ký tự null", () => {
    const maliciousTx: TransactionRecord[] = [
      {
        id: "tx_mal2",
        workspaceId: "test-ws",
        orderCode: "   =2+5",
        revenue: 10_000_000,
        cost: 5_000_000,
        customerName: "\0@admin_leak",
        timestamp: "2026-11-25T10:00:00.000Z",
        status: "approved" as const,
      },
    ];

    const csv = exporting.generatePnlCsv(maliciousTx);
    expect(csv).toContain('"\'   =2+5"');
    expect(csv).toContain('"\'@admin_leak"');
    expect(csv).not.toContain("\0");
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

    const verif = exporting.verifyAuditBundle(bundle);
    expect(verif.valid).toBe(true);

    const tamperedBundle = JSON.parse(JSON.stringify(bundle));
    tamperedBundle.files[0].content += " ";
    const tamperedVerif = exporting.verifyAuditBundle(tamperedBundle);
    expect(tamperedVerif.valid).toBe(false);
    expect(tamperedVerif.reason).toContain("Sai lệch mã băm SHA-256");
  });
});

describe("Sprint 5: 90-Day Payback Period ROI Calculator", () => {
  const calc = new PaybackRoiCalculator();

  it("tính toán hoàn vốn chuẩn xác cho kịch bản doanh nghiệp vừa và nhỏ (Tier 2)", () => {
    const res = calc.calculate({
      totalInvestmentVnd: 50_000_000,
      monthlyAIOpexVnd: 2_000_000,
      hoursSavedPerDay: 4,
      hourlyLaborCostVnd: 65_000,
      incrementalMonthlyRevenueVnd: 30_000_000,
      averageGrossMarginPercent: 25,
      leakagePreventionMonthlyVnd: 6_000_000,
    });

    expect(res.achieves90DayPayback).toBe(true);
    expect(res.paybackPeriodDays).toBeGreaterThan(60);
    expect(res.paybackPeriodDays).toBeLessThanOrEqual(90);
    expect(res.financialHealthTier).toBe("tier_2_viable");
    expect(res.isCashflowNegative).toBe(false);
  });

  it("cảnh báo chuyên sâu khi dòng tiền thuần âm (Daily Net Cashflow Negative)", () => {
    const res = calc.calculate({
      totalInvestmentVnd: 50_000_000,
      monthlyAIOpexVnd: 15_000_000, // Chi phí vận hành AI quá đắt 15tr/tháng = 500k/ngày
      hoursSavedPerDay: 1, // Tiết kiệm chỉ 65k/ngày
      hourlyLaborCostVnd: 65_000,
      incrementalMonthlyRevenueVnd: 0,
      averageGrossMarginPercent: 20,
      leakagePreventionMonthlyVnd: 0,
    });

    expect(res.isCashflowNegative).toBe(true);
    expect(res.achieves90DayPayback).toBe(false);
    expect(res.financialHealthTier).toBe("tier_3_high_risk");
    expect(res.recommendations[0]).toContain("CẢNH BÁO NGUY CƠ DÒNG TIỀN");
    expect(res.recommendations[1]).toContain("tối ưu hóa chi phí token/hạ tầng");
  });
});

describe("Sprint 5 Step 2: Autonomous 17:00 Pulse Scheduler & Zalo Report", () => {
  it("tự động chốt sổ đúng 17:00 UTC+7 và không lặp lại trong cùng ngày", async () => {
    const tmpPulsePath = `/tmp/test-pulse-sched-${Date.now()}.json`;
    const engine = new BusinessPulseEngine(tmpPulsePath);
    const vnToday = getVietnamDateString(new Date("2026-11-26T10:05:00.000Z")); // 17:05 giờ VN
    engine.recordTransaction({
      workspaceId: "default",
      orderCode: "ORD-SCHED-01",
      revenue: 90_000_000,
      cost: 60_000_000,
      timestamp: "2026-11-26T04:00:00.000Z", // 11:00 giờ VN cùng ngày
      status: "approved",
    });

    const sentPayloads: Array<{ toId: string; text: string }> = [];
    const scheduler = new AutonomousPulseScheduler({
      engine,
      configPath: `/tmp/test-sched-cfg-${Date.now()}.json`,
      sendZalo: async (p) => {
        sentPayloads.push({ toId: p.toId, text: p.text });
        return { ok: true };
      },
    });
    scheduler.updateConfig({ zaloToId: "9115796562660233836", enabled: true });

    // Trước 17:00 VN (09:59 UTC = 16:59 VN) -> chưa chạy
    const early = await scheduler.tick(new Date("2026-11-26T09:59:00.000Z"));
    expect(early).toBeNull();
    expect(sentPayloads.length).toBe(0);

    // Đúng 17:05 VN (10:05 UTC) -> tự động chốt sổ và gửi Zalo
    const triggered = await scheduler.tick(new Date("2026-11-26T10:05:00.000Z"));
    expect(triggered).not.toBeNull();
    expect(triggered?.length).toBeGreaterThanOrEqual(1);
    expect(sentPayloads.length).toBe(1);
    expect(sentPayloads[0].text).toContain(`17:00 (${vnToday})`);
    expect(sentPayloads[0].text).toContain("90.0 tr");

    // Gọi lại trong cùng ngày -> idempotent, không gửi trùng
    const second = await scheduler.tick(new Date("2026-11-26T10:15:00.000Z"));
    expect(second).toBeNull();
    expect(sentPayloads.length).toBe(1);

    const formatted = format17PmZaloReport(triggered![0].snapshot);
    expect(formatted).toContain("BÁO CÁO NHỊP THỞ KINH DOANH 17:00");
  });

  it("enforces admin RBAC scope on scheduler configuration route", async () => {
    const { createSprint5Routes } = await import("./routes/sprint5-routes.ts");
    const handler = createSprint5Routes();
    let status = 0;
    let body: unknown = null;
    await handler({
      req: {} as any,
      res: {} as any,
      url: new URL("http://localhost/api/pulse/scheduler/config"),
      path: "/api/pulse/scheduler/config",
      method: "POST",
      auth: { kind: "loopback", scopes: ["client"], trust: "service" },
      json: (_res, code, payload) => {
        status = code;
        body = payload;
      },
      readBody: async () => ({ enabled: false }),
    });
    expect(status).toBe(403);
    expect((body as { error: string }).error).toContain("admin scope required");
  });

  it("tự động phát Bản tin sáng 08:30 UTC+7 (Morning Briefing) một lần mỗi sáng", async () => {
    const engine = new BusinessPulseEngine(`/tmp/test-morn-${Date.now()}.json`);
    const sent: string[] = [];
    const scheduler = new AutonomousPulseScheduler({
      engine,
      configPath: `/tmp/test-morn-cfg-${Date.now()}.json`,
      sendZalo: async (p) => {
        sent.push(p.text);
        return { ok: true };
      },
    });
    scheduler.updateConfig({ zaloToId: "owner_zalo", enabled: true });

    // 08:35 VN (01:35 UTC) -> triggers morning briefing once
    const morning = await scheduler.tick(new Date("2026-11-26T01:35:00.000Z"));
    expect(morning).not.toBeNull();
    expect(sent.length).toBe(1);
    expect(sent[0]).toContain("BẢN TIN SÁNG 08:30");

    // 09:00 VN (02:00 UTC) -> idempotent
    const second = await scheduler.tick(new Date("2026-11-26T02:00:00.000Z"));
    expect(second).toBeNull();
    expect(sent.length).toBe(1);

    const txt = format0830MorningReport("default", "2026-11-26", engine.getDailyPulse("default", "2026-11-26"));
    expect(txt).toContain("Mục tiêu hôm nay");
  });
});
