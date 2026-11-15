export type AutonomyTier = "TIER_1_APPRENTICE" | "TIER_2_COPILOT" | "TIER_3_AUTONOMOUS";

export interface AutonomyTierMeta {
  tier: AutonomyTier;
  code: string;
  name: string;
  autonomyPct: number;
  approvalMode: "ASK_FIRST_100_HITL" | "ASYNC_REVIEW_80" | "RANDOM_AUDIT_5";
  description: string;
  badgeLabel: string;
}

export const AUTONOMY_TIERS: Record<AutonomyTier, AutonomyTierMeta> = {
  TIER_1_APPRENTICE: {
    tier: "TIER_1_APPRENTICE",
    code: "T1",
    name: "Cấp 1: Tập Sự (Apprentice)",
    autonomyPct: 50,
    approvalMode: "ASK_FIRST_100_HITL",
    description: "100% đầu ra (báo giá, hợp đồng, email) phải có con người duyệt (HITL) trước khi gửi đi.",
    badgeLabel: "Tập Sự (50%)",
  },
  TIER_2_COPILOT: {
    tier: "TIER_2_COPILOT",
    code: "T2",
    name: "Cấp 2: Trợ Lý Đồng Hành (Co-Pilot)",
    autonomyPct: 80,
    approvalMode: "ASYNC_REVIEW_80",
    description: "Tự động gửi báo giá trong hạn mức cho phép. Chỉ hỏi khi phát sinh ngoại lệ hoặc vượt trần chiết khấu.",
    badgeLabel: "Đồng Hành (80%)",
  },
  TIER_3_AUTONOMOUS: {
    tier: "TIER_3_AUTONOMOUS",
    code: "T3",
    name: "Cấp 3: Tự Hành Hoàn Toàn (Autonomous 95%)",
    autonomyPct: 95,
    approvalMode: "RANDOM_AUDIT_5",
    description: "Tự hành 95% tác vụ. Con người chỉ kiểm toán ngẫu nhiên 5% mẫu kết quả định kỳ vào chiều Thứ Sáu.",
    badgeLabel: "Tự Hành 95%",
  },
};

export interface TaskAuditEntry {
  id: string;
  timestamp: string;
  taskTitle: string;
  status: "APPROVED" | "EDITED" | "REJECTED";
  feedback?: string;
}

export interface BotAutonomyProfile {
  botId: string;
  botName: string;
  departmentZone: number;
  currentTier: AutonomyTier;
  totalTasksProcessed: number;
  approvedCount: number;
  editedCount: number;
  rejectedCount: number;
  consecutiveCleanStreak: number; // approved without edit
  consecutiveRejections: number;
  graduationTargetStreak: number; // 50
  graduatedAt?: string;
  lastDowngradedAt?: string;
  history: TaskAuditEntry[];
}

export const DEFAULT_GRADUATION_TARGET = 50;

export function createDefaultBotProfile(botId: string, botName: string, zone = 1): BotAutonomyProfile {
  return {
    botId,
    botName,
    departmentZone: zone,
    currentTier: "TIER_1_APPRENTICE",
    totalTasksProcessed: 0,
    approvedCount: 0,
    editedCount: 0,
    rejectedCount: 0,
    consecutiveCleanStreak: 0,
    consecutiveRejections: 0,
    graduationTargetStreak: DEFAULT_GRADUATION_TARGET,
    history: [],
  };
}

export interface TaskOutcomeResult {
  updatedProfile: BotAutonomyProfile;
  promoted: boolean;
  downgraded: boolean;
  message: string;
}

export function recordTaskOutcome(
  profile: BotAutonomyProfile,
  outcome: "APPROVED" | "EDITED" | "REJECTED",
  taskTitle: string,
  feedback?: string
): TaskOutcomeResult {
  const next: BotAutonomyProfile = {
    ...profile,
    history: [
      {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        taskTitle,
        status: outcome,
        feedback,
      },
      ...profile.history.slice(0, 49), // Keep latest 50 logs
    ],
    totalTasksProcessed: profile.totalTasksProcessed + 1,
  };

  let promoted = false;
  let downgraded = false;
  let message = "";

  if (outcome === "APPROVED") {
    next.approvedCount += 1;
    next.consecutiveCleanStreak += 1;
    next.consecutiveRejections = 0;

    // Promotion check: 50 clean tasks
    if (next.currentTier === "TIER_1_APPRENTICE" && next.consecutiveCleanStreak >= next.graduationTargetStreak) {
      next.currentTier = "TIER_2_COPILOT";
      next.consecutiveCleanStreak = 0;
      promoted = true;
      message = `🎉 Chúc mừng! Bot ${next.botName} đã tốt nghiệp lên Cấp 2: Trợ Lý Đồng Hành (80% tự trị) nhờ chuỗi 50 tác vụ sạch lỗi!`;
    } else if (next.currentTier === "TIER_2_COPILOT" && next.consecutiveCleanStreak >= next.graduationTargetStreak) {
      next.currentTier = "TIER_3_AUTONOMOUS";
      next.consecutiveCleanStreak = 0;
      next.graduatedAt = new Date().toISOString();
      promoted = true;
      message = `🏆 XUẤT SẮC! Bot ${next.botName} đã chính thức TỐT NGHIỆP CẤP 3: TỰ HÀNH HOÀN TOÀN 95%!`;
    } else {
      message = `Đã duyệt thành công. Chuỗi sạch lỗi hiện tại: ${next.consecutiveCleanStreak}/${next.graduationTargetStreak}.`;
    }
  } else if (outcome === "EDITED") {
    next.editedCount += 1;
    next.consecutiveCleanStreak = 0; // reset streak on manual edits
    next.consecutiveRejections = 0;
    message = `Đã lưu chỉnh sửa của con người. Chuỗi sạch lỗi reset về 0/${next.graduationTargetStreak}.`;
  } else if (outcome === "REJECTED") {
    next.rejectedCount += 1;
    next.consecutiveCleanStreak = 0;
    next.consecutiveRejections += 1;

    // Downgrade circuit breaker: 2 consecutive rejections
    if (next.consecutiveRejections >= 2 && next.currentTier !== "TIER_1_APPRENTICE") {
      next.currentTier = "TIER_1_APPRENTICE";
      next.consecutiveRejections = 0;
      next.lastDowngradedAt = new Date().toISOString();
      downgraded = true;
      message = `🛑 CẦU DAO HẠ HẠNG KÍCH HOẠT: Bot ${next.botName} bị từ chối 2 lần liên tiếp. Đã tự động giáng cấp về Cấp 1: Tập Sự (100% duyệt) để bảo vệ uy tín công ty!`;
    } else {
      message = `Tác vụ bị bác bỏ. Cảnh báo lỗi: ${next.consecutiveRejections}/2 trước khi kích hoạt cầu dao giáng cấp.`;
    }
  }

  return {
    updatedProfile: next,
    promoted,
    downgraded,
    message,
  };
}

export function calculateHumanInterventionRatio(profile: BotAutonomyProfile): number {
  if (profile.totalTasksProcessed === 0) return 0;
  const humanActions = profile.editedCount + profile.rejectedCount;
  return Math.round((humanActions / profile.totalTasksProcessed) * 100);
}

const STORAGE_KEY_AUTONOMY = "rai2_autonomy_profiles";

export function loadSavedAutonomyProfiles(): Record<string, BotAutonomyProfile> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_AUTONOMY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveAutonomyProfiles(profiles: Record<string, BotAutonomyProfile>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_AUTONOMY, JSON.stringify(profiles));
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("rai2:autonomy-updated"));
    }
  } catch (e) {
    console.warn("Could not save autonomy profiles:", e);
  }
}

export function getBotAutonomyTier(botId: string): AutonomyTierMeta {
  const profiles = loadSavedAutonomyProfiles();
  const profile = profiles[botId];
  const tierKey = profile?.currentTier ?? "TIER_1_APPRENTICE";
  return AUTONOMY_TIERS[tierKey] ?? AUTONOMY_TIERS.TIER_1_APPRENTICE;
}
