export type ChamberStatus = "EMPTY" | "WEAK" | "FAIR" | "SOLID";

export interface ChamberEvaluation {
  chamberKey: "brand_voice" | "customer_avatar" | "offer_breakdown" | "sops" | "constraints";
  chamberNumber: number;
  chamberName: string;
  pillarId: string;
  score: number; // 0 to 4
  maxScore: 4;
  status: ChamberStatus;
  criteriaPassed: string[];
  missingChecklist: string[];
  recommendation: string;
}

export type FuelTankStatus = "CRITICAL_EMPTY" | "MODERATE_HALF" | "READY_FULL";

export interface DataReadinessResult {
  totalScore: number; // 0 to 20
  maxScore: 20;
  fuelPct: number; // 0 to 100%
  level: {
    status: FuelTankStatus;
    title: string;
    badgeColor: string;
    advice: string;
  };
  chambers: ChamberEvaluation[];
  quickWins: string[];
  evaluatedAt: string;
}

function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateDataReadiness(vaultData: Record<string, string> = {}): DataReadinessResult {
  const brandText = vaultData["brand_voice"] || vaultData["brand"] || "";
  const avatarText = vaultData["customer_avatar"] || vaultData["customers"] || "";
  const offerText = vaultData["offer_breakdown"] || vaultData["products"] || "";
  const sopText = vaultData["sops"] || "";
  const constraintText = vaultData["constraints"] || vaultData["rules"] || "";

  // 1. Chamber 1: Brand Voice (0-4 pts)
  const brandWords = wordCount(brandText);
  let brandScore = 0;
  const brandPassed: string[] = [];
  const brandMissing: string[] = [];

  if (brandWords >= 30) {
    brandScore += 1;
    brandPassed.push("Đã có mô tả định vị doanh nghiệp cơ bản (>30 từ)");
  } else {
    brandMissing.push("Cần tối thiểu 30 từ mô tả doanh nghiệp làm gì và phục vụ ai");
  }

  const hasTone = /(?:tông giọng|giọng văn|phong cách|chuyên nghiệp|thân mật|lễ phép|dứt khoát|tone)/i.test(brandText);
  if (hasTone) {
    brandScore += 1;
    brandPassed.push("Có chỉ dẫn tông giọng giao tiếp rõ ràng");
  } else {
    brandMissing.push("Bổ sung quy định tông giọng giao tiếp (ví dụ: lễ phép, trung thực, thẳng thắn)");
  }

  const hasForbidden = /(?:từ cấm|không được nói|tránh dùng|không hứa|cấm|anti-pattern)/i.test(brandText);
  if (hasForbidden) {
    brandScore += 1;
    brandPassed.push("Có danh sách từ cấm hoặc ranh giới phát ngôn");
  } else {
    brandMissing.push("Thêm danh sách từ ngữ cấm kỵ bot không được dùng với khách");
  }

  if (brandWords >= 120 && brandScore >= 2) {
    brandScore += 1;
    brandPassed.push("Độ sâu tri thức thương hiệu đạt chuẩn (>120 từ)");
  } else if (brandWords < 120) {
    brandMissing.push("Nâng độ dài tri thức thương hiệu lên trên 120 từ để AI hiểu sâu sắc");
  }

  // 2. Chamber 2: Customer Avatar (0-4 pts)
  const avatarWords = wordCount(avatarText);
  let avatarScore = 0;
  const avatarPassed: string[] = [];
  const avatarMissing: string[] = [];

  if (avatarWords >= 30) {
    avatarScore += 1;
    avatarPassed.push("Có mô tả phân khúc đối tượng khách hàng mục tiêu");
  } else {
    avatarMissing.push("Định nghĩa rõ đối tượng khách hàng (độ tuổi, ngành nghề, quy mô)");
  }

  const hasPain = /(?:nỗi đau|vấn đề|khó khăn|bức xúc|lo lắng|sợ|mất mát|ngại|pain point)/i.test(avatarText);
  if (hasPain) {
    avatarScore += 1;
    avatarPassed.push("Đã bóc tách nỗi đau cốt lõi khiến khách hàng mất ngủ");
  } else {
    avatarMissing.push("Liệt kê ít nhất 3 nỗi đau nhức nhối nhất của khách hàng");
  }

  const hasObjection = /(?:từ chối|nghi ngờ|giá đắt|chê đắt|suy nghĩ|đối thủ|bảo hành|objection)/i.test(avatarText);
  if (hasObjection) {
    avatarScore += 1;
    avatarPassed.push("Có kịch bản nhận diện các rào cản và lý do từ chối mua");
  } else {
    avatarMissing.push("Ghi rõ các lý do từ chối thường gặp (ví dụ: chê đắt, cần hỏi vợ/sếp)");
  }

  if (avatarWords >= 120 && avatarScore >= 2) {
    avatarScore += 1;
    avatarPassed.push("Hồ sơ chân dung khách hàng chi tiết và sắc nét (>120 từ)");
  } else if (avatarWords < 120) {
    avatarMissing.push("Mô tả kỹ hơn hành vi và động lực ra quyết định mua của khách");
  }

  // 3. Chamber 3: Offer Breakdown & Price Book (0-4 pts)
  const offerWords = wordCount(offerText);
  let offerScore = 0;
  const offerPassed: string[] = [];
  const offerMissing: string[] = [];

  if (offerWords >= 30) {
    offerScore += 1;
    offerPassed.push("Có danh mục tên sản phẩm hoặc gói dịch vụ cung cấp");
  } else {
    offerMissing.push("Liệt kê đầy đủ tên các sản phẩm/dịch vụ chủ lực");
  }

  const hasDeliverables = /(?:phạm vi|hạng mục|tiến độ|nghiệm thu|bàn giao|cam kết|deliverable|quy chuẩn)/i.test(offerText);
  if (hasDeliverables) {
    offerScore += 1;
    offerPassed.push("Quy định rõ ràng ranh giới phạm vi công việc và mốc nghiệm thu");
  } else {
    offerMissing.push("Bổ sung chi tiết phạm vi công việc gồm những gì và KHÔNG gồm những gì");
  }

  const hasPriceTiers = /(?:giá|bảng giá|triệu|vnđ|đơn giá|3 bậc|gói|basic|pro|vip)/i.test(offerText);
  if (hasPriceTiers) {
    offerScore += 1;
    offerPassed.push("Có biểu giá định lượng hoặc cấu trúc giá tham chiếu");
  } else {
    offerMissing.push("Bổ sung khoảng giá hoặc bảng giá mẫu để bot có căn cứ báo giá");
  }

  const hasMarginRules = /(?:biên lợi nhuận|lợi nhuận|giá sàn|chiết khấu|giảm giá|margin|35%)/i.test(offerText);
  if (hasMarginRules) {
    offerScore += 1;
    offerPassed.push("Có rào chắn bảo vệ giá sàn và kiểm soát chiết khấu");
  } else {
    offerMissing.push("Quy định tỷ lệ chiết khấu tối đa cho phép để bảo vệ biên lợi nhuận ròng >= 35%");
  }

  // 4. Chamber 4: SOPs (0-4 pts)
  const sopWords = wordCount(sopText);
  let sopScore = 0;
  const sopPassed: string[] = [];
  const sopMissing: string[] = [];

  if (sopWords >= 40) {
    sopScore += 1;
    sopPassed.push("Đã có ít nhất một quy trình chuẩn hóa thành văn bản");
  } else {
    sopMissing.push("Sử dụng nút 'Đóng Gói SOP (Voice)' để thu âm quy trình đầu tiên");
  }

  const has4Part = /(?:kích hoạt|trigger|bước|checklist|rào chắn|guardrail|hoàn thành|dod)/i.test(sopText);
  if (has4Part) {
    sopScore += 1;
    sopPassed.push("Cấu trúc SOP chuẩn 4 phần (Trigger, Checklist, Guardrails, DoD)");
  } else {
    sopMissing.push("Chuẩn hóa cấu trúc SOP gồm Điều kiện bắt đầu, Các bước làm, Rào chắn cấm và Tiêu chuẩn xong");
  }

  const hasMultiDept = /(?:bán hàng|vận hành|tư vấn|giao hàng|xưởng|thu tiền|nghiệm thu|bảo hành)/i.test(sopText);
  if (hasMultiDept && sopWords >= 100) {
    sopScore += 1;
    sopPassed.push("Bao phủ quy trình qua nhiều khâu vận hành thực tế");
  } else {
    sopMissing.push("Đóng gói thêm SOP cho khâu bàn giao kỹ thuật hoặc thu hồi công nợ");
  }

  if (sopWords >= 200 && sopScore >= 2) {
    sopScore += 1;
    sopPassed.push("Thư viện SOP phong phú và có tính ứng dụng cao (>200 từ)");
  } else if (sopWords < 200) {
    sopMissing.push("Nâng tổng số lượng SOP đóng gói lên tối thiểu 3 quy trình trọng yếu");
  }

  // 5. Chamber 5: Constraints & Compliance (0-4 pts)
  const constraintWords = wordCount(constraintText);
  let constraintScore = 0;
  const constraintPassed: string[] = [];
  const constraintMissing: string[] = [];

  if (constraintWords >= 20) {
    constraintScore += 1;
    constraintPassed.push("Có danh sách ranh giới cấm cơ bản");
  } else {
    constraintMissing.push("Quy định những việc bot TUYỆT ĐỐI KHÔNG được tự ý quyết định");
  }

  const hasApproval = /(?:duyệt|chủ duyệt|founder|hạn mức|vượt quá|phê duyệt|ký tá|chuyển khoản)/i.test(constraintText);
  if (hasApproval) {
    constraintScore += 1;
    constraintPassed.push("Quy định rõ hạn mức thẩm quyền khi nào phải xin ý kiến chủ");
  } else {
    constraintMissing.push("Ghi rõ hạn mức tài chính hoặc hợp đồng cần người chủ trực tiếp duyệt");
  }

  const hasDataSecurity = /(?:bảo mật|thông tin|khách hàng|tiết lộ|mật khẩu|ngân hàng|riêng tư)/i.test(constraintText);
  if (hasDataSecurity) {
    constraintScore += 1;
    constraintPassed.push("Có quy định bảo vệ bí mật kinh doanh và dữ liệu khách hàng");
  } else {
    constraintMissing.push("Thêm cam kết bảo mật thông tin nội bộ và số điện thoại khách hàng");
  }

  if (constraintWords >= 80 && constraintScore >= 2) {
    constraintScore += 1;
    constraintPassed.push("Hệ thống rào chắn an toàn kiên cố (>80 từ)");
  } else if (constraintWords < 80) {
    constraintMissing.push("Bổ sung thêm các kịch bản sự cố phát sinh ngoài ý muốn");
  }

  // Chamber helper
  function toStatus(s: number): ChamberStatus {
    if (s <= 1) return "EMPTY";
    if (s === 2) return "WEAK";
    if (s === 3) return "FAIR";
    return "SOLID";
  }

  const chambers: ChamberEvaluation[] = [
    {
      chamberKey: "brand_voice",
      chamberNumber: 1,
      chamberName: "Bản Sắc Thương Hiệu & Tông Giọng",
      pillarId: "brand_voice",
      score: brandScore,
      maxScore: 4,
      status: toStatus(brandScore),
      criteriaPassed: brandPassed,
      missingChecklist: brandMissing,
      recommendation: brandScore < 3 ? "Bổ sung quy định giọng văn lễ phép và 5 từ cấm kỵ khi tư vấn." : "Đã hoàn thành tốt.",
    },
    {
      chamberKey: "customer_avatar",
      chamberNumber: 2,
      chamberName: "Chân Dung Khách Hàng & Nỗi Đau",
      pillarId: "customer_avatar",
      score: avatarScore,
      maxScore: 4,
      status: toStatus(avatarScore),
      criteriaPassed: avatarPassed,
      missingChecklist: avatarMissing,
      recommendation: avatarScore < 3 ? "Bóc tách 3 nỗi đau sợ hãi lớn nhất khiến khách chần chừ." : "Đã hoàn thành tốt.",
    },
    {
      chamberKey: "offer_breakdown",
      chamberNumber: 3,
      chamberName: "Chi Tiết Lời Chào Hàng & Sổ Giá",
      pillarId: "offer_breakdown",
      score: offerScore,
      maxScore: 4,
      status: toStatus(offerScore),
      criteriaPassed: offerPassed,
      missingChecklist: offerMissing,
      recommendation: offerScore < 3 ? "Định hình bảng giá 3 bậc neo tâm lý và giới hạn chiết khấu tối đa 5%." : "Đã hoàn thành tốt.",
    },
    {
      chamberKey: "sops",
      chamberNumber: 4,
      chamberName: "Quy Trình Chuẩn Hóa (SOPs)",
      pillarId: "sops",
      score: sopScore,
      maxScore: 4,
      status: toStatus(sopScore),
      criteriaPassed: sopPassed,
      missingChecklist: sopMissing,
      recommendation: sopScore < 3 ? "Bấm thu âm giọng nói để đóng gói ngay 1 quy trình xử lý sự cố thường gặp." : "Đã hoàn thành tốt.",
    },
    {
      chamberKey: "constraints",
      chamberNumber: 5,
      chamberName: "Ranh Giới Cấm & Hạn Mức Duyệt",
      pillarId: "constraints",
      score: constraintScore,
      maxScore: 4,
      status: toStatus(constraintScore),
      criteriaPassed: constraintPassed,
      missingChecklist: constraintMissing,
      recommendation: constraintScore < 3 ? "Quy định rõ các tình huống bắt buộc phải gọi chủ duyệt trước khi gửi khách." : "Đã hoàn thành tốt.",
    },
  ];

  const totalScore = chambers.reduce((acc, c) => acc + c.score, 0);
  const fuelPct = Math.round((totalScore / 20) * 100);

  let fuelStatus: FuelTankStatus = "CRITICAL_EMPTY";
  let title = "Bình Nhiên Liệu Cạn Kiệt (0-7/20)";
  let badgeColor = "bg-red-500/10 text-red-600 border-red-500/30";
  let advice = "Dữ liệu chưa đủ chuẩn để AI ra chiến trường! Bot có nguy cơ ảo giác cao và trả lời chung chung. Hãy nạp thêm thông tin ở các ô bị thiếu bên dưới.";

  if (totalScore >= 14) {
    fuelStatus = "READY_FULL";
    title = "Sẵn Sàng Ra Trận (14-20/20)";
    badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    advice = "Bình nhiên liệu đạt chuẩn cao! Nhân sự số đã hấp thụ trọn vẹn DNA doanh nghiệp, sẵn sàng tự chủ phản hồi và soạn báo giá chính xác.";
  } else if (totalScore >= 8) {
    fuelStatus = "MODERATE_HALF";
    title = "Nhiên Liệu Tạm Đủ (8-13/20)";
    badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/30";
    advice = "Bot đã có thể hỗ trợ các nghiệp vụ cơ bản, nhưng chủ doanh nghiệp cần kiểm duyệt kỹ các báo giá hoặc cam kết trước khi chuyển sang chế độ tự hành.";
  }

  // Aggregate Top 3 Quick Wins
  const quickWins: string[] = [];
  for (const chamber of chambers) {
    if (chamber.score < 3 && chamber.missingChecklist.length > 0) {
      quickWins.push(`${chamber.chamberName}: ${chamber.missingChecklist[0]}`);
      if (quickWins.length >= 3) break;
    }
  }

  return {
    totalScore,
    maxScore: 20,
    fuelPct,
    level: {
      status: fuelStatus,
      title,
      badgeColor,
      advice,
    },
    chambers,
    quickWins,
    evaluatedAt: new Date().toISOString(),
  };
}

export function formatDataReadinessMarkdown(result: DataReadinessResult): string {
  const lines: string[] = [
    `# BÁO CÁO MỨC ĐỘ SẴN SÀNG DỮ LIỆU KÉT SẮT TRI THỨC (DATA READINESS FUEL GAUGE)`,
    `*Điểm số: ${result.totalScore}/20 (${result.fuelPct}%) - Trạng thái: ${result.level.title}*`,
    ``,
    `> **Nhận định từ Hệ Thống:** ${result.level.advice}`,
    ``,
    `---`,
    `### ĐÁNH GIÁ 5 NGĂN NHIÊN LIỆU TRI THỨC`,
  ];

  for (const c of result.chambers) {
    lines.push(
      `#### Ngăn ${c.chamberNumber}: ${c.chamberName} [${c.score}/4 điểm - ${c.status}]`,
      `- **Đã đạt:** ${c.criteriaPassed.length > 0 ? c.criteriaPassed.join("; ") : "Chưa có"}`,
      `- **Cần bổ sung:** ${c.missingChecklist.length > 0 ? c.missingChecklist.join("; ") : "Đã hoàn thiện"}`,
      `- **Khuyến nghị hành động:** ${c.recommendation}`,
      ``
    );
  }

  if (result.quickWins.length > 0) {
    lines.push(
      `---`,
      `### HÀNH ĐỘNG CẦN LÀM NGAY ĐỂ TĂNG ĐIỂM SẴN SÀNG:`,
      ...result.quickWins.map((qw, i) => `${i + 1}. ${qw}`)
    );
  }

  return lines.join("\n");
}
