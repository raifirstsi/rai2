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
      className={`rounded-xl border border-hairline/60 bg-control/10 p-3.5 sm:p-5 space-y-4 ${className}`}
    >
      {/* Header Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline/40 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-ink">
              Bản Đồ Chiến Lược 7 Vùng
            </h3>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-accent">
              RAI² Pipeline
            </span>
          </div>
          <p className="text-[11px] sm:text-[12px] text-ink-secondary mt-0.5">
            Dòng chảy giá trị khép kín: Tiếp thị → Bán hàng → Cung ứng → Chăm sóc → Dòng tiền.
          </p>
        </div>

        {/* Quick KPI Badges - Clean Uniform Neutral */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-hairline/50 bg-control/50 px-2.5 py-1 text-center">
            <div className="text-[10px] text-ink-secondary">Độ Phủ</div>
            <div className="text-[13px] font-bold text-ink">
              {summary.overallCoverageScore}%
            </div>
          </div>
          <div className="rounded-lg border border-hairline/50 bg-control/50 px-2.5 py-1 text-center">
            <div className="text-[10px] text-ink-secondary">Vận Hành Tốt</div>
            <div className="text-[13px] font-bold text-ink">
              {summary.healthyZonesCount} Vùng
            </div>
          </div>
          {summary.criticalZonesCount > 0 && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-center">
              <div className="text-[10px] text-accent">Điểm Nghẽn TOC</div>
              <div className="text-[13px] font-bold text-accent">
                Zone {summary.primaryBottleneckZone}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7-Zone Interactive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {summary.zones.map((zone: ZoneEvaluation) => {
          const IconComp = ZONE_ICONS[zone.iconName] || Compass;
          const isTOC = zone.status === "CRITICAL_TOC";
          const isWarning = zone.status === "WARNING";
          const isHealthy = zone.status === "HEALTHY";

          return (
            <div
              key={zone.code}
              onClick={() => onSelectZone?.(zone.zoneNumber)}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all hover:shadow-xs cursor-pointer ${
                isTOC
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : isWarning
                  ? "border-hairline/70 bg-card"
                  : "border-hairline/50 bg-card hover:bg-control/30"
              }`}
            >
              <div>
                {/* Zone Top Bar */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <IconComp size={15} />
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-ink-secondary">
                      Zone {zone.zoneNumber}
                    </span>
                  </div>

                  {/* Status Badge - Subtle Clean Neutral */}
                  {isTOC && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <AlertCircle size={10} />
                      ĐIỂM NGHẼN TOC
                    </span>
                  )}
                  {isWarning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-control px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                      <AlertTriangle size={10} />
                      THIẾU NHÂN SỰ
                    </span>
                  )}
                  {isHealthy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-control px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                      <CheckCircle2 size={10} />
                      VẬN HÀNH TỐT
                    </span>
                  )}
                </div>

                {/* Zone Title & Description */}
                <h4 className="text-[13px] font-semibold text-ink line-clamp-1">{zone.name}</h4>
                <p className="text-[11px] text-ink-secondary mt-1 line-clamp-2 leading-relaxed">
                  {zone.description}
                </p>

                {/* Active Bot Tags */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  {zone.activeBotKeys.length > 0 ? (
                    zone.activeBotKeys.map((botKey) => (
                      <span
                        key={botKey}
                        className="rounded-md border border-hairline/40 bg-control/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink"
                      >
                        @{botKey}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] italic text-ink-tertiary">
                      Chưa có nhân sự phụ trách
                    </span>
                  )}
                </div>

                {/* TOC Warning Banner if applicable */}
                {zone.urgencyWarning && (
                  <div className="mt-2.5 rounded-lg bg-control/50 p-2 text-[11px] leading-relaxed text-ink border border-hairline/30">
                    <p className="font-medium text-accent">
                      {zone.urgencyWarning}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Bottom Button */}
              <div className="mt-3 pt-2.5 border-t border-hairline/40 flex items-center justify-between">
                <span className="text-[10px] text-ink-tertiary">
                  Trọng số: {(zone.weight * 100).toFixed(0)}%
                </span>
                {isTOC && onOpenTocDiagnostic ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTocDiagnostic();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    <span>Gỡ điểm nghẽn</span>
                    <TrendingUp size={11} />
                  </button>
                ) : onHireDepartment ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHireDepartment(zone.code, zone.zoneNumber);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-secondary hover:text-ink"
                  >
                    <Plus size={11} />
                    <span>Thêm nhân sự</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
