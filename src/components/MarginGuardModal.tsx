import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import { useOwnerOrAdmin } from "@/lib/use-owner-or-admin";
import {
  X,
  ShieldCheck,
  Check,
  TrendingUp,
  DollarSign,
  Copy,
} from "lucide-react";
import {
  evaluateMarginQuote,
  formatMarginGuardReport,
  DEFAULT_MIN_MARGIN_THRESHOLD_PCT,
} from "@/lib/margin-guard";

interface MarginGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrice?: number;
  initialCosts?: number;
  onApplyPrice?: (approvedPrice: number) => void;
}

export function MarginGuardModal({
  isOpen,
  onClose,
  initialPrice = 50_000_000,
  initialCosts = 30_000_000,
  onApplyPrice,
}: MarginGuardModalProps) {
  const ownerOrAdmin = useOwnerOrAdmin();
  const canEditThreshold = ownerOrAdmin !== false;
  const [proposedPrice, setProposedPrice] = useState<number>(initialPrice);
  const [directCosts, setDirectCosts] = useState<number>(initialCosts);
  const [minThreshold, setMinThreshold] = useState<number>(DEFAULT_MIN_MARGIN_THRESHOLD_PCT);
  const [copied, setCopied] = useState(false);

  const evaluation = useMemo(() => {
    return evaluateMarginQuote({
      proposedPrice,
      directCosts,
      minMarginThresholdPct: minThreshold,
    });
  }, [proposedPrice, directCosts, minThreshold]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    const report = formatMarginGuardReport(evaluation);
    navigator.clipboard?.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHealthy = evaluation.status === "APPROVED";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-2xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Margin Guard: Chốt Chặn Lợi Nhuận
                </h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  {evaluation.badgeText}
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Kiểm duyệt báo giá tự động bảo toàn dòng tiền và biên lợi nhuận.
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

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] sm:text-[13px] font-medium text-ink flex items-center justify-between">
                <span>Giá Bán Đề Xuất (VND)</span>
                <span className="text-[11px] text-ink-secondary">Doanh thu dự kiến</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500000"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-hairline/60 bg-control p-3 pl-8 text-[13px] sm:text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <DollarSign size={15} className="absolute left-2.5 top-3.5 text-ink-secondary" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] sm:text-[13px] font-medium text-ink flex items-center justify-between">
                <span>Chi Phí Vốn COGS (VND)</span>
                <span className="text-[11px] text-ink-secondary">Vật tư, thầu phụ, nhân công</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500000"
                  value={directCosts}
                  onChange={(e) => setDirectCosts(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-hairline/60 bg-control p-3 pl-8 text-[13px] sm:text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <DollarSign size={15} className="absolute left-2.5 top-3.5 text-ink-secondary" />
              </div>
            </div>
          </div>

          {/* Threshold Slider */}
          <div className="rounded-xl border border-hairline/50 bg-control/20 p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center justify-between text-[12px] sm:text-[13px]">
              <span className="font-medium text-ink">
                Ngưỡng Biên Lợi Nhuận Tối Thiểu:
              </span>
              <span className="font-bold text-accent">
                {minThreshold}% {!canEditThreshold && <span className="text-[11px] font-normal text-ink-tertiary">(Khóa bởi Quản trị viên)</span>}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="65"
              step="5"
              value={minThreshold}
              disabled={!canEditThreshold}
              onChange={(e) => canEditThreshold && setMinThreshold(Number(e.target.value))}
              className={cn("w-full accent-accent", canEditThreshold ? "cursor-pointer" : "cursor-not-allowed opacity-60")}
            />
            <div className="flex justify-between text-[10px] text-ink-tertiary">
              <span>20% (Thấp)</span>
              <span>35% (Chuẩn SME)</span>
              <span>50%+ (Cao cấp)</span>
            </div>
          </div>

          {/* Clean Neutral Audit Results Card (No Rainbow Colors) */}
          <div className="rounded-xl border border-hairline/60 bg-control/30 p-4 sm:p-5 space-y-3.5">
            {/* Visual Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] sm:text-[13px]">
                <span className="font-medium text-ink">Biên Lợi Nhuận Gộp:</span>
                <span className="text-[16px] sm:text-[17px] font-bold text-ink">
                  {evaluation.grossMarginPct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-control overflow-hidden border border-hairline/40">
                <div
                  className="h-full bg-accent transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, evaluation.grossMarginPct))}%` }}
                />
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="rounded-lg border border-hairline/50 bg-card p-2.5 sm:p-3">
                <div className="text-[10px] sm:text-[11px] text-ink-secondary">Lợi Nhuận Gộp</div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-ink mt-0.5">
                  {evaluation.grossMarginAmount.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div className="rounded-lg border border-hairline/50 bg-card p-2.5 sm:p-3">
                <div className="text-[10px] sm:text-[11px] text-ink-secondary">Ước Tính Ròng</div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-ink mt-0.5">
                  ~{evaluation.potentialNetProfitEstimate.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div className="rounded-lg border border-hairline/50 bg-card p-2.5 sm:p-3 col-span-2 sm:col-span-1">
                <div className="text-[10px] sm:text-[11px] text-ink-secondary">Giá Sàn Đạt Chuẩn</div>
                <div className="text-[13px] sm:text-[14px] font-semibold text-accent mt-0.5">
                  {evaluation.recommendedMinPrice.toLocaleString("vi-VN")} đ
                </div>
              </div>
            </div>

            {/* Reason and Feedback */}
            <div className="rounded-lg bg-card p-3 text-[12px] leading-relaxed flex items-start gap-2 border border-hairline/40">
              <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-ink font-medium">{evaluation.reason}</p>
                {evaluation.escalationRequired && (
                  <p className="text-[11px] text-ink-secondary">
                    Gợi ý: Không hạ giá cùng phạm vi công việc. Hãy giảm bớt hạng mục (scope) hoặc yêu cầu Founder duyệt.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer matching Image 3 */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-ink-secondary hover:text-ink transition-colors w-full sm:w-auto justify-center sm:justify-start"
          >
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            {copied ? "Đã sao chép báo cáo!" : "Sao chép Báo cáo"}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors"
            >
              Đóng
            </button>
            {!isHealthy && onApplyPrice && (
              <button
                type="button"
                onClick={() => {
                  onApplyPrice(evaluation.recommendedMinPrice);
                  setProposedPrice(evaluation.recommendedMinPrice);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white hover:bg-accent/90 transition-colors shadow-sm w-full sm:w-auto"
              >
                <TrendingUp size={14} />
                <span>Áp Dụng Giá Sàn</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
