import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeFridayPulseReport,
  formatFridayPulseMarkdown,
  getFridayPulseWebhookUrl,
  saveFridayPulseWebhookUrl,
  sendFridayPulseWebhook,
  isFridayPulseDue,
  markFridayPulseReviewed,
} from "./friday-pulse";
import type { TocDiagnosisResult } from "./toc-detector";

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

vi.stubGlobal("localStorage", storage);
if (typeof window !== "undefined") {
  (window as unknown as { localStorage: typeof storage }).localStorage = storage;
}

describe("friday-pulse - Friday 17:00 Pulse & Dynamic Absence Readiness", () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

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

  it("saves and retrieves webhook URL correctly", () => {
    expect(getFridayPulseWebhookUrl()).toBe("");
    saveFridayPulseWebhookUrl("https://chat.zalo.me/api/webhook/12345");
    expect(getFridayPulseWebhookUrl()).toBe("https://chat.zalo.me/api/webhook/12345");
  });

  it("sends Friday pulse webhook payload successfully", async () => {
    const report = computeFridayPulseReport({
      activeBotIds: ["rai-lead"],
      backlogCount: 0,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendFridayPulseWebhook("https://hooks.zalo.me/pulse", report);
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://hooks.zalo.me/pulse");
    const sentBody = JSON.parse(callArgs[1].body);
    expect(sentBody.event).toBe("friday_pulse");
    expect(sentBody.text).toContain("BÁO CÁO NHỊP THỞ THỨ SÁU 17:00");
  });

  it("sends Telegram formatted payload when URL points to telegram API", async () => {
    const report = computeFridayPulseReport({
      activeBotIds: ["rai-lead"],
      backlogCount: 0,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendFridayPulseWebhook(
      "https://api.telegram.org/bot12345/sendMessage?chat_id=98765",
      report
    );
    expect(result.ok).toBe(true);
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.chat_id).toBe("98765");
    expect(sentBody.parse_mode).toBe("Markdown");
  });

  it("evaluates isFridayPulseDue correctly based on day, time, and reviewed state", () => {
    // Wednesday 10:00 -> false
    const wednesday = new Date(2026, 10, 11, 10, 0, 0); // 11 Nov 2026 is Wed
    expect(isFridayPulseDue(wednesday)).toBe(false);

    // Friday 14:00 -> false
    const fridayEarly = new Date(2026, 10, 13, 14, 0, 0);
    expect(isFridayPulseDue(fridayEarly)).toBe(false);

    // Friday 17:30 -> true (unreviewed)
    const fridayLate = new Date(2026, 10, 13, 17, 30, 0);
    expect(isFridayPulseDue(fridayLate)).toBe(true);

    // After marking reviewed for that week -> false
    markFridayPulseReviewed();
    expect(isFridayPulseDue(fridayLate)).toBe(false);
  });
});
