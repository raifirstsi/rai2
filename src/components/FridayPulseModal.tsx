import { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Calendar,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useStore } from "@/state/store";
import {
  computeFridayPulseReport,
  formatFridayPulseMarkdown,
} from "@/lib/friday-pulse";
import { loadSavedTocDiagnosis } from "@/lib/toc-detector";
import { loadSavedFingerprint } from "./CompanyFingerprintModal";

interface FridayPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTocDiagnostic?: () => void;
  onOpenStrategyMap?: () => void;
}

export function FridayPulseModal({
  isOpen,
  onClose,
  onOpenTocDiagnostic,
  onOpenStrategyMap,
}: FridayPulseModalProps) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);

  const activeBotIds = useMemo(() => {
    return (state.bots || []).flatMap((b) => [
      b.id,
      b.name,
      b.title,
      (b as any).role,
      b.section,
    ].filter(Boolean) as string[]);
  }, [state.bots]);

  const tocDiagnosis = useMemo(() => {
    return loadSavedTocDiagnosis();
  }, []);

  const savedFingerprint = useMemo(() => {
    return loadSavedFingerprint();
  }, []);

  const targetMargin = savedFingerprint?.targetNetMargin ?? 38;

  // Compute pending backlog count from bot tasks older than 48 hours
  const backlogCount = useMemo(() => {
    let count = 0;
    for (const bot of state.bots || []) {
      for (const task of bot.tasks || []) {
        const ageHours = (Date.now() - (task.updatedAt || task.createdAt || 0)) / (1000 * 60 * 60);
        if (ageHours > 48) {
          count++;
        }
      }
    }
    return count;
  }, [state.bots]);

  const report = useMemo(() => {
    return computeFridayPulseReport({
      activeBotIds,
      tocDiagnosis,
      backlogCount,
      customMarginScore: targetMargin,
    });
  }, [activeBotIds, tocDiagnosis, backlogCount, targetMargin]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const md = formatFridayPulseMarkdown(report);
    navigator.clipboard?.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLevel3 = report.absenceLevel.levelNumber === 3;
  const isLevel2 = report.absenceLevel.levelNumber === 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-ink">
                  Báo Cáo Nhịp Thở Thứ Sáu 17:00
                </h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                  {report.weekDisplay}
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary">
                Kiểm tra sức khỏe P&L và Thước đo Sẵn sàng Vắng mặt ($ARI$) trước khi kết thúc tuần.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Dynamic Absence Readiness Gauge ($ARI$) */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              isLevel3
                ? "border-emerald-500/30 bg-emerald-500/5"
                : isLevel2
                ? "border-blue-500/30 bg-blue-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  Thước Đo Sẵn Sàng Vắng Mặt ($ARI$)
                </span>
                <h4 className="text-[16px] font-bold text-ink mt-0.5">
                  {report.absenceLevel.title}
                </h4>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-[28px] font-extrabold ${
                    isLevel3
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isLevel2
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {report.absenceReadinessScore}
                </span>
                <span className="text-[14px] text-ink-tertiary font-bold">/100</span>
              </div>
            </div>

            {/* Gauge progress bar */}
            <div className="h-2 w-full rounded-full bg-control overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isLevel3 ? "bg-emerald-500" : isLevel2 ? "bg-blue-500" : "bg-amber-500"
                }`}
                style={{ width: `${report.absenceReadinessScore}%` }}
              />
            </div>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              {report.absenceLevel.description}
            </p>
          </div>

          {/* 2. Four Operational Vital Signs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-hairline/40 bg-control p-3.5 space-y-1">
              <div className="text-[11px] text-ink-secondary">Nhân Sự Số Chạy</div>
              <div className="text-[16px] font-extrabold text-ink">
                {report.metrics.activeBotsCount} bot
              </div>
            </div>

            <div className="rounded-xl border border-hairline/40 bg-control p-3.5 space-y-1">
              <div className="text-[11px] text-ink-secondary">Vùng Ổn Định</div>
              <div className="text-[16px] font-extrabold text-emerald-600 dark:text-emerald-400">
                {report.metrics.healthyDepartmentsCount}/7 Vùng
              </div>
            </div>

            <div className="rounded-xl border border-hairline/40 bg-control p-3.5 space-y-1">
              <div className="text-[11px] text-ink-secondary">Tồn Đọng (&gt;48h)</div>
              <div
                className={`text-[16px] font-extrabold ${
                  report.metrics.backlogOver48hCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-ink"
                }`}
              >
                {report.metrics.backlogOver48hCount} việc
              </div>
            </div>

            <div className="rounded-xl border border-hairline/40 bg-control p-3.5 space-y-1">
              <div className="text-[11px] text-ink-secondary">Chính Sách P&L</div>
              <div className="text-[13px] font-bold text-ink truncate" title={report.metrics.marginPolicyAdherence}>
                Margin &gt;= 35%
              </div>
            </div>
          </div>

          {/* 3. The Single Priority for Next Week */}
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-accent font-bold text-[13px]">
              <TrendingUp size={18} />
              <span>MỤC TIÊU ƯU TIÊN DUY NHẤT TUẦN TỚI (THE SINGLE PRIORITY)</span>
            </div>
            <div className="rounded-xl bg-card p-4 border border-hairline/50">
              <p className="text-[14px] font-bold text-ink leading-relaxed">
                {report.singlePriorityForNextWeek}
              </p>
            </div>

            {report.actionItems.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[12px] font-semibold text-ink">Hành động trọng tâm:</span>
                <ul className="space-y-1 text-[12px] text-ink-secondary">
                  {report.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-accent font-bold">{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 4. 7-Zone Health Pipeline Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-ink-secondary">
              <span className="font-semibold text-ink">Tổng quan 7 Vùng Nghiệp vụ</span>
              {onOpenStrategyMap && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStrategyMap();
                  }}
                  className="text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Mở Bản Đồ 7 Vùng</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {report.strategySummary.zones.map((zone) => {
                const isTOC = zone.status === "CRITICAL_TOC";
                const isWarning = zone.status === "WARNING";

                return (
                  <div
                    key={zone.code}
                    title={`${zone.name} (${zone.activeAgentsCount} bots)`}
                    className={`rounded-lg p-2 text-center border ${
                      isTOC
                        ? "border-red-500 bg-red-500/20 text-red-700 dark:text-red-300 font-extrabold"
                        : isWarning
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <div className="text-[10px] font-bold">Z{zone.zoneNumber}</div>
                    <div className="text-[9px] truncate opacity-80">{zone.activeAgentsCount} bot</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-hairline/50 px-6 py-4 bg-card">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-ink-secondary hover:bg-raised transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? "Đã chép báo cáo!" : "Sao chép Báo cáo Zalo/Telegram"}
          </button>

          <div className="flex items-center gap-2">
            {report.metrics.bottleneckDepartmentName && onOpenTocDiagnostic && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTocDiagnostic();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Khơi thông {report.metrics.bottleneckDepartmentName}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-secondary hover:bg-raised transition-colors"
            >
              Đóng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
