import { Component, type ErrorInfo, type ReactNode } from "react";

import { t } from "@/lib/i18n";

// React unmounts everything below a root that has no error boundary when a render or an effect throws (react.dev,
// "Catching rendering errors with an error boundary"), which left a page showing only the body's background.
export class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null; componentStack: string | null }> {
  state: { error: Error | null; componentStack: string | null } = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)), componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PageBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const detail = [this.state.error.stack, this.state.componentStack].filter(Boolean).join("\n");
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="text-lg font-semibold">{t("page.broken.title")}</h1>
          <p className="text-sm opacity-75">{t("page.broken.body")}</p>
          <p className="break-words text-xs opacity-60">{this.state.error.message}</p>
          {detail && (
            <details className="rounded-md border border-hairline/40 bg-raised/50 p-2 text-left text-[11px] opacity-75">
              <summary className="cursor-pointer select-none font-medium">Chi tiết kỹ thuật</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono">{detail}</pre>
            </details>
          )}
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => location.reload()}>
            {t("page.broken.reload")}
          </button>
        </div>
      </div>
    );
  }
}
