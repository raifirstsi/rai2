export interface SuggestionItem {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
}

export interface OneClickSuggestionsProps {
  suggestions: SuggestionItem[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function OneClickSuggestions({ suggestions, onSelect, disabled }: OneClickSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      data-one-click-suggestions
      className="flex flex-wrap items-center gap-2 mt-2 pt-1 border-t border-[var(--border-subtle,rgba(255,255,255,0.06))]"
    >
      <span className="text-[11px] font-medium text-[var(--text-muted,#888)] mr-1">
        Goi y tiep theo:
      </span>
      {suggestions.slice(0, 3).map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item.prompt)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-[var(--border-subtle,rgba(255,255,255,0.1))] bg-[var(--bg-card,rgba(255,255,255,0.03))] hover:bg-[var(--bg-hover,rgba(255,255,255,0.08))] hover:border-[var(--border-hover,rgba(255,255,255,0.2))] transition-colors text-[var(--text-primary,#eee)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {item.icon && <span className="opacity-70 text-[11px]">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
