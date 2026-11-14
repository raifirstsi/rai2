import { describe, it, expect } from "vitest";
import {
  evaluateMarginQuote,
  extractQuoteMetricsFromText,
  formatMarginGuardReport,
  parseNumberWithUnits,
} from "./margin-guard";

describe("margin-guard - P&L Protection & Margin Threshold Auditor", () => {
  it("approves healthy quote with gross margin >= 35%", () => {
    const evaluation = evaluateMarginQuote({
      proposedPrice: 100_000_000,
      directCosts: 60_000_000,
      minMarginThresholdPct: 35,
    });

    expect(evaluation.status).toBe("APPROVED");
    expect(evaluation.grossMarginPct).toBe(40);
    expect(evaluation.grossMarginAmount).toBe(40_000_000);
    expect(evaluation.escalationRequired).toBe(false);
    expect(evaluation.potentialNetProfitEstimate).toBeGreaterThan(0);
  });

  it("blocks quote when gross margin is between 20% and 35%", () => {
    const evaluation = evaluateMarginQuote({
      proposedPrice: 100_000_000,
      directCosts: 75_000_000, // 25% margin
      minMarginThresholdPct: 35,
    });

    expect(evaluation.status).toBe("BLOCKED");
    expect(evaluation.grossMarginPct).toBe(25);
    expect(evaluation.escalationRequired).toBe(true);
    expect(evaluation.reason).toContain("vi phạm cam kết bảo vệ P&L");
    // Recommended price for 35% margin with 75M cost is ~115,384,615
    expect(evaluation.recommendedMinPrice).toBeGreaterThan(115_000_000);
  });

  it("raises CRITICAL_DANGER alarm when gross margin drops below 20%", () => {
    const evaluation = evaluateMarginQuote({
      proposedPrice: 100_000_000,
      directCosts: 88_000_000, // 12% margin
      minMarginThresholdPct: 35,
    });

    expect(evaluation.status).toBe("CRITICAL_DANGER");
    expect(evaluation.grossMarginPct).toBe(12);
    expect(evaluation.badgeText).toContain("BÁO ĐỘNG ĐỎ");
    expect(evaluation.escalationRequired).toBe(true);
    expect(evaluation.reason).toContain("nguy cơ lỗ ròng");
  });

  it("handles invalid inputs like zero price or negative costs", () => {
    const evalZero = evaluateMarginQuote({
      proposedPrice: 0,
      directCosts: 10_000_000,
    });
    expect(evalZero.status).toBe("INVALID");
    expect(evalZero.escalationRequired).toBe(true);

    const evalNegative = evaluateMarginQuote({
      proposedPrice: 50_000_000,
      directCosts: -1,
    });
    expect(evalNegative.status).toBe("INVALID");
  });

  it("parses currency strings with Vietnamese units (triệu, tr, k)", () => {
    expect(parseNumberWithUnits("50 triệu")).toBe(50_000_000);
    expect(parseNumberWithUnits("12.5 tr")).toBe(12_500_000);
    expect(parseNumberWithUnits("500k")).toBe(500_000);
    expect(parseNumberWithUnits("20000000")).toBe(20_000_000);
  });

  it("extracts price and costs from conversational text", () => {
    const text = "Dự toán sơ bộ cho dự án: Báo giá 80 triệu, Chi phí vốn trực tiếp 45 triệu.";
    const { proposedPrice, directCosts } = extractQuoteMetricsFromText(text);

    expect(proposedPrice).toBe(80_000_000);
    expect(directCosts).toBe(45_000_000);

    const evaluation = evaluateMarginQuote({
      proposedPrice: proposedPrice!,
      directCosts: directCosts!,
      minMarginThresholdPct: 35,
    });
    expect(evaluation.grossMarginPct).toBe(43.8);
    expect(evaluation.status).toBe("APPROVED");
  });

  it("formats audit report cleanly in markdown with warning or approval badge", () => {
    const blockedEval = evaluateMarginQuote({
      proposedPrice: 50_000_000,
      directCosts: 38_000_000, // 24% margin
    });
    const report = formatMarginGuardReport(blockedEval);

    expect(report).toContain("MARGIN GUARD AUDIT");
    expect(report).toContain("CHẶN XUẤT BÁO GIÁ");
    expect(report).toContain("24%");
    expect(report).toContain("Khuyến nghị giá sàn an toàn");
    expect(report).toContain("HITL Escalation");
  });
});
