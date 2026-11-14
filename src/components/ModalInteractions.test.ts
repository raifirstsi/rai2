import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StoreContext } from "@/state/store";
import { TocConstraintModal } from "./TocConstraintModal";
import { ContextVaultModal } from "./ContextVaultModal";
import { VoiceToSopModal } from "./VoiceToSopModal";
import { MarginGuardModal } from "./MarginGuardModal";
import { StrategyMapModal } from "./StrategyMapModal";
import { FridayPulseModal } from "./FridayPulseModal";
import { FiveLeversModal } from "./FiveLeversModal";
import { CompanyFingerprintModal } from "./CompanyFingerprintModal";
import { HireAgentDialog } from "./HireAgentDialog";

const mockStoreValue = {
  state: {
    bots: [
      { id: "rai-lead", name: "Rai Lead", section: "marketing" },
      { id: "rai-closer", name: "Rai Closer", section: "sales" },
    ],
  },
  dispatch: () => {},
  flushBotPatches: () => {},
  refreshInstances: () => {},
  refreshModels: () => {},
} as never;

function withStore(element: React.ReactElement) {
  return React.createElement(StoreContext.Provider, { value: mockStoreValue }, element);
}

describe("All 9 Business Modals - React Hook Consistency & Render Integrity", () => {
  it("renders TocConstraintModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(TocConstraintModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Bộ Bắt Điểm Nghẽn TOC");
  });

  it("renders ContextVaultModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(ContextVaultModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Két Sắt Ngữ Cảnh 8 Trụ Cột");
  });

  it("renders VoiceToSopModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(VoiceToSopModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Voice-to-SOP");
  });

  it("renders MarginGuardModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(MarginGuardModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Margin Guard");
  });

  it("renders StrategyMapModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(StrategyMapModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Bản Đồ Chiến Lược 7 Vùng");
  });

  it("renders FridayPulseModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(FridayPulseModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Báo Cáo Nhịp Thở Thứ Sáu");
  });

  it("renders FiveLeversModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(FiveLeversModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Mô Phỏng 5 Đòn Bẩy P&amp;L");
  });

  it("renders CompanyFingerprintModal without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(CompanyFingerprintModal, {
          isOpen: true,
          onClose: () => {},
        })
      )
    );
    expect(html).toContain("Hồ Sơ Doanh Nghiệp &amp; Sổ Giá Mẫu");
  });

  it("renders HireAgentDialog without hook error", () => {
    const html = renderToString(
      withStore(
        React.createElement(HireAgentDialog, {
          open: true,
          onClose: () => {},
          onSelectAgent: () => {},
        })
      )
    );
    expect(html).toContain("Kích Hoạt");
  });
});
