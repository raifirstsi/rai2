import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StrategyMapModal } from "./StrategyMapModal";

// Mock zustand store
vi.mock("@/state/store", () => ({
  useStore: () => ({
    state: {
      bots: [{ id: "bot-1", key: "general_manager" }],
      threads: [],
    },
  }),
}));

describe("StrategyMapModal Component", () => {
  it("renders null when isOpen is false", () => {
    const html = renderToString(
      React.createElement(StrategyMapModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toBe("");
  });

  it("renders modal structure and 7-zone strategy map when isOpen is true", () => {
    const html = renderToString(
      React.createElement(StrategyMapModal, {
        isOpen: true,
        onClose: () => {},
        onOpenFridayPulse: () => {},
      })
    );

    expect(html).toContain("Bản Đồ Chiến Lược 7 Vùng");
    expect(html).toContain("data-strategy-map");
    expect(html).toContain("Báo Cáo Nhịp Thở 17:00");
  });
});
