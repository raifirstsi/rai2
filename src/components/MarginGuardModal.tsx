import { useState, useMemo } from "react";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
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
  const isDanger = evaluation.status === "CRITICAL_DANGER";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isHealthy
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isDanger
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isHealthy ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-ink">
                  Margin Guard: Chốt Chặn Biên Lợi Nhuận Gộp
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    isHealthy
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : isDanger
                      ? "bg-red-500/10 text-red-700 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {evaluation.badgeText}
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary">
                Bài học Sarah (Chương 1–2): Kiểm duyệt mọi báo giá trước khi gửi khách để bảo toàn dòng tiền P&L.
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

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink flex items-center justify-between">
                <span>Giá Bán Đề Xuất (VND)</span>
                <span className="text-[11px] text-ink-secondary">Doanh thu dự kiến</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500000"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-hairline/60 bg-control p-3 pl-9 text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <DollarSign size={16} className="absolute left-3 top-3.5 text-ink-secondary" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink flex items-center justify-between">
                <span>Chi Phí Vốn Trực Tiếp COGS (VND)</span>
                <span className="text-[11px] text-ink-secondary">Nhân công, vật tư, thầu phụ</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="500000"
                  value={directCosts}
                  onChange={(e) => setDirectCosts(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-hairline/60 bg-control p-3 pl-9 text-[14px] font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <DollarSign size={16} className="absolute left-3 top-3.5 text-ink-secondary" />
              </div>
            </div>
          </div>

          {/* Threshold Slider */}
          <div className="rounded-xl border border-hairline/40 bg-raised/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-ink">
                Ngưỡng Biên Lợi Nhuận Tối Thiểu (Chính Sách Công Ty)
              </span>
              <span className="font-bold text-accent">{minThreshold}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="65"
              step="5"
              value={minThreshold}
              onChange={(e) => setMinThreshold(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-ink-tertiary">
              <span>20% (Rất rủi ro)</span>
              <span>35% (Chuẩn SME dịch vụ)</span>
              <span>50%+ (Cao cấp)</span>
            </div>
          </div>

          {/* Audit Results Card */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              isHealthy
                ? "border-emerald-500/30 bg-emerald-500/5"
                : isDanger
                ? "border-red-500/30 bg-red-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            {/* Visual Gauge Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">Biên Lợi Nhuận Gộp Ước Tính:</span>
                <span
                  className={`text-[18px] font-extrabold ${
                    isHealthy
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isDanger
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {evaluation.grossMarginPct}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-control overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isHealthy ? "bg-emerald-500" : isDanger ? "bg-red-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, evaluation.grossMarginPct))}%` }}
                />
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-hairline/40 bg-card p-3">
                <div className="text-[11px] text-ink-secondary">Lợi Nhuận Gộp</div>
                <div className="text-[14px] font-bold text-ink mt-0.5">
                  {evaluation.grossMarginAmount.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div className="rounded-xl border border-hairline/40 bg-card p-3">
                <div className="text-[11px] text-ink-secondary">Ước Tính Ròng Sau OPEX</div>
                <div className="text-[14px] font-bold text-ink mt-0.5">
                  ~{evaluation.potentialNetProfitEstimate.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div className="rounded-xl border border-hairline/40 bg-card p-3 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-ink-secondary">Giá Sàn Đạt Chuẩn</div>
                <div className="text-[14px] font-bold text-accent mt-0.5">
                  {evaluation.recommendedMinPrice.toLocaleString("vi-VN")} đ
                </div>
              </div>
            </div>

            {/* Reason and Feedback */}
            <div className="rounded-xl bg-card/60 p-3.5 text-[13px] leading-relaxed flex items-start gap-2.5">
              {isHealthy ? (
                <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="text-ink font-medium">{evaluation.reason}</p>
                {evaluation.escalationRequired && (
                  <p className="text-[12px] text-ink-secondary">
                    Quy tắc Sarah: Không bao giờ thỏa hiệp hạ giá cùng phạm vi công việc. Hãy tư vấn khách giảm bớt hạng mục (scope) hoặc yêu cầu Founder ký duyệt ngoại lệ.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-hairline/50 px-6 py-4 bg-card">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-ink-secondary hover:bg-raised transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? "Đã chép báo cáo!" : "Sao chép Báo cáo Margin"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-secondary hover:bg-raised transition-colors"
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent/90 transition-colors shadow-sm"
              >
                <TrendingUp size={14} />
                Áp Dụng Giá Sàn ({evaluation.recommendedMinPrice.toLocaleString("vi-VN")} đ)
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
