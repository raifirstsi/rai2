import { describe, it, expect } from "vitest";
import {
  evaluateDataReadiness,
  formatDataReadinessMarkdown,
} from "./data-readiness";

describe("data-readiness - The Data Readiness Fuel Gauge /20", () => {
  it("scores empty vault as CRITICAL_EMPTY with zero points", () => {
    const result = evaluateDataReadiness({});

    expect(result.totalScore).toBeLessThan(5);
    expect(result.level.status).toBe("CRITICAL_EMPTY");
    expect(result.chambers).toHaveLength(5);
    expect(result.quickWins.length).toBeGreaterThan(0);
  });

  it("evaluates comprehensive vault data to READY_FULL (>= 14/20 points)", () => {
    const richVault = {
      brand_voice: `
        Chúng tôi là xưởng sản xuất nội thất cao cấp phục vụ các gia chủ biệt thự và nhà phố tại Hà Nội.
        Tông giọng giao tiếp: Lễ phép, trung thực, tận tâm, giải thích kỹ thuật bằng ngôn ngữ dân dã dễ hiểu.
        Từ cấm: Tuyệt đối không được nói 'chắc là', 'hình như', không hứa hẹn suông và không nói xấu đối thủ cạnh tranh.
        Định vị: Đơn vị thiết kế thi công bảo hành trọn đời 10 năm với cam kết đúng tiến độ 100%.
      `,
      customer_avatar: `
        Khách hàng mục tiêu là chủ nhà từ 35 đến 55 tuổi, thu nhập khá, chuẩn bị hoàn thiện tổ ấm gia đình.
        Nỗi đau: Sợ thợ làm ẩu, lo lắng chi phí phát sinh vô tội vạ, sợ trễ tiến độ vào nhà mới, ngại cãi vã.
        Lý do từ chối: Chê giá đắt so với các đội thợ ngoài chợ, lo ngại về chất lượng gỗ công nghiệp so với gỗ tự nhiên.
        Động lực mua: Cần sự an tâm, minh bạch vật tư và có người giám sát tận nơi từng ngày.
      `,
      offer_breakdown: `
        Các gói dịch vụ: Gói Thiết kế nội thất biệt thự, Gói Thi công chìa khóa trao tay trọn gói.
        Phạm vi công việc: Khảo sát hiện trạng, lên bản vẽ 3D, bóc tách khối lượng, sản xuất tại xưởng và lắp đặt nghiệm thu.
        Bảng giá tham chiếu: Gói Basic 350 triệu VNĐ, Gói Pro 650 triệu VNĐ, Gói VIP 1.2 tỷ VNĐ.
        Rào chắn giá sàn: Biên lợi nhuận gộp tối thiểu 35%, chiết khấu tối đa không vượt quá 5% trên tổng giá trị hợp đồng.
      `,
      sops: `
        Quy trình tiếp nhận và gửi báo giá trong 3 phút:
        - Điều kiện kích hoạt: Khách nhắn tin để lại số điện thoại hoặc mặt bằng.
        - Bước 1: Chào hỏi lễ phép trong 30 giây, hỏi kích thước phòng và ngân sách dự kiến.
        - Bước 2: Soạn Bản Đề Xuất 7 Phần với 3 bậc giá.
        - Rào chắn: Không báo giá vo qua điện thoại nếu chưa có diện tích ước tính; không giảm giá quá 5%.
        - Tiêu chuẩn hoàn thành DoD: Khách xác nhận đã nhận file PDF và chọn ngày hẹn khảo sát tại công trình.
      `,
      constraints: `
        Những việc bot TUYỆT ĐỐI KHÔNG được tự ý quyết định:
        1. Nghiêm cấm tự ý hứa giảm giá vượt quá 5% mà không có sự phê duyệt của người chủ.
        2. Mọi cam kết đền bù hợp đồng bắt buộc phải do Founder trực tiếp duyệt.
        3. Tuyệt đối bảo mật thông tin cá nhân và số điện thoại của khách hàng, không chia sẻ cho bên thứ ba.
      `,
    };

    const result = evaluateDataReadiness(richVault);

    expect(result.totalScore).toBeGreaterThanOrEqual(14);
    expect(result.level.status).toBe("READY_FULL");
    expect(result.fuelPct).toBeGreaterThanOrEqual(70);

    for (const c of result.chambers) {
      expect(c.score).toBeGreaterThanOrEqual(2);
      expect(c.criteriaPassed.length).toBeGreaterThan(0);
    }
  });

  it("formats data readiness report into actionable markdown checklist", () => {
    const result = evaluateDataReadiness({
      brand_voice: "Công ty tư vấn quản trị cho doanh nghiệp nhỏ. Tông giọng nghiêm túc, dứt khoát.",
    });

    const md = formatDataReadinessMarkdown(result);

    expect(md).toContain("BÁO CÁO MỨC ĐỘ SẴN SÀNG DỮ LIỆU KÉT SẮT TRI THỨC");
    expect(md).toContain("Ngăn 1: Bản Sắc Thương Hiệu & Tông Giọng");
    expect(md).toContain("HÀNH ĐỘNG CẦN LÀM NGAY");
  });
});
