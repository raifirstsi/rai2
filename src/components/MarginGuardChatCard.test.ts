import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MarginGuardChatCard } from "./MarginGuardChatCard";
import {
  isMarginGuardAlert,
  loadMarginApprovals,
  saveMarginApproval,
} from "@/lib/margin-guard";

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

vi.stubGlobal("localStorage", storage);
if (typeof window !== "undefined") {
  (window as unknown as { localStorage: typeof storage }).localStorage = storage;
}

describe("MarginGuardChatCard & Detection Helper", () => {
  beforeEach(() => {
    store.clear();
  });

  it("isMarginGuardAlert accurately detects Margin Guard warnings", () => {
    const alertMessage =
      "🛑 MARGIN GUARD CẢNH BÁO: Báo giá 35 triệu với chi phí vốn 25 triệu chỉ đạt biên lợi nhuận 28.57%, dưới ngưỡng an toàn 30%. CHỜ DUYỆT TỪ FOUNDER (HITL).";
    expect(isMarginGuardAlert(alertMessage)).toBe(true);

    const blockedMessage =
      "CHẶN BÁO GIÁ THEO MARGIN GUARD: Vi phạm chính sách biên lợi nhuận sàn.";
    expect(isMarginGuardAlert(blockedMessage)).toBe(true);

    const normalMessage = "Dự án thiết kế này có giá 35 triệu, thời gian 2 tuần.";
    expect(isMarginGuardAlert(normalMessage)).toBe(false);

    expect(isMarginGuardAlert("")).toBe(false);
  });

  it("renders MarginGuardChatCard with action buttons and metrics", () => {
    const text =
      "🛑 MARGIN GUARD CẢNH BÁO: Báo giá 35 triệu với chi phí vốn 25 triệu. HITL Escalation.";
    const onOpenMarginGuard = vi.fn();
    const onApproveException = vi.fn();

    const markup = renderToStaticMarkup(
      createElement(MarginGuardChatCard, {
        messageId: "test-msg-1",
        text,
        onOpenMarginGuard,
        onApproveException,
      })
    );

    expect(markup).toContain("Cầu Dao Margin Guard Kích Hoạt");
    expect(markup).toContain("HITL Escalation");
    expect(markup).toContain("Duyệt Ngoại Lệ (1-Chạm)");
    expect(markup).toContain("Kiểm Tra Giá Sàn");
    expect(markup).toContain("35.000.000 đ");
    expect(markup).toContain("25.000.000 đ");
  });

  it("saveMarginApproval persists approval and updates loadMarginApprovals", () => {
    expect(loadMarginApprovals()["test-msg-2"]).toBeUndefined();

    saveMarginApproval("test-msg-2", "Duyệt đặc biệt cho đối tác chiến lược");
    const approvals = loadMarginApprovals();
    expect(approvals["test-msg-2"]).toBeDefined();
    expect(approvals["test-msg-2"].note).toBe("Duyệt đặc biệt cho đối tác chiến lược");

    const markup = renderToStaticMarkup(
      createElement(MarginGuardChatCard, {
        messageId: "test-msg-2",
        text: "🛑 MARGIN GUARD CẢNH BÁO: Báo giá 40 triệu.",
      })
    );

    expect(markup).toContain("Đã được Người Sáng Lập duyệt ngoại lệ");
    expect(markup).not.toContain("Duyệt Ngoại Lệ (1-Chạm)");
  });
});
