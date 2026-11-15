import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { activeLocale, t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { getBotAutonomyTier } from "@/lib/autonomy-graduation";
import { localizeRoleTitle } from "../../shared/team-templates-localization";
import type { Bot } from "@/state/store";

export function AutonomyTierBadge({
  botId,
  onClick,
  className,
}: {
  botId: string;
  onClick?: () => void;
  className?: string;
}) {
  const [tierMeta, setTierMeta] = useState(() => getBotAutonomyTier(botId));

  useEffect(() => {
    const update = () => setTierMeta(getBotAutonomyTier(botId));
    window.addEventListener("rai2:autonomy-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("rai2:autonomy-updated", update);
      window.removeEventListener("storage", update);
    };
  }, [botId]);

  return (
    <button
      type="button"
      data-testid="autonomy-tier-badge"
      title={`${tierMeta.name} · ${tierMeta.autonomyPct}% Tự trị - Nhấn để xem sát hạch & tốt nghiệp`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick();
        } else if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("rai2:open-autonomy-modal", { detail: { botId } })
          );
        }
      }}
      className={cn(
        "shrink-0 rounded border border-hairline/60 bg-control/40 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-tight text-ink-secondary hover:border-accent hover:text-ink transition-colors cursor-pointer",
        className
      )}
    >
      {tierMeta.code} · {tierMeta.autonomyPct}%
    </button>
  );
}

export function SidebarBotRole({ role }: { role: string }) {
  const localized = localizeRoleTitle(role, activeLocale());
  return (
    <span data-testid="bot-role" className="@container -ms-1.5 min-w-0 grow">
      <span title={localized} className="block truncate ps-1.5 text-[13px] font-normal leading-[18px] text-ink-secondary @max-[3rem]:sr-only">
        <span className="sr-only">, </span>{localized}
      </span>
    </span>
  );
}

export function ChatHeadRole({ bot }: { bot: Pick<Bot, "title" | "chiefOfStaff"> }) {
  const role = bot.title.trim();
  const localized = localizeRoleTitle(role, activeLocale());
  const repeatsChiefBadge = bot.chiefOfStaff && (role.toLocaleLowerCase() === t("chat.chiefOfStaff").toLocaleLowerCase() || localized.toLocaleLowerCase() === t("chat.chiefOfStaff").toLocaleLowerCase());
  if (!role || repeatsChiefBadge) return null;
  return (
    <span data-chathead-role className="flex min-w-0 max-w-fit grow basis-0">
      <span title={localized} className="max-w-[16rem] truncate text-[13px] text-ink-secondary">{localized}</span>
    </span>
  );
}

export function chiefOfStaffBadge(bot: Bot) {
  if (!bot.chiefOfStaff) return null;
  return (
    <span title={t("chat.chiefOfStaff")} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent @max-4xl/chathead:px-1.5">
      <Crown size={11} aria-hidden="true" /> <span className="@max-4xl/chathead:sr-only">{t("chat.chiefOfStaff")}</span>
    </span>
  );
}
