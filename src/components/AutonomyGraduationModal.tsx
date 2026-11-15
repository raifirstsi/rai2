import { useState, useMemo, useId, useEffect } from "react";
import {
  X,
  GraduationCap,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useStore } from "@/state/store";
import {
  AUTONOMY_TIERS,
  createDefaultBotProfile,
  recordTaskOutcome,
  calculateHumanInterventionRatio,
  loadSavedAutonomyProfiles,
  saveAutonomyProfiles,
  BotAutonomyProfile,
  AutonomyTier,
} from "@/lib/autonomy-graduation";
import { isEnterpriseBot } from "@/lib/rai2-departments";
import { cn } from "@/lib/cn";

export interface AutonomyGraduationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBotId?: string;
}

export function AutonomyGraduationModal({
  isOpen,
  onClose,
  initialBotId,
}: AutonomyGraduationModalProps) {
  const dialogTitleId = useId();
  const { state } = useStore();

  const [profiles, setProfiles] = useState<Record<string, BotAutonomyProfile>>(() =>
    loadSavedAutonomyProfiles()
  );
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [taskNameInput, setTaskNameInput] = useState<string>("Báo giá hợp đồng mẫu cho khách hàng");

  // Filter enterprise bots or all active bots
  const enterpriseBots = useMemo(() => {
    return (state.bots || []).filter(isEnterpriseBot);
  }, [state.bots]);

  useEffect(() => {
    if (isOpen) {
      const saved = loadSavedAutonomyProfiles();
      const updated = { ...saved };
      // Ensure all enterprise bots have a profile
      for (const bot of enterpriseBots) {
        if (!updated[bot.id]) {
          updated[bot.id] = createDefaultBotProfile(bot.id, bot.name, bot.zone ?? 1);
        }
      }
      setProfiles(updated);
      saveAutonomyProfiles(updated);

      if (initialBotId) {
        if (!updated[initialBotId]) {
          const found = (state.bots || []).find((b) => b.id === initialBotId);
          if (found) {
            updated[found.id] = createDefaultBotProfile(found.id, found.name, found.zone ?? 1);
          }
        }
        setSelectedBotId(initialBotId);
      } else if (enterpriseBots.length > 0) {
        setSelectedBotId(enterpriseBots[0].id);
      }
    }
  }, [isOpen, initialBotId, enterpriseBots]);

  const currentProfile: BotAutonomyProfile | undefined = useMemo(() => {
    return profiles[selectedBotId] || (enterpriseBots.length > 0 ? profiles[enterpriseBots[0].id] : undefined);
  }, [profiles, selectedBotId, enterpriseBots]);

  if (!isOpen) return null;

  const currentTierMeta = currentProfile ? AUTONOMY_TIERS[currentProfile.currentTier] : AUTONOMY_TIERS.TIER_1_APPRENTICE;
  const humanRatio = currentProfile ? calculateHumanInterventionRatio(currentProfile) : 0;
  const streakPct = currentProfile
    ? Math.min(100, Math.round((currentProfile.consecutiveCleanStreak / currentProfile.graduationTargetStreak) * 100))
    : 0;

  const handleSimulateOutcome = (outcome: "APPROVED" | "EDITED" | "REJECTED") => {
    if (!currentProfile) return;
    const result = recordTaskOutcome(
      currentProfile,
      outcome,
      taskNameInput.trim() || "Tác vụ nghiệp vụ thực tế",
      outcome === "REJECTED" ? "Sai chính sách giá sàn" : undefined
    );

    const updatedMap = {
      ...profiles,
      [currentProfile.botId]: result.updatedProfile,
    };
    setProfiles(updatedMap);
    saveAutonomyProfiles(updatedMap);
    setActionNotice(result.message);
  };

  const handleManualSetTier = (tier: AutonomyTier) => {
    if (!currentProfile) return;
    const updated: BotAutonomyProfile = {
      ...currentProfile,
      currentTier: tier,
      consecutiveCleanStreak: 0,
      consecutiveRejections: 0,
    };
    const updatedMap = {
      ...profiles,
      [currentProfile.botId]: updated,
    };
    setProfiles(updatedMap);
    saveAutonomyProfiles(updatedMap);
    setActionNotice(`Đã chuyển bot ${updated.botName} sang ${AUTONOMY_TIERS[tier].name}.`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-4xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <GraduationCap size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={dialogTitleId} className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Cổng Tốt Nghiệp Tự Hành 95% &amp; Kiểm Toán HITL
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Graduation Engine
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Thang tiến hóa 3 cấp độ (Tập sự → Đồng hành → Tự hành 95%) cho Đội nhân sự số.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Bot Selector Bar */}
        <div className="flex shrink-0 snap-x gap-1 overflow-x-auto border-b border-hairline/40 p-2 scrollbar-none sm:px-6 bg-card">
          {enterpriseBots.length > 0 ? (
            enterpriseBots.map((bot) => {
              const p = profiles[bot.id];
              const tierBadge = p ? AUTONOMY_TIERS[p.currentTier].code : "T1";
              const isSelected = selectedBotId === bot.id;
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => setSelectedBotId(bot.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] sm:text-[13px] font-medium transition-colors border",
                    isSelected
                      ? "bg-control border-hairline font-semibold text-ink ring-1 ring-hairline"
                      : "bg-card border-transparent text-ink-secondary hover:bg-control/50 hover:text-ink"
                  )}
                >
                  <span className="rounded bg-control px-1.5 py-0.5 text-[10px] font-mono text-ink-tertiary">
                    {tierBadge}
                  </span>
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">{bot.name}</span>
                </button>
              );
            })
          ) : (
            <div className="p-2 text-[12px] text-ink-tertiary">
              Chưa có nhân sự số nào được kích hoạt. Hãy tuyển nhân sự từ Thư Viện.
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {currentProfile ? (
            <>
              {/* Notification Banner if action performed */}
              {actionNotice && (
                <div className="rounded-xl border border-hairline/60 bg-control/40 p-3 text-[12px] text-ink flex items-start gap-2.5">
                  <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
                  <p className="flex-1 leading-relaxed">{actionNotice}</p>
                </div>
              )}

              {/* Bot Autonomy Status Card (Clean Neutral) */}
              <div className="rounded-xl border border-hairline/60 bg-control/20 p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-ink">{currentProfile.botName}</h3>
                      <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                        Zone {currentProfile.departmentZone}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-secondary mt-0.5">
                      {currentTierMeta.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="rounded-lg border border-hairline/60 bg-card px-3 py-1 text-[12px] font-semibold text-ink">
                      {currentTierMeta.badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Autonomy Graduation Streak Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>
                      Tiến độ tốt nghiệp cấp tiếp theo:{" "}
                      <strong className="text-ink">
                        {currentProfile.consecutiveCleanStreak}/{currentProfile.graduationTargetStreak} tác vụ sạch lỗi liên tiếp
                      </strong>
                    </span>
                    <span className="font-semibold text-ink">{streakPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-control overflow-hidden border border-hairline/40">
                    <div
                      className="h-full bg-accent transition-all duration-300 rounded-full"
                      style={{ width: `${streakPct}%` }}
                    />
                  </div>
                </div>

                {/* 4 Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="rounded-lg bg-card p-2 border border-hairline/40">
                    <div className="text-[10px] text-ink-tertiary">Tổng Tác Vụ Xử Lý</div>
                    <div className="text-[13px] font-bold text-ink mt-0.5">
                      {currentProfile.totalTasksProcessed}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-hairline/40">
                    <div className="text-[10px] text-ink-tertiary">Duyệt Chuẩn (Clean)</div>
                    <div className="text-[13px] font-bold text-ink mt-0.5">
                      {currentProfile.approvedCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-hairline/40">
                    <div className="text-[10px] text-ink-tertiary">Tỷ Lệ Con Người Sửa</div>
                    <div className="text-[13px] font-bold text-ink mt-0.5">{humanRatio}%</div>
                  </div>
                  <div className="rounded-lg bg-card p-2 border border-hairline/40">
                    <div className="text-[10px] text-ink-tertiary">Cảnh Báo Lỗi Ngầm</div>
                    <div className="text-[13px] font-bold text-ink mt-0.5">
                      {currentProfile.consecutiveRejections}/2 (Cầu Dao)
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier Selection & Simulation Controls */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink">
                    Cấu hình cấp độ &amp; Kiểm toán phê duyệt (HITL):
                  </span>
                  <div className="flex items-center gap-1">
                    {(["TIER_1_APPRENTICE", "TIER_2_COPILOT", "TIER_3_AUTONOMOUS"] as AutonomyTier[]).map(
                      (tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => handleManualSetTier(tier)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                            currentProfile.currentTier === tier
                              ? "bg-control border-hairline font-semibold text-ink"
                              : "border-transparent text-ink-tertiary hover:bg-control/40"
                          )}
                        >
                          {AUTONOMY_TIERS[tier].code}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Simulation input & 3 actions */}
                <div className="space-y-2 pt-1 border-t border-hairline/40">
                  <span className="text-[11px] text-ink-secondary block">
                    Mô phỏng duyệt kết quả thực tế của bot để kiểm tra thăng hạng / giáng cấp:
                  </span>
                  <input
                    type="text"
                    value={taskNameInput}
                    onChange={(e) => setTaskNameInput(e.target.value)}
                    placeholder="Mô tả tác vụ bot vừa soạn thảo..."
                    className="w-full rounded-lg border border-hairline/60 bg-control px-3 py-1.5 text-[12px] text-ink focus:border-accent focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSimulateOutcome("APPROVED")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-control px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-control/70 transition-colors"
                    >
                      <CheckCircle2 size={13} className="text-accent" />
                      <span>Duyệt Chuẩn (Streak +1)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateOutcome("EDITED")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-control px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-control/70 transition-colors"
                    >
                      <span>Sửa Đổi Kịch Bản (Reset Streak)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateOutcome("REJECTED")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-control px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-control/70 transition-colors"
                    >
                      <AlertTriangle size={13} className="text-accent" />
                      <span>Bác Bỏ Tác Vụ (Bật Cầu Dao)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Task Audit History List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink">
                    Nhật ký kiểm toán HITL ({currentProfile.history.length} tác vụ gần nhất):
                  </span>
                  {currentProfile.graduatedAt && (
                    <span className="text-[11px] text-accent font-medium flex items-center gap-1">
                      <GraduationCap size={13} />
                      Đã tốt nghiệp Tự hành 95%
                    </span>
                  )}
                </div>

                <div className="divide-y divide-hairline/40 rounded-xl border border-hairline/60 bg-card overflow-hidden">
                  {currentProfile.history.length > 0 ? (
                    currentProfile.history.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 text-[12px] hover:bg-control/20 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-ink truncate block">
                            {item.taskTitle}
                          </span>
                          <span className="text-[10px] text-ink-tertiary flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {new Date(item.timestamp).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            {item.feedback && ` - ${item.feedback}`}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-medium shrink-0 border",
                            item.status === "APPROVED"
                              ? "bg-control text-ink border-hairline font-semibold"
                              : item.status === "EDITED"
                              ? "bg-card text-ink-secondary border-hairline/50"
                              : "bg-control text-accent border-hairline/60 font-semibold"
                          )}
                        >
                          {item.status === "APPROVED"
                            ? "Duyệt chuẩn"
                            : item.status === "EDITED"
                            ? "Có chỉnh sửa"
                            : "Bác bỏ"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[12px] text-ink-tertiary">
                      Chưa có lịch sử kiểm toán. Các tác vụ duyệt sẽ tự động lưu vết tại đây.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-ink-secondary text-[13px]">
              Vui lòng chọn một nhân sự số để xem thông số tự trị.
            </div>
          )}
        </div>

        {/* Sticky Footer matching Voice-to-SOP (Image 3) */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <div className="text-[12px] text-center sm:text-left text-ink-tertiary">
            Cầu dao an toàn: Tự động giáng cấp về Tier 1 nếu bot bị bác bỏ 2 lần liên tiếp.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors w-full sm:w-auto text-center"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => {
                saveAutonomyProfiles(profiles);
                onClose();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 transition-opacity w-full sm:w-auto"
            >
              <ShieldCheck size={15} />
              <span>Lưu Cài Đặt Tự Trị</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
