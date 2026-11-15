import { useState, useMemo, useId } from "react";
import {
  X,
  TrendingUp,
  Copy,
  Check,
  Sparkles,
  Plus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  computeFiveLeversCompounding,
  formatVndCurrency,
  formatFiveLeversPlanMarkdown,
  LEVER_PRESETS,
  loadSavedFiveLeversInput,
  saveFiveLeversInput,
  type FiveLeversInput,
  type LeverImprovementPct,
} from "@/lib/five-levers";
import {
  loadSavedFingerprint,
  saveFingerprintToStorage,
} from "@/components/CompanyFingerprintModal";
import {
  loadSavedContextVault,
  saveContextVaultToStorage,
} from "@/lib/context-vault";

export interface FiveLeversModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHireDepartment?: (deptCode: string, zoneNumber?: number) => void;
}

export function FiveLeversModal({
  isOpen,
  onClose,
  onHireDepartment,
}: FiveLeversModalProps) {
  const dialogTitleId = useId();
  const [copied, setCopied] = useState(false);
  const [syncTargetStatus, setSyncTargetStatus] = useState<string | null>(null);
  const [isSyncingTarget, setIsSyncingTarget] = useState(false);
  const [input, setInput] = useState<FiveLeversInput>(() => loadSavedFiveLeversInput());
  const [activePreset, setActivePreset] = useState<string>("BALANCED_10");
  const [improvements, setImprovements] = useState<LeverImprovementPct>(
    LEVER_PRESETS.BALANCED_10.improvements
  );

  const result = useMemo(() => {
    return computeFiveLeversCompounding(input, improvements);
  }, [input, improvements]);

  if (!isOpen) return null;

  const handleSyncTargetMarginToVault = () => {
    setIsSyncingTarget(true);
    try {
      const targetGrossMargin = Math.round(
        input.grossMarginPct * (1 + improvements.grossMarginPct / 100)
      );

      // 1. Update Company Fingerprint (Parameter M)
      const existingFingerprint = loadSavedFingerprint();
      const updatedFingerprint = {
        industryId: existingFingerprint?.industryId || "turnkey_fmcg",
        companyName: existingFingerprint?.companyName || "Doanh nghiệp",
        targetNetMargin: targetGrossMargin,
        maxDiscountAllowed: existingFingerprint?.maxDiscountAllowed ?? 5,
        paymentMilestones: existingFingerprint?.paymentMilestones || [
          "Tạm ứng 50%",
          "Nghiệm thu 50%",
        ],
        rulesPrompt:
          existingFingerprint?.rulesPrompt ||
          `Biên lợi nhuận gộp sàn: ${targetGrossMargin}%. Tuyệt đối không tự ý giảm giá vượt quá hạn mức cho phép.`,
        sourceType: existingFingerprint?.sourceType || "turnkey_preset",
        updatedAt: new Date().toISOString(),
      };
      saveFingerprintToStorage(updatedFingerprint);

      // 2. Update Context Vault offer breakdown & pricing rules
      const vault = loadSavedContextVault() || ({} as any);
      const currentOffers = vault.offer_breakdown || "";
      const indicator = `\n- [Chỉ tiêu 5 Đòn Bẩy P&L] Biên lợi nhuận sàn mục tiêu (M): ${targetGrossMargin}%. Giữ giá sàn và không chiết khấu vượt mức cho phép.`;
      if (!currentOffers.includes("[Chỉ tiêu 5 Đòn Bẩy P&L]")) {
        vault.offer_breakdown = `${currentOffers}${indicator}`;
      } else {
        vault.offer_breakdown = currentOffers.replace(
          /- \[Chỉ tiêu 5 Đòn Bẩy P&L\].*$/m,
          `- [Chỉ tiêu 5 Đòn Bẩy P&L] Biên lợi nhuận sàn mục tiêu (M): ${targetGrossMargin}%. Giữ giá sàn và không chiết khấu vượt mức cho phép.`
        );
      }
      saveContextVaultToStorage(vault);

      setSyncTargetStatus(`✓ Đã đồng bộ biên LN sàn ${targetGrossMargin}% vào Két Sắt & Dấu Vân Tay!`);
      setTimeout(() => setSyncTargetStatus(null), 3500);
    } catch (err) {
      console.error("Sync target margin error:", err);
    } finally {
      setIsSyncingTarget(false);
    }
  };

  const handleApplyPreset = (key: string) => {
    setActivePreset(key);
    if (LEVER_PRESETS[key]) {
      setImprovements({ ...LEVER_PRESETS[key].improvements });
    }
  };

  const handleSliderChange = (leverKey: keyof LeverImprovementPct, val: number) => {
    setActivePreset("CUSTOM");
    setImprovements((prev) => ({
      ...prev,
      [leverKey]: val,
    }));
  };

  const handleInputChange = (field: keyof FiveLeversInput, val: number) => {
    const next = { ...input, [field]: val };
    setInput(next);
    saveFiveLeversInput(next);
  };

  const handleCopy = () => {
    const md = formatFiveLeversPlanMarkdown(result);
    navigator.clipboard?.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden">
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <TrendingUp size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={dialogTitleId} className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Mô Phỏng 5 Đòn Bẩy P&L
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  x{result.growth.netProfitMultiplier} Lợi Nhuận
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Mô phỏng đòn bẩy tài chính kép tăng trưởng lợi nhuận không tăng nhân sự.
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Preset Buttons */}
          <div>
            <div className="text-[12px] font-semibold text-ink-secondary mb-2">
              Kịch bản mô phỏng AI mẫu:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(LEVER_PRESETS).map(([key, preset]) => {
                const isSelected = activePreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleApplyPreset(key)}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 text-ink shadow-xs"
                        : "border-hairline/60 bg-control hover:bg-raised text-ink-secondary hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold">{preset.label}</span>
                      {isSelected && <Sparkles size={13} className="text-accent" />}
                    </div>
                    <p className="text-[11px] text-ink-secondary line-clamp-2 mt-1">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compounding Visual Summary Card */}
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline/40 pb-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-accent">
                  KẾT QUẢ TĂNG TRƯỞNG KÉP DỰ BÁO
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-ink mt-0.5">
                  +{formatVndCurrency(result.growth.extraAnnualNetProfit)}/năm
                </div>
                <div className="text-[12px] text-ink-secondary">
                  Dòng tiền lợi nhuận ròng tăng thêm mỗi năm sau khi trừ hết chi phí cố định.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-card border border-hairline/60 px-4 py-2 text-center">
                  <div className="text-[11px] text-ink-secondary">Doanh Thu</div>
                  <div className="text-[14px] font-bold text-ink">
                    +{result.growth.revenueGrowthPct}%
                  </div>
                </div>
                <div className="rounded-xl bg-card border border-hairline/60 px-4 py-2 text-center">
                  <div className="text-[11px] text-ink-secondary">Lợi Nhuận Ròng</div>
                  <div className="text-[14px] font-extrabold text-emerald-600">
                    x{result.growth.netProfitMultiplier} lần
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-card/60 p-3 border border-hairline/40">
                <div className="text-[11px] text-ink-secondary">Khách/Tháng</div>
                <div className="text-[13px] font-bold text-ink mt-0.5">
                  {result.baseline.monthlyCustomers} ➔ <span className="text-accent">{result.projected.monthlyCustomers}</span>
                </div>
              </div>
              <div className="rounded-xl bg-card/60 p-3 border border-hairline/40">
                <div className="text-[11px] text-ink-secondary">Doanh Thu Năm</div>
                <div className="text-[13px] font-bold text-ink mt-0.5">
                  {formatVndCurrency(result.baseline.annualRevenue)} ➔ <span className="text-accent">{formatVndCurrency(result.projected.annualRevenue)}</span>
                </div>
              </div>
              <div className="rounded-xl bg-card/60 p-3 border border-hairline/40">
                <div className="text-[11px] text-ink-secondary">Lãi Gộp Năm</div>
                <div className="text-[13px] font-bold text-ink mt-0.5">
                  {formatVndCurrency(result.baseline.annualGrossProfit)} ➔ <span className="text-emerald-600 font-bold">{formatVndCurrency(result.projected.annualGrossProfit)}</span>
                </div>
              </div>
              <div className="rounded-xl bg-card/60 p-3 border border-hairline/40">
                <div className="text-[11px] text-ink-secondary">Lãi Ròng Năm</div>
                <div className="text-[13px] font-extrabold text-emerald-600 mt-0.5">
                  {formatVndCurrency(result.projected.annualNetProfit)}
                </div>
              </div>
            </div>

            {/* Variable Cost Financial Advisory Note */}
            <div
              data-testid="variable-cost-advisory"
              className="rounded-xl border border-hairline/50 bg-card p-3 sm:p-3.5 flex items-start gap-2.5 text-[12px] shadow-xs"
            >
              <div className="flex size-6 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0 mt-0.5">
                <AlertCircle size={14} />
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-ink flex items-center gap-2">
                  <span>Lưu ý tài chính &amp; Chi phí biến đổi:</span>
                  {result.growth.revenueGrowthPct > 40 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                      Tăng trưởng cao (+{result.growth.revenueGrowthPct}%)
                    </span>
                  )}
                </div>
                <p className="text-ink-secondary leading-relaxed">
                  Lưu ý: Mô hình giả định chi phí cố định (OPEX) không tăng. Khi doanh thu tăng &gt;40%{result.growth.revenueGrowthPct > 40 ? ` (hiện dự phóng: +${result.growth.revenueGrowthPct}%)` : ""}, khuyến nghị trích lập thêm 5-10% chi phí biến đổi cho nhân sự và logistics.
                </p>
              </div>
            </div>
          </div>

          {/* 5 Interactive Sliders & Baseline Inputs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-ink">
                5 Đòn Bẩy Tác Động (Kéo thanh trượt để thử nghiệm kịch bản)
              </h3>
              <span className="text-[11px] text-ink-secondary">
                *Đòn bẩy cải thiện nhờ nhân sự số vận hành
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lever 1: Leads */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink">1. Số Leads/tháng (L)</span>
                  <span className="font-extrabold text-accent">+{improvements.leadsPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={improvements.leadsPct}
                  onChange={(e) => handleSliderChange("leadsPct", Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                  <span>Gốc: {input.monthlyLeads} leads/tháng</span>
                  <span>Mục tiêu: {Math.round(input.monthlyLeads * (1 + improvements.leadsPct / 100))} leads</span>
                </div>
              </div>

              {/* Lever 2: Conversion Rate */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink">2. Tỷ Lệ Chốt Hợp Đồng (CR)</span>
                  <span className="font-extrabold text-accent">+{improvements.conversionRatePct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={improvements.conversionRatePct}
                  onChange={(e) => handleSliderChange("conversionRatePct", Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                  <span>Gốc: {input.conversionRatePct}%</span>
                  <span>Mục tiêu: {(input.conversionRatePct * (1 + improvements.conversionRatePct / 100)).toFixed(1)}%</span>
                </div>
              </div>

              {/* Lever 3: Average Order Value */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink">3. Giá Trị Đơn Trung Bình (AOV)</span>
                  <span className="font-extrabold text-accent">+{improvements.averageOrderValuePct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={improvements.averageOrderValuePct}
                  onChange={(e) => handleSliderChange("averageOrderValuePct", Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                  <span>Gốc: {formatVndCurrency(input.averageOrderValue)}</span>
                  <span>Mục tiêu: {formatVndCurrency(input.averageOrderValue * (1 + improvements.averageOrderValuePct / 100))}</span>
                </div>
              </div>

              {/* Lever 4: Purchase Frequency */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink">4. Tần Suất Mua Lặp Lại (F)</span>
                  <span className="font-extrabold text-accent">+{improvements.purchaseFrequencyPct}%</span>
                </div>

                {/* Purchase Cycle Selector */}
                <div className="flex items-center gap-1 p-0.5 bg-control/60 rounded-lg border border-hairline/40">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...input, purchaseCycle: "b2b_annual" as const };
                      setInput(next);
                      saveFiveLeversInput(next);
                    }}
                    className={cn(
                      "flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors text-center truncate",
                      (input.purchaseCycle ?? "b2b_annual") === "b2b_annual"
                        ? "bg-card text-ink shadow-xs font-semibold"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    Dự Án/B2B (Chu kỳ năm/Referral)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...input, purchaseCycle: "fmcg_monthly" as const };
                      setInput(next);
                      saveFiveLeversInput(next);
                    }}
                    className={cn(
                      "flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors text-center truncate",
                      input.purchaseCycle === "fmcg_monthly"
                        ? "bg-card text-ink shadow-xs font-semibold"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    F&amp;B/Bán Lẻ (Chu kỳ tháng)
                  </button>
                </div>

                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={improvements.purchaseFrequencyPct}
                  onChange={(e) => handleSliderChange("purchaseFrequencyPct", Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                  <span>
                    Gốc: {input.annualPurchaseFrequency}{" "}
                    {(input.purchaseCycle ?? "b2b_annual") === "b2b_annual" ? "lần/năm" : "lần/tháng"}
                  </span>
                  <span>
                    Mục tiêu: {(input.annualPurchaseFrequency * (1 + improvements.purchaseFrequencyPct / 100)).toFixed(2)}{" "}
                    {(input.purchaseCycle ?? "b2b_annual") === "b2b_annual" ? "lần/năm" : "lần/tháng"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-tertiary">
                  {(input.purchaseCycle ?? "b2b_annual") === "b2b_annual"
                    ? "Tăng F nhờ bảo dưỡng định kỳ, ký hợp đồng dài hạn & referral."
                    : "Tăng F nhờ combo định kỳ, thẻ thành viên & voucher tái mua tự động."}
                </div>
              </div>

              {/* Lever 5: Gross Margin */}
              <div className="rounded-xl border border-hairline/60 bg-card p-4 space-y-2.5 md:col-span-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-bold text-ink">5. Biên Lợi Nhuận Gộp (M)</span>
                  <span className="font-extrabold text-emerald-600">+{improvements.grossMarginPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={improvements.grossMarginPct}
                  onChange={(e) => handleSliderChange("grossMarginPct", Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                  <span>Gốc: {input.grossMarginPct}%</span>
                  <span>Mục tiêu: {(input.grossMarginPct * (1 + improvements.grossMarginPct / 100)).toFixed(1)}% (giữ giá sàn &amp; hạn chế chiết khấu)</span>
                </div>

                {/* 1-Click Apply Target to Vault Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-hairline/40">
                  <span className="text-[11px] text-ink-tertiary">
                    {syncTargetStatus || "Khóa giá sàn để bot không tự ý giảm giá khi thương lượng."}
                  </span>
                  <button
                    type="button"
                    onClick={handleSyncTargetMarginToVault}
                    disabled={isSyncingTarget}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-accent/20 transition-colors shrink-0"
                  >
                    <Check size={13} />
                    <span>Đồng bộ giá sàn &amp; biên LN vào Két Sắt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lever Ownership Cards (Connecting Levers to Bots) */}
          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-ink">
              Phân Công Nhân Sự Số Chịu Trách Nhiệm Kéo 5 Đòn Bẩy
            </h4>
            <div className="divide-y divide-hairline/40 rounded-xl border border-hairline/60 bg-card">
              {result.leverOwnership.map((item) => (
                <div key={item.leverKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-ink">
                        [{item.symbol}] {item.leverName}
                      </span>
                      <span className="rounded-md bg-control px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                        Zone {item.zone} ({item.departmentName})
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-secondary mt-1 leading-relaxed">
                      <strong className="text-ink">{item.recommendedAgentName}:</strong> {item.actionPlaybook}
                    </p>
                  </div>

                  {onHireDepartment && (
                    <button
                      type="button"
                      onClick={() => onHireDepartment(item.departmentCode, item.zone)}
                      className="ui-button ui-button-sm shrink-0 whitespace-nowrap"
                    >
                      <Plus size={13} />
                      Tuyển {item.recommendedAgentName}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Baseline Setup Drawer / Collapsible */}
          <details className="rounded-xl border border-hairline/50 bg-control/40 p-4 text-[12px]">
            <summary className="font-semibold text-ink cursor-pointer select-none">
              Tùy chỉnh thông số đầu vào gốc của doanh nghiệp bạn (Baseline P&L)
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-hairline/40">
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">Số Leads/tháng:</label>
                <input
                  type="number"
                  value={input.monthlyLeads}
                  onChange={(e) => handleInputChange("monthlyLeads", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">Tỷ lệ chốt đơn (%):</label>
                <input
                  type="number"
                  value={input.conversionRatePct}
                  onChange={(e) => handleInputChange("conversionRatePct", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">Giá trị đơn trung bình (VNĐ):</label>
                <input
                  type="number"
                  value={input.averageOrderValue}
                  onChange={(e) => handleInputChange("averageOrderValue", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">
                  Tần suất mua ({ (input.purchaseCycle ?? "b2b_annual") === "b2b_annual" ? "lần/năm" : "lần/tháng" }):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={input.annualPurchaseFrequency}
                  onChange={(e) => handleInputChange("annualPurchaseFrequency", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">Biên lợi nhuận gộp (%):</label>
                <input
                  type="number"
                  value={input.grossMarginPct}
                  onChange={(e) => handleInputChange("grossMarginPct", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-secondary block mb-1">Chi phí cố định OPEX/tháng (VNĐ):</label>
                <input
                  type="number"
                  value={input.fixedMonthlyOpex}
                  onChange={(e) => handleInputChange("fixedMonthlyOpex", Number(e.target.value))}
                  className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
            </div>
          </details>
        </div>

        {/* Footer matching Image 3 */}
        <footer className="flex flex-col-reverse sm:flex-row items-center justify-between border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 bg-card gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-ink-secondary hover:text-ink transition-colors w-full sm:w-auto justify-center sm:justify-start"
          >
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            {copied ? "Đã sao chép Kế hoạch P&L!" : "Sao chép Kế hoạch P&L"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors w-full sm:w-auto text-center"
          >
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
