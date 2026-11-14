import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { FridayPulseModal } from "./FridayPulseModal";
import { computeFridayPulseReport, formatFridayPulseMarkdown } from "@/lib/friday-pulse";

vi.mock("@/state/store", () => ({
  useStore: () => ({
    state: {
      bots: [{ id: "bot-1", name: "RAI Lead", tasks: [] }],
    },
  }),
}));

vi.mock("./CompanyFingerprintModal", () => ({
  loadSavedFingerprint: () => ({ targetNetMargin: 42, companyName: "Test Co" }),
}));

describe("FridayPulseModal - Component & Contract", () => {
  it("exports FridayPulseModal functional component", () => {
    expect(typeof FridayPulseModal).toBe("function");
  });

  it("renders modal structure with dynamic target margin when isOpen is true", () => {
    const html = renderToString(
      React.createElement(FridayPulseModal, {
        isOpen: true,
        onClose: () => {},
      })
    );

    expect(html).toContain("Báo Cáo Nhịp Thở Thứ Sáu 17:00");
    expect(html).toContain("Thước đo Sẵn sàng Vắng mặt ($ARI$)");
  });

  it("computes Friday Pulse report and formats markdown without error", () => {
    const report = computeFridayPulseReport({
      activeBotIds: ["rai-lead", "rai-quote"],
      backlogCount: 0,
      customMarginScore: 40,
    });

    expect(report.absenceReadinessScore).toBeGreaterThan(0);
    expect(report.absenceLevel.title).toBeTruthy();
    expect(report.singlePriorityForNextWeek).toBeTruthy();

    const md = formatFridayPulseMarkdown(report);
    expect(md).toContain("BÁO CÁO NHỊP THỞ THỨ SÁU 17:00");
    expect(md).toContain(report.weekDisplay);
  });
});
