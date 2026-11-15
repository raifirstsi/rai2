import { describe, it, expect } from "vitest";
import {
  createDefaultBotProfile,
  recordTaskOutcome,
  calculateHumanInterventionRatio,
  AUTONOMY_TIERS,
} from "./autonomy-graduation";

describe("autonomy-graduation - Tier Progression & Downgrade Circuit Breaker", () => {
  it("initializes default profile at Tier 1 (Apprentice)", () => {
    const profile = createDefaultBotProfile("bot-closer", "RAI Closer", 3);
    expect(profile.currentTier).toBe("TIER_1_APPRENTICE");
    expect(profile.consecutiveCleanStreak).toBe(0);
    expect(AUTONOMY_TIERS[profile.currentTier].autonomyPct).toBe(50);
  });

  it("advances clean streak on APPROVED and promotes to Tier 2 after 50 tasks", () => {
    let profile = createDefaultBotProfile("bot-closer", "RAI Closer", 3);
    profile.consecutiveCleanStreak = 49;

    const result = recordTaskOutcome(profile, "APPROVED", "Báo giá thiết bị 50tr");
    expect(result.promoted).toBe(true);
    expect(result.updatedProfile.currentTier).toBe("TIER_2_COPILOT");
    expect(result.updatedProfile.consecutiveCleanStreak).toBe(0);
  });

  it("resets clean streak when human makes edits (EDITED)", () => {
    let profile = createDefaultBotProfile("bot-closer", "RAI Closer", 3);
    profile.consecutiveCleanStreak = 25;

    const result = recordTaskOutcome(profile, "EDITED", "Sửa đổi điều khoản thanh toán");
    expect(result.updatedProfile.consecutiveCleanStreak).toBe(0);
    expect(result.updatedProfile.editedCount).toBe(1);
    expect(result.promoted).toBe(false);
  });

  it("triggers Downgrade Circuit-Breaker on 2 consecutive rejections", () => {
    let profile = createDefaultBotProfile("bot-closer", "RAI Closer", 3);
    profile.currentTier = "TIER_3_AUTONOMOUS";

    // 1st rejection
    const r1 = recordTaskOutcome(profile, "REJECTED", "Báo giá sai quy chuẩn giá sàn");
    expect(r1.downgraded).toBe(false);
    expect(r1.updatedProfile.consecutiveRejections).toBe(1);

    // 2nd consecutive rejection
    const r2 = recordTaskOutcome(r1.updatedProfile, "REJECTED", "Gửi nhầm email đối tác");
    expect(r2.downgraded).toBe(true);
    expect(r2.updatedProfile.currentTier).toBe("TIER_1_APPRENTICE");
    expect(r2.updatedProfile.lastDowngradedAt).toBeDefined();
  });

  it("computes human intervention ratio accurately", () => {
    let profile = createDefaultBotProfile("bot-closer", "RAI Closer", 3);
    profile.totalTasksProcessed = 10;
    profile.approvedCount = 7;
    profile.editedCount = 2;
    profile.rejectedCount = 1;

    const ratio = calculateHumanInterventionRatio(profile);
    expect(ratio).toBe(30); // (2 + 1) / 10 = 30%
  });
});
