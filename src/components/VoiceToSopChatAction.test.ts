import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExtractSopAction } from "./MessageActions";
import { useBotMessageMenu, userMessageMenu } from "./message-menu";

describe("ExtractSopAction & Chat Message Actions", () => {
  it("renders ExtractSopAction with proper button title and icon", () => {
    const handleExtract = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(ExtractSopAction, { onExtract: handleExtract })
    );

    expect(markup).toContain('aria-label="Đóng gói SOP"');
    expect(markup).toContain('title="Đóng gói thành SOP chuẩn 4 phần (Voice-to-SOP)"');
  });

  it("includes extract-sop item in userMessageMenu when onExtractSop is provided", () => {
    const onExtractSop = vi.fn();
    const items = userMessageMenu({
      messageId: "msg-123",
      onExtractSop,
    });

    const sopItem = items.find((item) => item.key === "extract-sop");
    expect(sopItem).toBeDefined();
    expect(sopItem?.label).toContain("Đóng gói SOP (Voice-to-SOP)");

    sopItem?.onSelect();
    expect(onExtractSop).toHaveBeenCalledTimes(1);
  });

  it("includes extract-sop item in useBotMessageMenu when onExtractSop is provided", () => {
    let capturedItems: ReturnType<typeof useBotMessageMenu> = [];
    const onExtractSop = vi.fn();

    function TestComponent() {
      capturedItems = useBotMessageMenu({
        text: "Các bước giải quyết sự cố bàn giao thiết kế...",
        messageId: "msg-456",
        tts: undefined,
        localVoice: false,
        canSpeak: false,
        viewRaw: false,
        onToggleRaw: vi.fn(),
        onExtractSop,
      });
      return null;
    }

    renderToStaticMarkup(createElement(TestComponent));

    const sopItem = capturedItems.find((item) => item.key === "extract-sop");
    expect(sopItem).toBeDefined();
    expect(sopItem?.label).toContain("Đóng gói SOP (Voice-to-SOP)");

    sopItem?.onSelect();
    expect(onExtractSop).toHaveBeenCalledTimes(1);
  });
});
