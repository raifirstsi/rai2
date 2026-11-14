import { useMemo } from "react";
import {
  Fuel,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
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
}

export function DataReadinessGauge({
  vaultData = {},
  onSelectPillar,
  className = "",
}: DataReadinessGaugeProps) {
  const result: DataReadinessResult = useMemo(() => {
    return evaluateDataReadiness(vaultData);
  }, [vaultData]);

  const isModerate = result.level.status === "MODERATE_HALF";
  const isReady = result.level.status === "READY_FULL";

  return (
    <div
      data-readiness-gauge=""
      className={`rounded-2xl border border-hairline/60 bg-card p-4 sm:p-5 shadow-xs space-y-4 ${className}`}
    >
      {/* Header Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
              isReady
                ? "bg-emerald-500/10 text-emerald-600"
                : isModerate
                ? "bg-amber-500/10 text-amber-600"
                : "bg-red-500/10 text-red-600"
            }`}
          >
            <Fuel size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-ink">
                Bình Nhiên Liệu Dữ Liệu (Data Readiness Fuel Gauge)
              </h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${result.level.badgeColor}`}
              >
                {`${result.totalScore}/20 Điểm (${result.fuelPct}%)`}
              </span>
            </div>
            <p className="text-[12px] text-ink-secondary">
              Đo lường độ sạch &amp; độ sâu tri thức trong Két Sắt để ngăn chặn 100% tình trạng AI ảo giác
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-semibold text-ink-secondary">
            {`Chuẩn tự hành: ${result.level.title}`}
          </span>
        </div>
      </div>

      {/* Segmented Fuel Bar */}
      <div className="space-y-1.5">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-control gap-0.5 p-0.5 border border-hairline/40">
          {Array.from({ length: 20 }).map((_, i) => {
            const isFilled = i < result.totalScore;
            let barColor = "bg-red-500";
            if (i >= 7 && i < 14) barColor = "bg-amber-500";
            if (i >= 14) barColor = "bg-emerald-500";

            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  isFilled ? barColor : "bg-transparent"
                }`}
                title={`Vạch ${i + 1}/20`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-ink-tertiary px-1">
          <span>0 (Trống trơn)</span>
          <span>8 (Nhiên liệu tạm đủ)</span>
          <span>14 (Sẵn sàng chiến đấu)</span>
          <span>20 (Tối ưu tuyệt đối)</span>
        </div>
      </div>

      {/* Advisory Callout */}
      <div
        className={`rounded-xl border p-3 text-[12px] leading-relaxed flex items-start gap-2.5 ${
          isReady
            ? "border-emerald-500/30 bg-emerald-500/5 text-ink"
            : isModerate
            ? "border-amber-500/30 bg-amber-500/5 text-ink"
            : "border-red-500/30 bg-red-500/5 text-ink"
        }`}
      >
        {isReady ? (
          <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
        ) : isModerate ? (
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p>{result.level.advice}</p>
        </div>
      </div>

      {/* 5 Fuel Chambers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {result.chambers.map((c: ChamberEvaluation) => {
          const isChamberSolid = c.score === 4;
          const isChamberFair = c.score === 3;
          const isChamberWeak = c.score === 2;

          return (
            <button
              key={c.chamberKey}
              type="button"
              onClick={() => onSelectPillar && onSelectPillar(c.pillarId)}
              className={`rounded-xl p-3 text-left border transition-all flex flex-col justify-between hover:border-accent ${
                isChamberSolid
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : isChamberFair
                  ? "border-emerald-500/20 bg-card"
                  : isChamberWeak
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-ink-secondary mb-1">
                  <span>{`Ngăn ${c.chamberNumber}`}</span>
                  <span
                    className={`font-extrabold ${
                      c.score >= 3
                        ? "text-emerald-600"
                        : c.score === 2
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {`${c.score}/4đ`}
                  </span>
                </div>
                <div className="text-[12px] font-bold text-ink line-clamp-1">
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

      {/* Quick Wins Checklist */}
      {result.quickWins.length > 0 && (
        <div className="border-t border-hairline/40 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent mb-1.5">
            <Sparkles size={13} />
            <span>Hành động nhanh để nâng điểm nhiên liệu:</span>
          </div>
          <ul className="space-y-1 text-[12px] text-ink-secondary">
            {result.quickWins.map((qw, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-accent">{idx + 1}.</span>
                <span>{qw}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
