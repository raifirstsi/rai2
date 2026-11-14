import { describe, it, expect, beforeEach } from "vitest";
import {
  computeFiveLeversCompounding,
  formatVndCurrency,
  formatFiveLeversPlanMarkdown,
  DEFAULT_FIVE_LEVERS_INPUT,
  LEVER_PRESETS,
  loadSavedFiveLeversInput,
  saveFiveLeversInput,
} from "./five-levers";

describe("five-levers - 5-Lever P&L Compounding Engine", () => {
  beforeEach(() => {
    // In-memory mock for localStorage
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    if (typeof globalThis.window === "undefined") {
      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };
    } else {
      Object.defineProperty(globalThis.window, "localStorage", {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it("calculates baseline revenue and compounding profit for 10% balanced improvements", () => {
    const result = computeFiveLeversCompounding(
      DEFAULT_FIVE_LEVERS_INPUT,
      LEVER_PRESETS.BALANCED_10.improvements
    );

    // Revenue: (1.1)^4 = 1.4641 (+46.4% in annual volume and frequency)
    expect(result.baseline.annualRevenue).toBeGreaterThan(0);
    expect(result.projected.annualRevenue).toBeGreaterThan(result.baseline.annualRevenue);
    expect(result.growth.revenueMultiplier).toBeGreaterThan(1.4);

    // Gross profit compounding: (1.1)^5 = 1.6105 (+61.05%)
    expect(result.growth.grossProfitMultiplier).toBeCloseTo(1.61, 1);
    expect(result.growth.extraAnnualGrossProfit).toBeGreaterThan(0);

    // Net profit compounds even faster due to fixed OPEX
    expect(result.growth.netProfitMultiplier).toBeGreaterThan(result.growth.grossProfitMultiplier);
  });

  it("assigns lever ownership to the corresponding departments and agents", () => {
    const result = computeFiveLeversCompounding(
      DEFAULT_FIVE_LEVERS_INPUT,
      LEVER_PRESETS.BALANCED_10.improvements
    );

    expect(result.leverOwnership).toHaveLength(5);

    const leadsLever = result.leverOwnership.find((l) => l.leverKey === "leads");
    expect(leadsLever?.zone).toBe(2);
    expect(leadsLever?.recommendedAgentKey).toBe("rai-lead");

    const crLever = result.leverOwnership.find((l) => l.leverKey === "conversionRate");
    expect(crLever?.zone).toBe(3);
    expect(crLever?.recommendedAgentKey).toBe("rai-close");

    const aovLever = result.leverOwnership.find((l) => l.leverKey === "averageOrderValue");
    expect(aovLever?.zone).toBe(3);
    expect(aovLever?.recommendedAgentKey).toBe("rai-quote");

    const fLever = result.leverOwnership.find((l) => l.leverKey === "purchaseFrequency");
    expect(fLever?.zone).toBe(5);
    expect(fLever?.recommendedAgentKey).toBe("rai-care");

    const marginLever = result.leverOwnership.find((l) => l.leverKey === "grossMargin");
    expect(marginLever?.zone).toBe(6);
    expect(marginLever?.recommendedAgentKey).toBe("rai-audit");
  });

  it("formats Vietnamese currency correctly for billions, millions and thousands", () => {
    expect(formatVndCurrency(2500000000)).toBe("2.5 tỷ VNĐ");
    expect(formatVndCurrency(45000000)).toBe("45 triệu VNĐ");
    expect(formatVndCurrency(12500000)).toBe("12.5 triệu VNĐ");
  });

  it("formats 5-lever plan markdown with executive summary and playbooks", () => {
    const result = computeFiveLeversCompounding(
      DEFAULT_FIVE_LEVERS_INPUT,
      LEVER_PRESETS.BALANCED_10.improvements
    );
    const md = formatFiveLeversPlanMarkdown(result);

    expect(md).toContain("BẢN KẾ HOẠCH TĂNG TRƯỞNG KÉP 5 ĐÒN BẨY P&L");
    expect(md).toContain("rai-lead");
    expect(md).toContain("rai-quote");
    expect(md).toContain("NGUYÊN TẮC THỰC THI 90 NGÀY");
  });

  it("persists and loads customized five levers input from storage", () => {
    const custom = {
      ...DEFAULT_FIVE_LEVERS_INPUT,
      monthlyLeads: 250,
      averageOrderValue: 50000000,
    };
    saveFiveLeversInput(custom);

    const loaded = loadSavedFiveLeversInput();
    expect(loaded.monthlyLeads).toBe(250);
    expect(loaded.averageOrderValue).toBe(50000000);
  });
});
