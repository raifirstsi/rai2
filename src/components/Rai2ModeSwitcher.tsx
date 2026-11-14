import { useRai2Mode, type Rai2OperatingMode } from "@/lib/rai2-mode";
import { Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface Rai2ModeSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function Rai2ModeSwitcher({
  compact = false,
  className = "",
}: Rai2ModeSwitcherProps) {
  const { mode, setMode } = useRai2Mode();

  const handleSelect = (nextMode: Rai2OperatingMode) => {
    setMode(nextMode);
  };

  if (compact) {
    return (
      <div
        data-rai2-mode-switcher=""
        className={cn("flex items-center justify-center gap-1 p-1", className)}
      >
        <button
          type="button"
          onClick={() => handleSelect("creator")}
          title="Chế độ Tạo Bot Tự Do (Thoải mái tạo bot)"
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-all",
            mode === "creator"
              ? "bg-accent text-white shadow-xs"
              : "text-ink-secondary hover:bg-raised hover:text-ink"
          )}
        >
          <Sparkles size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleSelect("enterprise")}
          title="Chế độ Doanh Nghiệp (RAI² Enterprise OS)"
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-all",
            mode === "enterprise"
              ? "bg-accent text-white shadow-xs"
              : "text-ink-secondary hover:bg-raised hover:text-ink"
          )}
        >
          <Crown size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      data-rai2-mode-switcher=""
      className={cn(
        "flex w-full items-center rounded-xl border border-hairline/60 bg-control/60 p-0.5 text-[12px] font-semibold transition-all",
        className
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
            : "text-ink-secondary hover:text-ink hover:bg-card/50"
        )}
      >
        <Sparkles size={13} className={mode === "creator" ? "text-accent" : "text-ink-secondary"} />
        <span className="truncate">Tạo Bot Tự Do</span>
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
            : "text-ink-secondary hover:text-ink hover:bg-card/50"
        )}
      >
        <Crown size={13} className={mode === "enterprise" ? "text-amber-500" : "text-ink-secondary"} />
        <span className="truncate">Enterprise OS</span>
      </button>
    </div>
  );
}
