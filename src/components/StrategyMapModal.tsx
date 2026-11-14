import { useMemo } from "react";
import { X, Compass, Activity } from "lucide-react";
import { useStore } from "@/state/store";
import { StrategyMap7Zone } from "./StrategyMap7Zone";

export interface StrategyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHireDepartment?: (deptCode: string, zoneNumber?: number) => void;
  onOpenTocDiagnostic?: () => void;
  onOpenFridayPulse?: () => void;
}

export function StrategyMapModal({
  isOpen,
  onClose,
  onHireDepartment,
  onOpenTocDiagnostic,
  onOpenFridayPulse,
}: StrategyMapModalProps) {
  const { state } = useStore();

  const activeBotIds = useMemo(() => {
    return (state.bots || []).flatMap((b) => [
      b.id,
      b.name,
      b.title,
      (b as any).role,
      b.section,
    ].filter(Boolean) as string[]);
  }, [state.bots]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Bản Đồ Chiến Lược 7 Vùng"
    >
      <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] max-w-4xl sm:rounded-2xl border-0 sm:border border-hairline/70 bg-card p-4 sm:p-6 shadow-2xl flex flex-col overflow-hidden transition-all">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 sm:right-5 top-4 sm:top-5 rounded-lg p-2 text-ink-tertiary hover:bg-raised hover:text-ink transition-colors z-10"
          aria-label="Đóng"
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 sm:pb-4 border-b border-hairline/60 shrink-0 pr-8">
          <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
            <Compass className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink truncate">
              Bản Đồ Chiến Lược 7 Vùng (7-Zone Strategy Map)
            </h2>
            <p className="text-[11px] sm:text-xs text-ink-secondary line-clamp-1">
              Khung năng lực số toàn diện cho doanh nghiệp 5–20 nhân sự (The AI-First Company)
            </p>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4">
          <StrategyMap7Zone
            activeBotIds={activeBotIds}
            onHireDepartment={onHireDepartment}
            onOpenTocDiagnostic={onOpenTocDiagnostic}
          />
        </div>

        {/* Footer Actions */}
        <div className="mt-3 flex items-center justify-between border-t border-hairline/60 pt-3 shrink-0">
          {onOpenFridayPulse ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFridayPulse();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <Activity className="size-3.5" />
              Xem Báo Cáo Nhịp Thở 17:00 Thứ Sáu ($ARI$)
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button-secondary text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
