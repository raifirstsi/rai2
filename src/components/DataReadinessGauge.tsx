import { useState, useMemo } from "react";
import {
  Fuel,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  evaluateDataReadiness,
  type DataReadinessResult,
  type ChamberEvaluation,
} from "@/lib/data-readiness";

export interface DataReadinessGaugeProps {
  vaultData?: Record<string, string>;
  onSelectPillar?: (pillarId: string) => void;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function DataReadinessGauge({
  vaultData = {},
  onSelectPillar,
  className = "",
  collapsible = true,
  defaultExpanded = true,
}: DataReadinessGaugeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const result: DataReadinessResult = useMemo(() => {
    return evaluateDataReadiness(vaultData);
  }, [vaultData]);

  return (
    <div
      data-readiness-gauge=""
      className={`rounded-xl border border-hairline/60 bg-control/20 p-3 sm:p-4 space-y-2.5 sm:space-y-3 transition-all ${className}`}
    >
      {/* Header Overview */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
            <Fuel size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] sm:text-[14px] font-semibold text-ink truncate">
                Bình Nhiên Liệu Dữ Liệu
              </h3>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-accent shrink-0">
                {`${result.totalScore}/20 Điểm (${result.fuelPct}%)`}
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary truncate hidden xs:block sm:block">
              Đo lường độ sâu tri thức để ngăn AI ảo giác
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-ink-secondary hidden sm:inline">
            {`Chuẩn: ${result.level.title}`}
          </span>
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline/60 bg-card px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-control/60 transition-colors cursor-pointer"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Thu gọn bình nhiên liệu" : "Mở rộng bình nhiên liệu"}
            >
              <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Clean Single Accent Progress Bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-control border border-hairline/40">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${result.fuelPct}%` }}
          />
        </div>
        {isExpanded && (
          <div className="flex justify-between text-[10px] text-ink-tertiary px-0.5">
            <span>0 (Trống)</span>
            <span>8 (Tạm đủ)</span>
            <span>14 (Sẵn sàng)</span>
            <span>20 (Tối ưu)</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Advisory Callout - Clean Neutral Minimal Tone */}
          <div className="rounded-lg border border-hairline/50 bg-card p-2.5 text-[11px] sm:text-[12px] leading-relaxed flex items-start gap-2 text-ink-secondary">
            <ShieldCheck size={15} className="text-accent shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-ink text-[11px] sm:text-[12px]">{result.level.advice}</p>
            </div>
          </div>

          {/* 5 Fuel Chambers Grid - Clean Uniform Neutral Cards (No Rainbow Colors) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {result.chambers.map((c: ChamberEvaluation, idx: number) => {
              return (
                <button
                  key={c.chamberKey}
                  type="button"
                  onClick={() => onSelectPillar && onSelectPillar(c.pillarId)}
                  className={`rounded-lg p-2.5 text-left border border-hairline/60 bg-card hover:bg-control/50 transition-all flex flex-col justify-between hover:border-hairline ${
                    idx === 4 ? "col-span-2 sm:col-span-1" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-medium text-ink-secondary mb-1">
                      <span>{`Ngăn ${c.chamberNumber}`}</span>
                      <span className="font-semibold text-ink rounded bg-control px-1.5 py-0.5 text-[10px]">
                        {`${c.score}/4đ`}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-[12px] font-medium text-ink line-clamp-1">
                      {c.chamberName}
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-ink-secondary flex items-center justify-between">
                    <span className="truncate">{c.recommendation}</span>
                    {onSelectPillar && <ArrowRight size={11} className="shrink-0 text-accent" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Wins Checklist - Subtle Neutral */}
          {result.quickWins.length > 0 && (
            <div className="border-t border-hairline/40 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary mb-1">
                <Sparkles size={12} className="text-accent" />
                <span>Hành động đề xuất nâng điểm:</span>
              </div>
              <ul className="space-y-0.5 text-[11px] text-ink-secondary">
                {result.quickWins.slice(0, 3).map((qw, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="font-medium text-ink-tertiary">{idx + 1}.</span>
                    <span className="truncate">{qw}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
