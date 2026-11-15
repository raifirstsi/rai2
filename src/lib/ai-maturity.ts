export interface MaturityQuestionOption {
  score: number; // 0, 1, 2, 3
  label: string;
  description: string;
}

export interface MaturityQuestion {
  id: string;
  zoneNumber: number;
  zoneName: string;
  question: string;
  options: MaturityQuestionOption[];
}

export const MATURITY_QUESTIONS: MaturityQuestion[] = [
  {
    id: "q1_strategy",
    zoneNumber: 1,
    zoneName: "Zone 1: Chiến Lược & Người Chủ (Strategy/MeOS)",
    question: "Doanh nghiệp vận hành thế nào khi Người Chủ vắng mặt 2 tuần?",
    options: [
      { score: 0, label: "Tê liệt hoàn toàn", description: "Mọi quyết định lớn nhỏ đều chờ chủ ký hoặc nhắn tin chỉ đạo." },
      { score: 1, label: "Cầm cự gián đoạn", description: "Đội ngũ chỉ làm việc lặp lại, phát sinh sự cố là phải gọi cho chủ." },
      { score: 2, label: "Vận hành có giám sát", description: "Có quy trình và trợ lý số hỗ trợ, chỉ cần báo cáo tóm tắt cuối tuần." },
      { score: 3, label: "Tự hành nhịp nhàng", description: "Hệ thống tự đo lường và chạy chuẩn mực, chủ vắng mặt doanh thu vẫn tăng." },
    ],
  },
  {
    id: "q2_marketing",
    zoneNumber: 2,
    zoneName: "Zone 2: Tiếp Thị & Thu Hút Lead (Marketing)",
    question: "Quy trình tìm kiếm và nuôi dưỡng khách hàng tiềm năng diễn ra ra sao?",
    options: [
      { score: 0, label: "Thủ công & Ngẫu hứng", description: "Chờ khách tự tìm đến hoặc chạy ads rời rạc không phân loại." },
      { score: 1, label: "Có công cụ nhưng rời rạc", description: "Dùng ChatGPT viết bài nhưng không có luồng nuôi dưỡng tự động." },
      { score: 2, label: "Phân loại 24/7", description: "Nhân sự số tiếp nhận, phân loại và gắn tag khách hàng tiềm năng liên tục." },
      { score: 3, label: "Dây chuyền tự động hóa", description: "Nghiên cứu thị trường và nuôi dưỡng lead tự động đồng bộ vào CRM." },
    ],
  },
  {
    id: "q3_sales",
    zoneNumber: 3,
    zoneName: "Zone 3: Bán Hàng & Báo Giá (Sales/Quote)",
    question: "Thời gian phản hồi báo giá và chính sách giá sàn được kiểm soát thế nào?",
    options: [
      { score: 0, label: "Chậm (>3 ngày) & Phá giá", description: "Báo giá thủ công, sales tùy tiện giảm giá để chốt đơn." },
      { score: 1, label: "Có bảng tính Excel", description: "Tính giá mất 1-2 ngày, chưa có chốt chặn tự động ngắt khi biên thấp." },
      { score: 2, label: "Báo giá dưới 2h có Margin Guard", description: "Có bot hỗ trợ lên báo giá và cảnh báo khi biên lợi nhuận <35%." },
      { score: 3, label: "Chốt đơn tự động đa kênh", description: "Tự động xuất hợp đồng trong 15 phút, khóa cứng biên lợi nhuận sàn." },
    ],
  },
  {
    id: "q4_operations",
    zoneNumber: 4,
    zoneName: "Zone 4: Vận Hành & Cung Ứng (Ops/Delivery)",
    question: "Kinh nghiệm và quy trình xử lý sự cố (SOP) được lưu trữ ở đâu?",
    options: [
      { score: 0, label: "Trong đầu người chủ", description: "Không có văn bản, nhân viên làm sai là người chủ phải đích thân đi sửa." },
      { score: 1, label: "Tài liệu Word/PDF bám bụi", description: "Có viết SOP nhưng không ai đọc và không tích hợp vào công việc." },
      { score: 2, label: "Voice-to-SOP 1-Chạm", description: "Mọi sự cố được thu âm và bóc tách thành quy trình 4 phần nạp vào bot." },
      { score: 3, label: "Quy trình số sống", description: "Đội nhân sự số tự động đối chiếu SOP trước khi bàn giao công việc." },
    ],
  },
  {
    id: "q5_care",
    zoneNumber: 5,
    zoneName: "Zone 5: Chăm Sóc & Tái Mua (Customer Care)",
    question: "Khách hàng cũ được chăm sóc và gợi ý mua lại định kỳ thế nào?",
    options: [
      { score: 0, label: "Bỏ quên sau khi bán", description: "Chỉ liên hệ lại khi khách chủ động khiếu nại hoặc hủy dịch vụ." },
      { score: 1, label: "Nhắn tin chăm sóc thủ công", description: "Nhân viên nhớ thì gửi tin chúc mừng ngày lễ, tỷ lệ tái mua thấp." },
      { score: 2, label: "Lịch trình tự động", description: "Bot tự động gửi thăm hỏi và kích hoạt ưu đãi theo chu kỳ sử dụng." },
      { score: 3, label: "Cá nhân hóa vòng đời", description: "Nhận diện rủi ro rời bỏ sớm và tự động kích hoạt đòn bẩy tái mua F." },
    ],
  },
  {
    id: "q6_finance",
    zoneNumber: 6,
    zoneName: "Zone 6: Tài Chính & Dòng Tiền (Finance/P&L)",
    question: "Chủ doanh nghiệp nắm bắt con số P&L và điểm hòa vốn theo tần suất nào?",
    options: [
      { score: 0, label: "Xem báo cáo trễ hàng tháng", description: "Cuối tháng kế toán chốt sổ mới biết lãi hay lỗ, dòng tiền bấp bênh." },
      { score: 1, label: "Bảng tính sơ bộ hàng tuần", description: "Nắm được doanh thu nhưng không đo lường được chi phí ẩn và lãng phí." },
      { score: 2, label: "Nhịp thở Thứ Sáu 17:00", description: "Theo dõi 4 chỉ số vận hành và cảnh báo tồn đọng >48h đều đặn." },
      { score: 3, label: "Mô phỏng 5 Đòn bẩy P&L thời gian thực", description: "Tự động tính toán dòng tiền tái đầu tư L5 và giữ biên ròng an toàn." },
    ],
  },
  {
    id: "q7_people",
    zoneNumber: 7,
    zoneName: "Zone 7: Nhân Sự & Đào Tạo (People/Talent)",
    question: "Thái độ và năng lực của đội ngũ nhân sự đối với AI như thế nào?",
    options: [
      { score: 0, label: "Lo sợ hoặc phản đối", description: "Nhân viên sợ bị AI thay thế hoặc coi AI là đồ chơi vô bổ." },
      { score: 1, label: "Dùng tự phát", description: "Vài cá nhân tự dùng bản cá nhân, không có chuẩn bảo mật và chia sẻ." },
      { score: 2, label: "Hợp tác có phân vai (RACI)", description: "Đội ngũ hiểu rõ bot nào làm việc gì, hỗ trợ giám sát đầu ra (HITL)." },
      { score: 3, label: "Văn hóa AI-First", description: "Nhân sự làm chủ hệ thống, đóng gói kinh nghiệm vào Két Sắt liên tục." },
    ],
  },
];

export interface MaturityResult {
  totalScore: number; // 0-21
  percentage: number; // 0-100%
  tier: "RETROFIT_TRAP" | "POINT_SOLUTION" | "TRUE_AI_FIRST";
  tierTitle: string;
  tierBadge: string;
  diagnosis: string;
  prescriptions: string[];
  ninetyDayRoadmapSpine: {
    month1: string;
    month2: string;
    month3: string;
  };
}

export function evaluateMaturityScore(answers: Record<string, number>): MaturityResult {
  let totalScore = 0;
  for (const q of MATURITY_QUESTIONS) {
    const val = answers[q.id];
    if (typeof val === "number") {
      totalScore += Math.max(0, Math.min(3, val));
    }
  }

  const percentage = Math.round((totalScore / 21) * 100);

  if (totalScore <= 7) {
    return {
      totalScore,
      percentage,
      tier: "RETROFIT_TRAP",
      tierTitle: "Cấp độ 1: Bẫy Chắp Vá (The Retrofit Trap)",
      tierBadge: "Cần Tái Cấu Trúc Khẩn Cấp",
      diagnosis:
        "Doanh nghiệp đang rắc AI lên quy trình cũ rời rạc. Người chủ vẫn là hệ điều hành duy nhất (MeOS). Càng áp dụng nhiều công cụ thì nội bộ càng hỗn loạn.",
      prescriptions: [
        "DỪNG LẠI: Không mua thêm bất kỳ phần mềm hay khóa học AI rời rạc nào.",
        "DỌN RÁC: Dùng Bảng phân loại Target Architecture xóa bỏ ngay 20% cuộc họp và báo cáo thừa.",
        "KHÓA BIÊN: Cài đặt Margin Guard >=35% để bảo toàn tiền mặt và nạp Két Sắt Ngữ Cảnh.",
      ],
      ninetyDayRoadmapSpine: {
        month1: "Tháng 1: Dọn rác quy trình, đóng gói 3 SOP bằng giọng nói, thiết lập Két Sắt tri thức đạt >=10/20 điểm.",
        month2: "Tháng 2: Kích hoạt Bot Báo giá Zone 3 gắn chốt chặn Margin Guard, mở Báo cáo Thứ Sáu 17:00.",
        month3: "Tháng 3: Giải phóng 10h/tuần của Người chủ, đưa tỷ lệ tự trị của bot lên Cấp 2 (Co-Pilot 80%).",
      },
    };
  }

  if (totalScore <= 14) {
    return {
      totalScore,
      percentage,
      tier: "POINT_SOLUTION",
      tierTitle: "Cấp độ 2: Thử Nghiệm Tản Mát (Point-Solution)",
      tierBadge: "Đang Tăng Tốc Hợp Nhất",
      diagnosis:
        "Doanh nghiệp đã có nhận thức và công cụ, nhưng các bộ phận vẫn hoạt động như các ốc đảo rời rạc. Dữ liệu chưa đủ sâu để AI tự trị hoàn toàn.",
      prescriptions: [
        "HỢP NHẤT 7 VÙNG: Kết nối chuỗi giá trị theo Bản đồ Chiến lược 7 Vùng.",
        "NÂNG NHIÊN LIỆU: Bổ sung đủ 5 ngăn trong Két Sắt Ngữ Cảnh đạt mốc >=14/20 điểm.",
        "GIÁM SÁT HITL: Áp dụng quy trình kiểm toán 50 tác vụ sạch để nâng cấp bot lên tự hành 95%.",
      ],
      ninetyDayRoadmapSpine: {
        month1: "Tháng 1: Hợp nhất dữ liệu vào 8 Trụ cột Két Sắt, loại bỏ điểm nghẽn TOC đang chặn dòng tiền.",
        month2: "Tháng 2: Chạy mô phỏng 5 Đòn bẩy P&L, trích lập quỹ tái đầu tư L5 vào ngân sách tiếp thị số.",
        month3: "Tháng 3: Tốt nghiệp tự trị 95% cho ít nhất 2 bot cốt lõi (Zone 2 Lead & Zone 3 Báo giá).",
      },
    };
  }

  return {
    totalScore,
    percentage,
    tier: "TRUE_AI_FIRST",
    tierTitle: "Cấp độ 3: Doanh Nghiệp AI-First Thực Thụ",
    tierBadge: "Hệ Điều Hành Tự Trị Chuẩn",
    diagnosis:
      "Doanh nghiệp đã xây dựng được cỗ máy tự hành vững chắc. Người chủ tập trung vào chiến lược và mở rộng quy mô mà không bị kéo vào sự vụ.",
    prescriptions: [
      "MỞ RỘNG QUY MÔ: Tái đầu tư dòng tiền vào mở rộng thị trường và sản phẩm mới.",
      "TỰ TRỊ 95%: Duy trì kiểm toán ngẫu nhiên 5% mẫu tác vụ của bot để ngăn chặn lỗi ngầm.",
      "NHÂN BẢN HỆ THỐNG: Đóng gói toàn bộ mô hình thành cỗ máy chuyển nhượng hoặc mở rộng chi nhánh.",
    ],
    ninetyDayRoadmapSpine: {
      month1: "Tháng 1: Tối ưu hóa 5 Đòn bẩy P&L để mở rộng biên ròng thêm 15-20%.",
      month2: "Tháng 2: Kích hoạt tự hành 95% trên toàn bộ 7 Vùng nghiệp vụ.",
      month3: "Tháng 3: Đưa chỉ số sẵn sàng vắng mặt (ARI) đạt mốc trên 90/100 điểm.",
    },
  };
}

const STORAGE_KEY_MATURITY = "rai2_ai_maturity_assessment";

export function loadSavedMaturityAnswers(): Record<string, number> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      q1_strategy: 1,
      q2_marketing: 1,
      q3_sales: 1,
      q4_operations: 1,
      q5_care: 0,
      q6_finance: 1,
      q7_people: 1,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_MATURITY);
    if (!raw) {
      return {
        q1_strategy: 1,
        q2_marketing: 1,
        q3_sales: 1,
        q4_operations: 1,
        q5_care: 0,
        q6_finance: 1,
        q7_people: 1,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveMaturityAnswers(answers: Record<string, number>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_MATURITY, JSON.stringify(answers));
  } catch (e) {
    console.warn("Could not save maturity assessment answers:", e);
  }
}
