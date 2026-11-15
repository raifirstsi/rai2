import { describe, it, expect } from "vitest";
import {
  evaluateMaturityScore,
  MATURITY_QUESTIONS,
} from "./ai-maturity";

describe("ai-maturity - 7-Zone Scoring & Tier Diagnostics", () => {
  it("has exactly 7 questions representing 7 Zones", () => {
    expect(MATURITY_QUESTIONS.length).toBe(7);
    const zones = MATURITY_QUESTIONS.map((q) => q.zoneNumber);
    expect(zones).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("classifies scores <= 7 as RETROFIT_TRAP", () => {
    const lowAnswers = {
      q1_strategy: 1,
      q2_marketing: 0,
      q3_sales: 1,
      q4_operations: 1,
      q5_care: 0,
      q6_finance: 1,
      q7_people: 0,
    };
    const res = evaluateMaturityScore(lowAnswers);
    expect(res.totalScore).toBe(4);
    expect(res.tier).toBe("RETROFIT_TRAP");
    expect(res.prescriptions.length).toBeGreaterThanOrEqual(3);
  });

  it("classifies scores 8-14 as POINT_SOLUTION", () => {
    const medAnswers = {
      q1_strategy: 2,
      q2_marketing: 1,
      q3_sales: 2,
      q4_operations: 2,
      q5_care: 1,
      q6_finance: 2,
      q7_people: 1,
    };
    const res = evaluateMaturityScore(medAnswers);
    expect(res.totalScore).toBe(11);
    expect(res.tier).toBe("POINT_SOLUTION");
  });

  it("classifies scores 15-21 as TRUE_AI_FIRST with 90-day roadmap", () => {
    const highAnswers = {
      q1_strategy: 3,
      q2_marketing: 3,
      q3_sales: 2,
      q4_operations: 3,
      q5_care: 2,
      q6_finance: 3,
      q7_people: 3,
    };
    const res = evaluateMaturityScore(highAnswers);
    expect(res.totalScore).toBe(19);
    expect(res.tier).toBe("TRUE_AI_FIRST");
    expect(res.ninetyDayRoadmapSpine.month1).toBeDefined();
    expect(res.ninetyDayRoadmapSpine.month2).toBeDefined();
    expect(res.ninetyDayRoadmapSpine.month3).toBeDefined();
  });
});
