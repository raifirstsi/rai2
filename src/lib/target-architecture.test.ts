import { describe, it, expect } from "vitest";
import {
  analyzeArchitectureDistribution,
  detectWorkflowProblem,
  DEFAULT_PRESET_TASKS,
  ArchitectureTask,
} from "./target-architecture";

describe("target-architecture - Logic & Distribution Analysis", () => {
  it("analyzes default preset tasks with balanced ratio", () => {
    const summary = analyzeArchitectureDistribution(DEFAULT_PRESET_TASKS);
    expect(summary.totalCount).toBe(8);
    expect(summary.keepCount).toBeGreaterThanOrEqual(1);
    expect(summary.eliminateCount).toBeGreaterThanOrEqual(1);
    expect(summary.redesignCount).toBeGreaterThanOrEqual(1);
    expect(summary.keepRatio + summary.eliminateRatio + summary.redesignRatio).toBeCloseTo(100, 0);
  });

  it("detects workflow problem when copy-paste or repetitive reminders are mentioned", () => {
    const warningCopy = detectWorkflowProblem("Em cần bot copy paste dữ liệu từ Excel sang CRM");
    expect(warningCopy).toContain("quy trình tiếp nhận");

    const warningRemind = detectWorkflowProblem("Cần bot nhắc nhở nhân viên nộp báo cáo hàng tuần");
    expect(warningRemind).toContain("SOP");

    const cleanTask = detectWorkflowProblem("Soạn thảo bản tin khách hàng VIP hàng tháng");
    expect(cleanTask).toBeNull();
  });

  it("warns if no tasks are eliminated (Retrofit Trap)", () => {
    const biasedTasks: ArchitectureTask[] = [
      { id: "1", name: "Sale", category: "keep", departmentZone: 3 },
      { id: "2", name: "Marketing", category: "redesign", departmentZone: 2 },
    ];
    const summary = analyzeArchitectureDistribution(biasedTasks);
    expect(summary.isHealthyDistribution).toBe(false);
    expect(summary.warnings.some((w) => w.includes("xóa bỏ"))).toBe(true);
  });
});
