import { useEffect, useState, useMemo } from "react";
import { ShieldAlert, Check, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  extractQuoteMetricsFromText,
  loadMarginApprovals,
  saveMarginApproval,
} from "@/lib/margin-guard";

export interface MarginGuardChatCardProps {
  messageId: string;
  text: string;
  onOpenMarginGuard?: (metrics: { price?: number; costs?: number }) => void;
  onApproveException?: (messageId: string) => void;
}

export function MarginGuardChatCard({
  messageId,
  text,
  onOpenMarginGuard,
  onApproveException,
}: MarginGuardChatCardProps) {
  const [approval, setApproval] = useState(() => loadMarginApprovals()[messageId]);

  useEffect(() => {
    const handleUpdate = () => {
      setApproval(loadMarginApprovals()[messageId]);
    };
    window.addEventListener("rai2:margin-approval-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rai2:margin-approval-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [messageId]);

  const metrics = useMemo(() => extractQuoteMetricsFromText(text), [text]);

  const handleApprove = () => {
    saveMarginApproval(messageId);
    setApproval({ approvedAt: new Date().toISOString() });
    if (onApproveException) {
      onApproveException(messageId);
    }
  };

  const isApproved = Boolean(approval);

  return (
    <div
      data-testid="margin-guard-chat-card"
      className="mt-2.5 w-full max-w-xl rounded-xl border border-hairline/60 bg-card p-3 sm:p-3.5 shadow-sm text-ink transition-colors"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
            <ShieldAlert size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-ink truncate">
                Cầu Dao Margin Guard Kích Hoạt
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.2 font-mono text-[10px] font-medium text-amber-600 dark:text-amber-400">
                HITL Escalation
              </span>
            </div>
            <p className="text-[11px] text-ink-secondary truncate">
              Báo giá có tỷ suất lợi nhuận chạm hoặc dưới ngưỡng an toàn tài chính.
            </p>
          </div>
        </div>
      </div>

      {metrics.proposedPrice !== undefined && (
        <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-hairline/40 bg-control/40 px-2.5 py-1.5 font-mono text-[11px] text-ink-secondary flex-wrap">
          <span>
            Giá đề xuất:{" "}
            <strong className="text-ink">
              {metrics.proposedPrice.toLocaleString("vi-VN")} đ
            </strong>
          </span>
          {metrics.directCosts !== undefined && (
            <span>
              Chi phí vốn:{" "}
              <strong className="text-ink">
                {metrics.directCosts.toLocaleString("vi-VN")} đ
              </strong>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isApproved ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Đã được Người Sáng Lập duyệt ngoại lệ</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleApprove}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-accent/90 transition-colors cursor-pointer"
          >
            <Check size={14} />
            <span>Duyệt Ngoại Lệ (1-Chạm)</span>
          </button>
        )}

        {onOpenMarginGuard && (
          <button
            type="button"
            onClick={() => onOpenMarginGuard({ price: metrics.proposedPrice, costs: metrics.directCosts })}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline/60 bg-control/40 px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-raised transition-colors cursor-pointer"
          >
            <TrendingUp size={14} className="text-accent" />
            <span>Kiểm Tra Giá Sàn</span>
          </button>
        )}
      </div>
    </div>
  );
}
