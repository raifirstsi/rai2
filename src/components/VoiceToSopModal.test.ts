import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceToSopModal } from "./VoiceToSopModal";
import {
  compileMonologueToSop,
  formatSopToMarkdown,
  saveSopToVault,
  SOP_CATEGORY_LABELS,
} from "@/lib/voice-to-sop";

describe("VoiceToSopModal - Component & Contract", () => {
  let memoryStore: Record<string, string> = {};

  beforeEach(() => {
    memoryStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value;
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
      clear: () => {
        memoryStore = {};
      },
    };

    (globalThis as unknown as { window: { localStorage: typeof mockLocalStorage } }).window = {
      localStorage: mockLocalStorage,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("exports VoiceToSopModal functional component", () => {
    expect(typeof VoiceToSopModal).toBe("function");
  });

  it("provides comprehensive category labels for all business departments", () => {
    expect(SOP_CATEGORY_LABELS.sales).toContain("Bán hàng");
    expect(SOP_CATEGORY_LABELS.delivery).toContain("Bàn giao");
    expect(SOP_CATEGORY_LABELS.support).toContain("Chăm sóc");
    expect(SOP_CATEGORY_LABELS.operations).toContain("Vận hành");
    expect(SOP_CATEGORY_LABELS.finance).toContain("Tài chính");
    expect(SOP_CATEGORY_LABELS.hr).toContain("Nhân sự");
  });

  it("compiles founder monologue and generates full 4-part structure for modal preview", () => {
    const speech = `
      Khi nhận bàn giao thiết kế từ khách hàng.
      Bước 1: Kiểm tra tỷ lệ kích thước bản vẽ và file gốc.
      Bước 2: Gửi xác nhận nhận file trong 30 phút.
      Lưu ý: Không bắt đầu in ấn trước khi khách ký duyệt mẫu màu.
      Hoàn thành khi khách hàng xác nhận biên bản duyệt màu qua email.
    `;
    const sop = compileMonologueToSop(speech);
    expect(sop.title).toBeTruthy();
    expect(sop.trigger).toContain("nhận bàn giao");
    expect(sop.steps.length).toBeGreaterThanOrEqual(2);
    expect(sop.guardrails.length).toBeGreaterThanOrEqual(1);
    expect(sop.definitionOfDone).toContain("duyệt màu");

    const md = formatSopToMarkdown(sop);
    expect(md).toContain("#### 1. Bối cảnh & Điều kiện kích hoạt");
    expect(md).toContain("#### 2. Các bước thực thi tuần tự");
    expect(md).toContain("#### 3. Ranh giới cấm & Quy tắc an toàn");
    expect(md).toContain("#### 4. Tiêu chuẩn hoàn thành");
  });

  it("persists extracted SOP into Vault through saveSopToVault", () => {
    const speech = `
      Quy trình Duyệt Chiết Khấu Hợp Đồng
      Khi khách hàng yêu cầu giảm giá đơn hàng trên 50 triệu.
      Bước 1: Tính toán tỷ suất lợi nhuận gộp theo Margin Guard.
      Bước 2: Nếu margin dưới 35%, chỉ được giảm phạm vi công việc.
      Lưu ý: Tuyệt đối không được tự ý giảm tiền mặt trực tiếp.
      Hoàn thành khi hợp đồng đảm bảo biên lợi nhuận >= 35%.
    `;
    const sop = compileMonologueToSop(speech);
    const { updatedContents, sopMarkdown } = saveSopToVault(sop);

    expect(updatedContents.sops).toContain("Quy trình Duyệt Chiết Khấu Hợp Đồng");
    expect(sopMarkdown).toContain(sop.id);
  });
});
