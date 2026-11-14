import { describe, it, expect } from "vitest";
import { StrategyMap7Zone } from "./StrategyMap7Zone";
import { evaluateStrategyMap7Zones } from "@/lib/strategy-map";

describe("StrategyMap7Zone - Component & Contract", () => {
  it("exports StrategyMap7Zone functional component", () => {
    expect(typeof StrategyMap7Zone).toBe("function");
  });

  it("calculates accurate summary for rendering", () => {
    const summary = evaluateStrategyMap7Zones({
      activeBotIds: ["rai-lead", "rai-quote", "rai-task"],
      tocDiagnosis: null,
    });

    expect(summary.zones).toHaveLength(7);
    expect(summary.healthyZonesCount).toBeGreaterThanOrEqual(3);
    expect(summary.overallCoverageScore).toBeGreaterThan(0);
  });
});
