import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { FiveLeversModal } from "./FiveLeversModal";

describe("FiveLeversModal - Component Rendering & Presets", () => {
  it("renders null when isOpen is false", () => {
    const html = renderToString(
      React.createElement(FiveLeversModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toBe("");
  });

  it("renders 5-lever compounding simulator modal when isOpen is true", () => {
    const html = renderToString(
      React.createElement(FiveLeversModal, {
        isOpen: true,
        onClose: () => {},
      })
    );

    expect(html).toContain("Mô Phỏng 5 Đòn Bẩy P&amp;L");
    expect(html).toContain("KẾT QUẢ TĂNG TRƯỞNG KÉP DỰ BÁO");
    expect(html).toContain("Số Leads/tháng (L)");
    expect(html).toContain("Tỷ Lệ Chốt Hợp Đồng (CR)");
    expect(html).toContain("Giá Trị Đơn Trung Bình (AOV)");
    expect(html).toContain("Tần Suất Mua Lặp Lại (F)");
    expect(html).toContain("Biên Lợi Nhuận Gộp (M)");
    expect(html).toContain("RAI Lead");
    expect(html).toContain("RAI Quote");
    expect(html).toContain("Sao chép Kế hoạch P&amp;L");
  });
});
