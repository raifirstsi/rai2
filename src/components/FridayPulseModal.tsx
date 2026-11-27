import { fetchEnterpriseState, patchEnterpriseState, sendFridayPulseOnServer } from "@/lib/enterprise-state-client";
import { useState, useMemo, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Calendar,
  ArrowRight,
  TrendingUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useStore } from "@/state/store";
import {
  computeFridayPulseReport,
  formatFridayPulseMarkdown,
  getFridayPulseWebhookUrl,
  saveFridayPulseWebhookUrl,

  getLastSentFridayPulse,
  markFridayPulseReviewed,
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
  const [webhookUrl, setWebhookUrl] = useState(() => getFridayPulseWebhookUrl());
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [webhookFeedback, setWebhookFeedback] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState(() => getLastSentFridayPulse());

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

  useEffect(() => {
    if (!isOpen) return;
    markFridayPulseReviewed(report.weekDisplay);
    let alive = true;
    void fetchEnterpriseState().then(({ state: ent }) => {
      if (!alive || !ent) return;
      if (ent.fridayPulse?.webhookUrl) setWebhookUrl(ent.fridayPulse.webhookUrl);
      if (ent.fridayPulse?.lastSentAt && ent.fridayPulse?.lastSentWeek) {
        setLastSent({ at: ent.fridayPulse.lastSentAt, week: ent.fridayPulse.lastSentWeek });
      }
    });
    void patchEnterpriseState({ fridayPulse: { reviewedWeek: report.weekDisplay } });
    return () => { alive = false; };
  }, [isOpen, report.weekDisplay]);

  const handleSendWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookStatus("error");
      setWebhookFeedback("Vui lòng nhập địa chỉ URL Webhook (Zalo hoặc Telegram).");
      return;
    }
    saveFridayPulseWebhookUrl(webhookUrl);
    setWebhookStatus("sending");
    setWebhookFeedback(null);
    const result = await sendFridayPulseOnServer({
      workspaceId: "default",
      webhookUrl,
      markdown: formatFridayPulseMarkdown(report),
      weekDisplay: report.weekDisplay,
      dispatchZalo: true,
    });
    if (result.ok) {
      setWebhookStatus("success");
      setWebhookFeedback("Đã gửi báo cáo thành công tới Webhook!");
      setLastSent(getLastSentFridayPulse());
      setTimeout(() => setWebhookStatus("idle"), 4000);
    } else {
      setWebhookStatus("error");
      setWebhookFeedback(result.error || "Gửi webhook thất bại");
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    const md = formatFridayPulseMarkdown(report);
    navigator.clipboard?.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-3xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Calendar size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Báo Cáo Nhịp Thở Thứ Sáu 17:00
                </h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  {report.weekDisplay}
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Kiểm tra sức khỏe P&amp;L và chỉ số sẵn sàng vắng mặt (ARI) định kỳ.
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* 1. Absence Readiness Gauge (ARI) - Clean Neutral Tone */}
          <div className="rounded-xl border border-hairline/60 bg-control/30 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <span className="text-[11px] font-medium text-ink-secondary">
                  Thước Đo Sẵn Sàng Vắng Mặt (ARI)
                </span>
                <h4 className="text-[14px] sm:text-[15px] font-semibold text-ink mt-0.5">
                  {report.absenceLevel.title}
                </h4>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] sm:text-[24px] font-bold text-ink">
                  {report.absenceReadinessScore}
                </span>
                <span className="text-[13px] text-ink-tertiary font-medium">/100</span>
              </div>
            </div>

            {/* Gauge progress bar - Single clean accent */}
            <div className="h-2 w-full rounded-full bg-control overflow-hidden border border-hairline/40">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${report.absenceReadinessScore}%` }}
              />
            </div>
            <p className="text-[12px] text-ink-secondary leading-relaxed">
              {report.absenceLevel.description}
            </p>
          </div>

          {/* 2. Four Operational Vital Signs - Clean Neutral Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-hairline/50 bg-control/40 p-3 space-y-0.5">
              <div className="text-[11px] text-ink-secondary">Nhân Sự Số Chạy</div>
              <div className="text-[14px] sm:text-[15px] font-bold text-ink">
                {report.metrics.activeBotsCount} bot
              </div>
            </div>

            <div className="rounded-lg border border-hairline/50 bg-control/40 p-3 space-y-0.5">
              <div className="text-[11px] text-ink-secondary">Vùng Ổn Định</div>
              <div className="text-[14px] sm:text-[15px] font-bold text-ink">
                {report.metrics.healthyDepartmentsCount}/7 Vùng
              </div>
            </div>

            <div className="rounded-lg border border-hairline/50 bg-control/40 p-3 space-y-0.5">
              <div className="text-[11px] text-ink-secondary">Tồn Đọng (&gt;48h)</div>
              <div className="text-[14px] sm:text-[15px] font-bold text-ink">
                {report.metrics.backlogOver48hCount} việc
              </div>
            </div>

            <div className="rounded-lg border border-hairline/50 bg-control/40 p-3 space-y-0.5">
              <div className="text-[11px] text-ink-secondary">Chính Sách P&amp;L</div>
              <div className="text-[13px] font-bold text-ink truncate" title={report.metrics.marginPolicyAdherence}>
                Margin &ge; 35%
              </div>
            </div>
          </div>

          {/* 3. The Single Priority for Next Week - Clean Card */}
          <div className="rounded-xl border border-hairline/60 bg-control/20 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-accent font-semibold text-[12px] sm:text-[13px]">
              <TrendingUp size={16} />
              <span>Mục tiêu ưu tiên duy nhất tuần tới:</span>
            </div>
            <div className="rounded-lg bg-card p-3 border border-hairline/50">
              <p className="text-[13px] sm:text-[14px] font-medium text-ink leading-relaxed">
                {report.singlePriorityForNextWeek}
              </p>
            </div>

            {report.actionItems.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-medium text-ink-secondary">Hành động trọng tâm:</span>
                <ul className="space-y-1 text-[12px] text-ink-secondary">
                  {report.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-accent font-semibold">{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 4. 7-Zone Health Pipeline Bar - Clean Neutral Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-[12px] text-ink-secondary">
              <span className="font-medium text-ink">Tổng quan 7 Vùng Nghiệp vụ:</span>
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
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {report.strategySummary.zones.map((zone) => {
                const isTOC = zone.status === "CRITICAL_TOC";

                return (
                  <div
                    key={zone.code}
                    title={`${zone.name} (${zone.activeAgentsCount} bots)`}
                    className={`rounded-lg p-2 text-center border transition-all ${
                      isTOC
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-hairline/60 bg-card text-ink"
                    }`}
                  >
                    <div className="text-[10px] font-semibold">Z{zone.zoneNumber}</div>
                    <div className="text-[9px] truncate text-ink-secondary">{zone.activeAgentsCount} bot</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Webhook Notification Channel (Zalo / Telegram) */}
          <div className="rounded-xl border border-hairline/60 bg-control/20 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Send size={15} className="text-accent" />
                <span className="text-[13px] font-semibold text-ink">
                  Kênh Gửi Webhook Di Động (Zalo / Telegram)
                </span>
              </div>
              {lastSent && (
                <span className="text-[11px] text-ink-secondary">
                  Lần gửi gần nhất: {new Date(lastSent.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ({lastSent.week})
                </span>
              )}
            </div>

            <p className="text-[12px] text-ink-secondary leading-relaxed">
              Bắn toàn bộ bản tin P&amp;L và chỉ số sẵn sàng vắng mặt (ARI) 17:00 về kênh di động của Người Sáng Lập.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  saveFridayPulseWebhookUrl(e.target.value);
                }}
                placeholder="https://chat.zalo.me/... hoặc https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>"
                className="flex-1 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-[12px] text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleSendWebhook}
                disabled={webhookStatus === "sending"}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-sm cursor-pointer shrink-0"
              >
                {webhookStatus === "sending" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>{webhookStatus === "sending" ? "Đang gửi..." : "Gửi Ngay (1-Chạm)"}</span>
              </button>
            </div>

            {webhookFeedback && (
              <div
                className={`flex items-center gap-1.5 text-[12px] ${
                  webhookStatus === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500"
                }`}
              >
                {webhookStatus === "success" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                <span>{webhookFeedback}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer matching Image 3 */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-ink-secondary hover:text-ink transition-colors w-full sm:w-auto justify-center sm:justify-start"
          >
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            {copied ? "Đã sao chép báo cáo!" : "Sao chép Báo cáo"}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {report.metrics.bottleneckDepartmentName && onOpenTocDiagnostic && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTocDiagnostic();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white hover:bg-accent/90 transition-colors shadow-sm w-full sm:w-auto"
              >
                <span>Khơi thông {report.metrics.bottleneckDepartmentName}</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors"
            >
              Đóng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
