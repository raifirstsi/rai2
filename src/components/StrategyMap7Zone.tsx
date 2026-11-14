import React, { useMemo } from "react";
import {
  Megaphone,
  TrendingUp,
  Wrench,
  HeartHandshake,
  DollarSign,
  GraduationCap,
  Compass,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { evaluateStrategyMap7Zones, ZoneEvaluation } from "@/lib/strategy-map";
import { loadSavedTocDiagnosis } from "@/lib/toc-detector";

interface StrategyMap7ZoneProps {
  activeBotIds?: string[];
  onHireDepartment?: (deptCode: string, zoneNumber?: number) => void;
  onOpenTocDiagnostic?: () => void;
  onSelectZone?: (zoneNumber: number) => void;
  className?: string;
}

const ZONE_ICONS: Record<string, React.ElementType> = {
  Megaphone,
  TrendingUp,
  Wrench,
  HeartHandshake,
  DollarSign,
  GraduationCap,
  Compass,
};

export function StrategyMap7Zone({
  activeBotIds = [],
  onHireDepartment,
  onOpenTocDiagnostic,
  onSelectZone,
  className = "",
}: StrategyMap7ZoneProps) {
  const tocDiagnosis = useMemo(() => loadSavedTocDiagnosis(), []);

  const summary = useMemo(() => {
    return evaluateStrategyMap7Zones({
      activeBotIds,
      tocDiagnosis,
    });
  }, [activeBotIds, tocDiagnosis]);

  return (
    <section
      data-strategy-map=""
      className={`rounded-2xl border border-hairline/60 bg-card p-5 shadow-sm space-y-5 ${className}`}
    >
      {/* Header Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-ink">
              Bản Đồ Chiến Lược 7 Vùng (7-Zone Strategy Map)
            </h3>
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
              RAI² Pipeline
            </span>
          </div>
          <p className="text-[12px] text-ink-secondary mt-0.5">
            Dòng chảy giá trị khép kín từ Tiếp thị $\rightarrow$ Bán hàng $\rightarrow$ Cung ứng $\rightarrow$ Chăm sóc $\rightarrow$ Dòng tiền.
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-hairline/40 bg-raised/40 px-3 py-1.5 text-center">
            <div className="text-[11px] text-ink-secondary">Độ Phủ 7 Vùng</div>
            <div className="text-[14px] font-extrabold text-ink">
              {summary.overallCoverageScore}%
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-center">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Vận Hành Tốt</div>
            <div className="text-[14px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary.healthyZonesCount} Vùng
            </div>
          </div>
          {summary.criticalZonesCount > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-center">
              <div className="text-[11px] text-red-700 dark:text-red-400">Điểm Nghẽn TOC</div>
              <div className="text-[14px] font-extrabold text-red-600 dark:text-red-400">
                Zone {summary.primaryBottleneckZone}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7-Zone Interactive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.zones.map((zone: ZoneEvaluation) => {
          const IconComp = ZONE_ICONS[zone.iconName] || Compass;
          const isTOC = zone.status === "CRITICAL_TOC";
          const isWarning = zone.status === "WARNING";
          const isHealthy = zone.status === "HEALTHY";

          return (
            <div
              key={zone.code}
              onClick={() => onSelectZone?.(zone.zoneNumber)}
              className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer ${
                isTOC
                  ? "border-red-500/60 bg-red-500/5 ring-2 ring-red-500/30 animate-pulse"
                  : isWarning
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-hairline/50 bg-control hover:border-hairline"
              }`}
            >
              <div>
                {/* Zone Top Bar */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isTOC
                          ? "bg-red-500/20 text-red-600 dark:text-red-400"
                          : isWarning
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      <IconComp size={16} />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-ink-secondary">
                      Zone {zone.zoneNumber}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isTOC && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-600 dark:text-red-400">
                      <AlertCircle size={11} />
                      ĐIỂM NGHẼN TOC
                    </span>
                  )}
                  {isWarning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      THIẾU NHÂN SỰ
                    </span>
                  )}
                  {isHealthy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={11} />
                      VẬN HÀNH TỐT
                    </span>
                  )}
                </div>

                {/* Zone Title & Description */}
                <h4 className="text-[13px] font-semibold text-ink line-clamp-1">{zone.name}</h4>
                <p className="text-[12px] text-ink-secondary mt-1 line-clamp-2 leading-relaxed">
                  {zone.description}
                </p>

                {/* Active Bot Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {zone.activeBotKeys.length > 0 ? (
                    zone.activeBotKeys.map((botKey) => (
                      <span
                        key={botKey}
                        className="rounded-md border border-hairline/40 bg-card px-2 py-0.5 font-mono text-[11px] font-medium text-ink"
                      >
                        @{botKey}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] italic text-ink-tertiary">
                      Chưa có nhân sự số nào phụ trách
                    </span>
                  )}
                </div>

                {/* TOC Warning Banner if applicable */}
                {zone.urgencyWarning && (
                  <div className="mt-3 rounded-lg bg-card/60 p-2 text-[11px] leading-relaxed text-ink-secondary border border-hairline/30">
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {zone.urgencyWarning}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Bottom Button */}
              <div className="mt-4 pt-3 border-t border-hairline/40 flex items-center justify-between">
                <span className="text-[11px] text-ink-tertiary">
                  Trọng số P&L: {(zone.weight * 100).toFixed(0)}%
                </span>
                {isTOC && onOpenTocDiagnostic ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTocDiagnostic();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors"
                  >
                    Khơi thông TOC
                  </button>
                ) : (
                  onHireDepartment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHireDepartment(zone.code, zone.zoneNumber);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-raised px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-raised-hover transition-colors"
                    >
                      <Plus size={12} />
                      {zone.activeAgentsCount > 0 ? "Tuyển thêm" : "Kích hoạt"}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
