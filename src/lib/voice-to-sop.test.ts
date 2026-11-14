import { describe, it, expect, beforeEach } from "vitest";
import {
  compileMonologueToSop,
  formatSopToMarkdown,
  appendSopToVaultMarkdown,
  saveSopToVault,
  ExtractedSop,
} from "./voice-to-sop";

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => {
    store[key] = String(val);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
  key: () => null,
  length: 0,
};

// Polyfill window & localStorage
if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = { localStorage: mockLocalStorage };
} else {
  (globalThis.window as unknown as { localStorage: unknown }).localStorage = mockLocalStorage;
}

describe("voice-to-sop - Monologue to 4-Part SOP Compilation", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const mockMonologue = `
Quy trình Xử lý Khiếu nại Giao hàng Trễ
Khi khách hàng phàn nàn đơn hàng bị giao trễ quá 24 giờ.
Bước 1: Kiểm tra mã vận đơn trên hệ thống đối soát kho và gọi điện cho đơn vị vận chuyển.
Bước 2: Gọi điện thoại xin lỗi khách hàng trong vòng 15 phút và thông báo thời gian nhận mới.
Bước 3: Tặng mã giảm giá 10% cho đơn hàng tiếp theo.
Lưu ý: Tuyệt đối không được đổ lỗi cho đối tác vận chuyển trước mặt khách hàng.
Cấm hoàn tiền mặt nếu đơn hàng vẫn đang trong quá trình vận chuyển.
Hoàn thành khi khách hàng đồng ý nhận hàng theo lịch hẹn mới và trạng thái khiếu nại chuyển sang Đã giải quyết.
  `;

  it("compiles unstructured monologue into 4-part structured SOP", () => {
    const sop = compileMonologueToSop(mockMonologue);

    expect(sop.title).toBe("Quy trình Xử lý Khiếu nại Giao hàng Trễ");
    expect(sop.category).toBe("support");
    expect(sop.trigger).toContain("giao trễ quá 24 giờ");
    expect(sop.steps.length).toBeGreaterThanOrEqual(3);
    expect(sop.guardrails.length).toBeGreaterThanOrEqual(1);
    expect(sop.definitionOfDone).toContain("Đã giải quyết");
  });

  it("formats SOP to clear Markdown document with all sections", () => {
    const sop = compileMonologueToSop(mockMonologue);
    const md = formatSopToMarkdown(sop);

    expect(md).toContain("### Quy trình Xử lý Khiếu nại Giao hàng Trễ");
    expect(md).toContain("#### 1. Bối cảnh & Điều kiện kích hoạt (Trigger)");
    expect(md).toContain("#### 2. Các bước thực thi tuần tự (Execution Checklist)");
    expect(md).toContain("#### 3. Ranh giới cấm & Quy tắc an toàn (Guardrails & Limits)");
    expect(md).toContain("#### 4. Tiêu chuẩn hoàn thành (Definition of Done)");
    expect(md).toContain("⚠️ Tuyệt đối không được đổ lỗi");
  });

  it("appends new SOP to existing vault SOPs markdown without duplicates", () => {
    const initialVaultSops = "# STANDARD OPERATING PROCEDURES (SOP)\n- Bước tiếp nhận ban đầu";
    const sop = compileMonologueToSop(mockMonologue);

    const merged1 = appendSopToVaultMarkdown(initialVaultSops, sop);
    expect(merged1).toContain("# STANDARD OPERATING PROCEDURES (SOP)");
    expect(merged1).toContain("### Quy trình Xử lý Khiếu nại Giao hàng Trễ");

    // Second append should not duplicate
    const merged2 = appendSopToVaultMarkdown(merged1, sop);
    expect(merged2.trim()).toBe(merged1.trim());
  });

  it("saves SOP into Context Vault storage and updates the sops pillar", () => {
    const sop: ExtractedSop = {
      id: "SOP-TEST-01",
      title: "Quy trình Bàn giao Hồ sơ Dự án",
      category: "delivery",
      trigger: "Khi khách hàng thanh toán đợt cuối 30%.",
      steps: ["Xuất file PDF hoàn công", "Gửi email xác nhận bàn giao"],
      guardrails: ["Không giao mã nguồn trước khi nhận đủ 100% tiền"],
      definitionOfDone: "Khách hàng ký biên bản bàn giao",
      createdAt: new Date().toISOString(),
    };

    const { updatedContents, sopMarkdown } = saveSopToVault(sop, {
      brand_voice: "DNA",
      customer_avatar: "Avatar",
      offer_breakdown: "Offer",
      competitive_positioning: "Positioning",
      sales_process: "Sales",
      case_studies: "Cases",
      sops: "Initial SOPs",
      industry_context: "Industry",
    });

    expect(updatedContents.sops).toContain("SOP-TEST-01");
    expect(updatedContents.sops).toContain("Quy trình Bàn giao Hồ sơ Dự án");
    expect(sopMarkdown).toContain("SOP-TEST-01");

    // Verify localStorage persistence
    const savedStorage = mockLocalStorage.getItem("rai2_context_vault_v1");
    expect(savedStorage).toBeTruthy();
    const parsed = JSON.parse(savedStorage!);
    expect(parsed.sops).toContain("SOP-TEST-01");
  });
});
