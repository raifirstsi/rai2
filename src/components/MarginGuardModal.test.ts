import { describe, it, expect } from "vitest";
import { MarginGuardModal } from "./MarginGuardModal";
import { evaluateMarginQuote } from "@/lib/margin-guard";

describe("MarginGuardModal - Component & Contract", () => {
  it("exports MarginGuardModal functional component", () => {
    expect(typeof MarginGuardModal).toBe("function");
  });

  it("calculates healthy margin and recommends min price accurately", () => {
    const input = {
      proposedPrice: 120_000_000,
      directCosts: 70_000_000,
      minMarginThresholdPct: 35,
    };
    const evalResult = evaluateMarginQuote(input);

    expect(evalResult.status).toBe("APPROVED");
    expect(evalResult.grossMarginPct).toBe(41.7);
    expect(evalResult.escalationRequired).toBe(false);
  });

  it("blocks dangerous margin and computes recommended minimum price for recovery", () => {
    const input = {
      proposedPrice: 100_000_000,
      directCosts: 80_000_000, // 20% margin
      minMarginThresholdPct: 35,
    };
    const evalResult = evaluateMarginQuote(input);

    expect(evalResult.status).toBe("BLOCKED");
    expect(evalResult.escalationRequired).toBe(true);
    // Cost 80M / (1 - 0.35) = 123,076,923
    expect(evalResult.recommendedMinPrice).toBe(123_076_923);
  });
});
