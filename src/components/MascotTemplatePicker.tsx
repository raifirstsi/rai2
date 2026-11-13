import { cn } from "@/lib/cn";
import { RAI_MASCOT_LIBRARY } from "../../shared/mascot-library";

export function MascotTemplatePicker({ selectedUrl, disabled, onSelect }: {
  selectedUrl?: string | null;
  disabled?: boolean;
  onSelect: (url: (typeof RAI_MASCOT_LIBRARY)[number]["url"]) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" data-mascot-template-gallery>
      {RAI_MASCOT_LIBRARY.map((mascot) => (
        <button
          key={mascot.id}
          type="button"
          disabled={disabled}
          aria-pressed={selectedUrl === mascot.url}
          aria-label={mascot.name}
          title={mascot.name}
          data-mascot-template={mascot.id}
          onClick={() => onSelect(mascot.url)}
          className={cn(
            "aspect-square overflow-hidden rounded-xl border bg-raised p-0.5 disabled:opacity-50",
            selectedUrl === mascot.url
              ? "border-ink/40 ring-2 ring-ink/25"
              : "border-hairline/40 hover:border-ink/25 hover:bg-control",
          )}
        >
          <img src={mascot.url} alt="" className="size-full rounded-[10px] object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  );
}
