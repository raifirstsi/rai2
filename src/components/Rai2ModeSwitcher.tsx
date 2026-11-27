import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { activeLocale } from "@/lib/i18n";
import { useRai2Mode, syncRai2PlanSnapshot, type Rai2OperatingMode } from "@/lib/rai2-mode";
import { api } from "@/state/store";
import type { Rai2PlanStatus } from "@/state/config-status";
import { Sparkles, Crown, Lock, Check, RefreshCw, X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface Rai2ModeSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function openRai2VipUpgradeModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rai2:open-vip-modal"));
  }
}

export function Rai2ModeSwitcher({
  compact = false,
  className = "",
}: Rai2ModeSwitcherProps) {
  const { mode, setMode, enterpriseAllowed, plan, trialDaysLeft } = useRai2Mode();
  const isEn = activeLocale().toLowerCase().startsWith("en");
  const personalLabel = isEn ? "Personal" : "Cá nhân";
  const enterpriseLabel = "Enterprise";
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenVip = () => {
      setCheckNote(null);
      setVipModalOpen(true);
    };
    window.addEventListener("rai2:open-vip-modal", onOpenVip);
    return () => window.removeEventListener("rai2:open-vip-modal", onOpenVip);
  }, []);

  const handleSelect = (nextMode: Rai2OperatingMode) => {
    if (nextMode === "enterprise" && !enterpriseAllowed) {
      setCheckNote(null);
      setVipModalOpen(true);
      return;
    }
    setMode(nextMode);
  };

  const handleRefreshPlan = async () => {
    setCheckingPlan(true);
    setCheckNote(null);
    try {
      const resp = await api<{ ok?: boolean; plan?: Rai2PlanStatus }>("/api/rai2/entitlement/refresh", {
        method: "POST",
      });
      if (resp?.plan) {
        syncRai2PlanSnapshot(resp.plan);
        if (resp.plan.enterpriseAccess) {
          setMode("enterprise");
          setVipModalOpen(false);
          return;
        }
        setCheckNote("Tài khoản hiện vẫn ở gói Cá Nhân (Starter). Hãy hoàn tất nâng cấp VIP trước khi thử lại.");
      }
    } catch {
      setCheckNote("Chưa thể đồng bộ trạng thái gói lúc này. Vui lòng thử lại sau.");
    } finally {
      setCheckingPlan(false);
    }
  };

  const upgradeUrl = plan?.upgradeUrl || "https://app.rai2.si/?plan=vip&checkout=1";

  const vipModal =
    vipModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="ui-scrim fixed inset-0 z-[90] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Nâng cấp Enterprise VIP"
            onClick={() => setVipModalOpen(false)}
          >
            <div
              className="ui-modal w-full max-w-[540px] p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-hairline/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                    <Crown size={20} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink">
                      Mở khóa Chế độ Enterprise (Doanh nghiệp · Gói VIP)
                    </h3>
                    <p className="text-[12px] text-ink-secondary">
                      Chế độ Cá nhân thuộc gói Personal (299k/tháng). Chế độ Enterprise (Doanh nghiệp 7 Vùng) dành riêng cho gói VIP.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVipModalOpen(false)}
                  className="ui-icon-button shrink-0"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 rounded-xl border border-hairline/50 bg-card p-4 text-[13px]">
                <p className="font-semibold text-ink">Quyền lợi độc quyền trong Enterprise VIP (1.990.000đ/tháng):</p>
                {[
                  "Tuyển & Onboarding Nhân Sự Số chuẩn 7 Vùng Nghiệp Vụ TOC",
                  "Két Sắt Ngữ Cảnh 8 Trụ Cột & Đóng gói SOP từ giọng nói (Voice-to-SOP)",
                  "Cầu dao Margin Guard, Sát hạch Bot (/21) & Promotion Gate Tier 1 → Tier 3",
                  "Nhịp thở kinh doanh 08:30 & 17:00 Zalo, DuckDB Analytics cô lập & Merkle Audit",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2 text-ink-secondary">
                    <Check size={14} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              {checkNote && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
                  {checkNote}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={checkingPlan}
                  onClick={() => void handleRefreshPlan()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline/60 px-3.5 py-2 text-[13px] font-medium text-ink-secondary hover:bg-control hover:text-ink disabled:opacity-50"
                >
                  <RefreshCw size={14} className={checkingPlan ? "animate-spin" : ""} />
                  <span>Kiểm tra lại trạng thái gói</span>
                </button>
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-button ui-button-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
                >
                  <span>Nâng cấp Enterprise VIP</span>
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (compact) {
    return (
      <>
        <div
          data-rai2-mode-switcher=""
          className={cn("flex items-center justify-center gap-1 p-1", className)}
        >
          <button
            type="button"
            onClick={() => handleSelect("creator")}
            title={isEn ? "Personal Mode" : "Chế độ Cá nhân"}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-all",
              mode === "creator"
                ? "bg-accent text-white shadow-xs"
                : "text-ink-secondary hover:bg-raised hover:text-ink",
            )}
          >
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleSelect("enterprise")}
            title={enterpriseAllowed ? (isEn ? "Business Mode (Enterprise)" : "Chế độ Doanh nghiệp (Enterprise)") : (isEn ? "Enterprise (VIP required)" : "Enterprise (Chỉ dành cho gói VIP)")}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-lg transition-all",
              mode === "enterprise"
                ? "bg-accent text-white shadow-xs"
                : "text-ink-secondary hover:bg-raised hover:text-ink",
              !enterpriseAllowed && "opacity-75",
            )}
          >
            {enterpriseAllowed ? <Crown size={16} /> : <Lock size={15} className="text-amber-500" />}
          </button>
        </div>
        {vipModal}
      </>
    );
  }

  return (
    <>
      <div
        data-rai2-mode-switcher=""
        className={cn(
          "flex w-full items-center rounded-xl border border-hairline/60 bg-control/60 p-0.5 text-[12px] font-semibold transition-all",
          className,
        )}
        role="radiogroup"
        aria-label="Chế độ vận hành RAI²"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "creator"}
          onClick={() => handleSelect("creator")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 transition-all select-none",
            mode === "creator"
              ? "bg-card text-ink shadow-xs font-bold"
              : "text-ink-secondary hover:text-ink hover:bg-card/50",
          )}
        >
          <Sparkles size={13} className={mode === "creator" ? "text-accent" : "text-ink-secondary"} />
          <span className="truncate">{personalLabel}</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={mode === "enterprise"}
          onClick={() => handleSelect("enterprise")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 transition-all select-none",
            mode === "enterprise"
              ? "bg-card text-ink shadow-xs font-bold"
              : "text-ink-secondary hover:text-ink hover:bg-card/50",
          )}
        >
          {enterpriseAllowed ? (
            <Crown size={13} className={mode === "enterprise" ? "text-amber-500" : "text-ink-secondary"} />
          ) : (
            <Lock size={12} className="text-amber-500 shrink-0" />
          )}
          <span className="truncate">{enterpriseLabel}</span>
          {!enterpriseAllowed ? (
            <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
              VIP
            </span>
          ) : (
            trialDaysLeft !== null && (
              <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] font-semibold text-accent-text">
                {trialDaysLeft}d
              </span>
            )
          )}
        </button>
      </div>
      {vipModal}
    </>
  );
}

