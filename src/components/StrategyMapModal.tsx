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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Bản Đồ Chiến Lược 7 Vùng"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-4xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Compass size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Bản Đồ Chiến Lược 7 Vùng
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Strategy 7-Zone
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Khung năng lực số toàn diện cho chuỗi giá trị doanh nghiệp.
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <StrategyMap7Zone
            activeBotIds={activeBotIds}
            activeBots={state.bots}
            onHireDepartment={onHireDepartment}
            onOpenTocDiagnostic={onOpenTocDiagnostic}
          />
        </div>

        {/* Footer Actions matching Image 3 */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          {onOpenFridayPulse ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFridayPulse();
              }}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline w-full sm:w-auto justify-center sm:justify-start"
            >
              <Activity size={14} />
              <span>Xem Báo Cáo Nhịp Thở 17:00 Thứ Sáu (ARI)</span>
            </button>
          ) : (
            <div />
          )}

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
