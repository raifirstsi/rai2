export interface FiveLeversInput {
  monthlyLeads: number; // L
  conversionRatePct: number; // CR (0-100)
  averageOrderValue: number; // AOV (VND)
  annualPurchaseFrequency: number; // F (>= 1)
  grossMarginPct: number; // M (0-100)
  fixedMonthlyOpex?: number; // Fixed operating expenses (VND)
}

export interface LeverImprovementPct {
  leadsPct: number; // e.g. 10 for +10%
  conversionRatePct: number; // e.g. 10 for +10%
  averageOrderValuePct: number; // e.g. 10 for +10%
  purchaseFrequencyPct: number; // e.g. 10 for +10%
  grossMarginPct: number; // e.g. 10 for +10%
}

export interface LeverOwnership {
  leverKey: "leads" | "conversionRate" | "averageOrderValue" | "purchaseFrequency" | "grossMargin";
  leverName: string;
  symbol: string;
  zone: number;
  departmentName: string;
  departmentCode: string;
  recommendedAgentKey: string;
  recommendedAgentName: string;
  actionPlaybook: string;
  improvementPct: number;
}

export interface FiveLeversResult {
  baseline: {
    monthlyCustomers: number;
    monthlyRevenue: number;
    annualRevenue: number;
    monthlyGrossProfit: number;
    annualGrossProfit: number;
    monthlyNetProfit: number;
    annualNetProfit: number;
  };
  projected: {
    monthlyCustomers: number;
    monthlyRevenue: number;
    annualRevenue: number;
    monthlyGrossProfit: number;
    annualGrossProfit: number;
    monthlyNetProfit: number;
    annualNetProfit: number;
  };
  growth: {
    revenueMultiplier: number; // e.g. 1.61 for +61%
    grossProfitMultiplier: number; // e.g. 1.77 for +77%
    netProfitMultiplier: number; // e.g. 2.14 for +114%
    revenueGrowthPct: number; // e.g. 61.05
    grossProfitGrowthPct: number; // e.g. 77.16
    netProfitGrowthPct: number; // e.g. 114.2
    extraAnnualRevenue: number;
    extraAnnualGrossProfit: number;
    extraAnnualNetProfit: number;
  };
  leverOwnership: LeverOwnership[];
}

export const DEFAULT_FIVE_LEVERS_INPUT: FiveLeversInput = {
  monthlyLeads: 120, // 120 leads / tháng
  conversionRatePct: 15, // 15% chốt hợp đồng
  averageOrderValue: 20000000, // 20 triệu VNĐ / đơn
  annualPurchaseFrequency: 1.2, // 1.2 lần / năm
  grossMarginPct: 35, // 35% biên lợi nhuận gộp chuẩn P&L
  fixedMonthlyOpex: 45000000, // 45 triệu VNĐ chi phí cố định (mặt bằng, lương cơ bản...)
};

export const LEVER_PRESETS: Record<string, { label: string; description: string; improvements: LeverImprovementPct }> = {
  BALANCED_10: {
    label: "Kích Hoạt AI Đều 5 Khâu (+10% Mỗi Đòn Bẩy)",
    description: "Cải thiện nhẹ 10% ở mỗi khâu tạo ra mức tăng trưởng kép +61% doanh thu và gấp đôi lợi nhuận ròng mà không cần tăng nhân sự.",
    improvements: {
      leadsPct: 10,
      conversionRatePct: 10,
      averageOrderValuePct: 10,
      purchaseFrequencyPct: 10,
      grossMarginPct: 10,
    },
  },
  CONSERVATIVE_5: {
    label: "Thận Trọng (+5% Mỗi Đòn Bẩy)",
    description: "Mục tiêu tối thiểu 30 ngày đầu tiên khi triển khai bot trợ lý.",
    improvements: {
      leadsPct: 5,
      conversionRatePct: 5,
      averageOrderValuePct: 5,
      purchaseFrequencyPct: 5,
      grossMarginPct: 5,
    },
  },
  SALES_MARGIN_FOCUSED: {
    label: "Khóa Van Quảng Cáo - Đẩy Chốt & Biên Lợi Nhuận",
    description: "Giữ nguyên 0% chi phí lead, tập trung tăng tốc độ báo giá (+20%), bẻ từ chối (+15%), và giữ giá sàn (+10%). Phù hợp khi xưởng đang quá tải.",
    improvements: {
      leadsPct: 0,
      conversionRatePct: 20,
      averageOrderValuePct: 15,
      purchaseFrequencyPct: 10,
      grossMarginPct: 10,
    },
  },
  AGGRESSIVE_20: {
    label: "Tăng Tốc Toàn Diện (+20% Mỗi Đòn Bẩy)",
    description: "Mục tiêu 90 ngày sau khi toàn bộ 7 nhân sự số đã vận hành tự chủ.",
    improvements: {
      leadsPct: 20,
      conversionRatePct: 20,
      averageOrderValuePct: 20,
      purchaseFrequencyPct: 20,
      grossMarginPct: 20,
    },
  },
};

export function computeFiveLeversCompounding(
  input: FiveLeversInput,
  improvements: LeverImprovementPct
): FiveLeversResult {
  const L = Math.max(0, input.monthlyLeads);
  const CR = Math.max(0, Math.min(100, input.conversionRatePct)) / 100;
  const AOV = Math.max(0, input.averageOrderValue);
  const F = Math.max(1, input.annualPurchaseFrequency);
  const M = Math.max(0, Math.min(100, input.grossMarginPct)) / 100;
  const opex = Math.max(0, input.fixedMonthlyOpex ?? 0);

  // Baseline Monthly & Annual Calculations
  const baseMonthlyCustomers = L * CR;
  // Monthly revenue accounts for new leads closed monthly and active client purchase frequency
  const baseMonthlyRevenue = baseMonthlyCustomers * AOV * F;
  const baseAnnualRevenue = baseMonthlyRevenue * 12;
  const baseMonthlyGrossProfit = baseMonthlyRevenue * M;
  const baseAnnualGrossProfit = baseAnnualRevenue * M;
  const baseMonthlyNetProfit = baseMonthlyGrossProfit - opex;
  const baseAnnualNetProfit = baseAnnualGrossProfit - opex * 12;

  // Multipliers for Improvements
  const multL = 1 + Math.max(-0.5, improvements.leadsPct / 100);
  const multCR = 1 + Math.max(-0.5, improvements.conversionRatePct / 100);
  const multAOV = 1 + Math.max(-0.5, improvements.averageOrderValuePct / 100);
  const multF = 1 + Math.max(-0.5, improvements.purchaseFrequencyPct / 100);
  const multM = 1 + Math.max(-0.5, improvements.grossMarginPct / 100);

  // Projected Monthly & Annual Calculations
  const projL = L * multL;
  const projCR = Math.min(1, CR * multCR);
  const projAOV = AOV * multAOV;
  const projF = F * multF;
  const projM = Math.min(1, M * multM);

  const projMonthlyCustomers = projL * projCR;
  const projMonthlyRevenue = projMonthlyCustomers * projAOV * projF;
  const projAnnualRevenue = projMonthlyRevenue * 12;
  const projMonthlyGrossProfit = projMonthlyRevenue * projM;
  const projAnnualGrossProfit = projAnnualRevenue * projM;
  const projMonthlyNetProfit = projMonthlyGrossProfit - opex;
  const projAnnualNetProfit = projAnnualGrossProfit - opex * 12;

  // Growth Multipliers
  const revenueMultiplier = baseAnnualRevenue > 0 ? projAnnualRevenue / baseAnnualRevenue : 1;
  const grossProfitMultiplier = baseAnnualGrossProfit > 0 ? projAnnualGrossProfit / baseAnnualGrossProfit : 1;
  const netProfitMultiplier =
    baseAnnualNetProfit > 0 ? projAnnualNetProfit / baseAnnualNetProfit : projAnnualNetProfit > 0 ? 2 : 1;

  const revenueGrowthPct = (revenueMultiplier - 1) * 100;
  const grossProfitGrowthPct = (grossProfitMultiplier - 1) * 100;
  const netProfitGrowthPct = (netProfitMultiplier - 1) * 100;

  const extraAnnualRevenue = Math.max(0, projAnnualRevenue - baseAnnualRevenue);
  const extraAnnualGrossProfit = Math.max(0, projAnnualGrossProfit - baseAnnualGrossProfit);
  const extraAnnualNetProfit = Math.max(0, projAnnualNetProfit - baseAnnualNetProfit);

  // Lever Ownership Map
  const leverOwnership: LeverOwnership[] = [
    {
      leverKey: "leads",
      leverName: "Số Lượng Leads Mới / Tháng",
      symbol: "L",
      zone: 2,
      departmentName: "Phòng Marketing & Thu Hút",
      departmentCode: "ZONE_2_MARKETING",
      recommendedAgentKey: "rai-lead",
      recommendedAgentName: "RAI Lead",
      actionPlaybook: "Túc trực Zalo 24/7 phản hồi trong 30 giây; không bao giờ để lọt khách nhắn ban đêm hoặc cuối tuần.",
      improvementPct: improvements.leadsPct,
    },
    {
      leverKey: "conversionRate",
      leverName: "Tỷ Lệ Chuyển Đổi / Chốt Đơn",
      symbol: "CR",
      zone: 3,
      departmentName: "Phòng Kinh Doanh & Chốt Hợp Đồng",
      departmentCode: "ZONE_3_SALES",
      recommendedAgentKey: "rai-close",
      recommendedAgentName: "RAI Close",
      actionPlaybook: "Bám đuổi deal 3 nhịp (24h - 72h - 7 ngày) và 5 kịch bản bẻ từ chối giá đắt.",
      improvementPct: improvements.conversionRatePct,
    },
    {
      leverKey: "averageOrderValue",
      leverName: "Giá Trị Đơn Hàng Trung Bình (AOV)",
      symbol: "AOV",
      zone: 3,
      departmentName: "Phòng Kinh Doanh & Chốt Hợp Đồng",
      departmentCode: "ZONE_3_SALES",
      recommendedAgentKey: "rai-quote",
      recommendedAgentName: "RAI Quote",
      actionPlaybook: "Soạn Bản Đề Xuất 7 Phần với bảng giá 3 bậc neo tâm lý (Basic / Pro / VIP), tăng tỷ lệ khách chọn gói cao.",
      improvementPct: improvements.averageOrderValuePct,
    },
    {
      leverKey: "purchaseFrequency",
      leverName: "Tần Suất Mua Lặp Lại Hàng Năm (LTV)",
      symbol: "F",
      zone: 5,
      departmentName: "Phòng Chăm Sóc Khách Hàng & Giữ Chân",
      departmentCode: "ZONE_5_RETENTION",
      recommendedAgentKey: "rai-care",
      recommendedAgentName: "RAI Care",
      actionPlaybook: "Chăm sóc chủ động sau bàn giao, định kỳ nhắc lịch bảo dưỡng, xin review 5 sao và kích hoạt ưu đãi tái mua.",
      improvementPct: improvements.purchaseFrequencyPct,
    },
    {
      leverKey: "grossMargin",
      leverName: "Biên Lợi Nhuận Gộp (Margin)",
      symbol: "M",
      zone: 6,
      departmentName: "Phòng Tài Chính & Bảo Vệ Dòng Tiền",
      departmentCode: "ZONE_6_FINANCE",
      recommendedAgentKey: "rai-audit",
      recommendedAgentName: "Margin Guard",
      actionPlaybook: "Cầu dao chốt chặn giá sàn: tự động chặn chiết khấu vượt mức 5% và bảo vệ biên lợi nhuận ròng >= 35%.",
      improvementPct: improvements.grossMarginPct,
    },
  ];

  return {
    baseline: {
      monthlyCustomers: Math.round(baseMonthlyCustomers * 10) / 10,
      monthlyRevenue: Math.round(baseMonthlyRevenue),
      annualRevenue: Math.round(baseAnnualRevenue),
      monthlyGrossProfit: Math.round(baseMonthlyGrossProfit),
      annualGrossProfit: Math.round(baseAnnualGrossProfit),
      monthlyNetProfit: Math.round(baseMonthlyNetProfit),
      annualNetProfit: Math.round(baseAnnualNetProfit),
    },
    projected: {
      monthlyCustomers: Math.round(projMonthlyCustomers * 10) / 10,
      monthlyRevenue: Math.round(projMonthlyRevenue),
      annualRevenue: Math.round(projAnnualRevenue),
      monthlyGrossProfit: Math.round(projAnnualGrossProfit / 12),
      annualGrossProfit: Math.round(projAnnualGrossProfit),
      monthlyNetProfit: Math.round(projMonthlyNetProfit),
      annualNetProfit: Math.round(projAnnualNetProfit),
    },
    growth: {
      revenueMultiplier: Math.round(revenueMultiplier * 100) / 100,
      grossProfitMultiplier: Math.round(grossProfitMultiplier * 100) / 100,
      netProfitMultiplier: Math.round(netProfitMultiplier * 100) / 100,
      revenueGrowthPct: Math.round(revenueGrowthPct * 10) / 10,
      grossProfitGrowthPct: Math.round(grossProfitGrowthPct * 10) / 10,
      netProfitGrowthPct: Math.round(netProfitGrowthPct * 10) / 10,
      extraAnnualRevenue: Math.round(extraAnnualRevenue),
      extraAnnualGrossProfit: Math.round(extraAnnualGrossProfit),
      extraAnnualNetProfit: Math.round(extraAnnualNetProfit),
    },
    leverOwnership,
  };
}

export function formatVndCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000000) {
    const val = parseFloat((amount / 1000000000).toFixed(2));
    return `${val} tỷ VNĐ`;
  }
  if (Math.abs(amount) >= 1000000) {
    const val = parseFloat((amount / 1000000).toFixed(1));
    return `${val} triệu VNĐ`;
  }
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export function formatFiveLeversPlanMarkdown(result: FiveLeversResult): string {
  const lines: string[] = [
    `# BẢN KẾ HOẠCH TĂNG TRƯỞNG KÉP 5 ĐÒN BẨY P&L (THE 5-LEVER COMPOUNDING PLAN)`,
    `*Khung chiến lược nhân đôi lợi nhuận ròng cho doanh nghiệp 5–20 nhân sự (The AI-First Company)*`,
    ``,
    `---`,
    `### 1. TỔNG QUAN TĂNG TRƯỞNG KÉP`,
    `- **Tăng trưởng Doanh thu hàng năm:** +${result.growth.revenueGrowthPct}% (${formatVndCurrency(result.baseline.annualRevenue)} ➔ **${formatVndCurrency(result.projected.annualRevenue)}**)`,
    `- **Hệ số Lợi nhuận gộp:** x${result.growth.grossProfitMultiplier} lần (+${result.growth.grossProfitGrowthPct}%)`,
    `- **Hệ số Lợi nhuận ròng:** x${result.growth.netProfitMultiplier} lần (+${result.growth.netProfitGrowthPct}%)`,
    `- **Dòng tiền dôi dư thực nhận thêm mỗi năm:** **+${formatVndCurrency(result.growth.extraAnnualNetProfit)}**`,
    ``,
    `---`,
    `### 2. PHÂN BỔ 5 ĐÒN BẨY & NHÂN SỰ SỐ PHỤ TRÁCH`,
  ];

  for (const lever of result.leverOwnership) {
    lines.push(
      `#### Đòn bẩy ${lever.symbol}: ${lever.leverName} (+${lever.improvementPct}%)`,
      `- **Phòng ban:** Zone ${lever.zone} - ${lever.departmentName}`,
      `- **Nhân sự số chủ lực:** \`${lever.recommendedAgentName}\` (${lever.recommendedAgentKey})`,
      `- **Playbook hành động:** ${lever.actionPlaybook}`,
      ``
    );
  }

  lines.push(
    `---`,
    `### 3. NGUYÊN TẮC THỰC THI 90 NGÀY`,
    `1. Không dồn toàn bộ tiền vào chi phí quảng cáo (Đòn bẩy L) khi chưa bịt các lỗ rò rỉ tỷ lệ chốt (CR) và giá sàn (M).`,
    `2. Cải thiện 10% ở 5 đòn bẩy cùng lúc đem lại lợi nhuận cao gấp 4 lần so với việc cày cuốc gấp đôi lượng leads.`,
    `3. Giao mỗi đòn bẩy cho đúng 1 nhân sự số phụ trách và đo lường định kỳ vào 17:00 chiều thứ Sáu.`
  );

  return lines.join("\n");
}

const STORAGE_KEY = "rai2_five_levers_input";

export function loadSavedFiveLeversInput(): FiveLeversInput {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_FIVE_LEVERS_INPUT;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FIVE_LEVERS_INPUT;
    return { ...DEFAULT_FIVE_LEVERS_INPUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FIVE_LEVERS_INPUT;
  }
}

export function saveFiveLeversInput(input: FiveLeversInput): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    }
  } catch {
    // Ignore storage quota errors
  }
}
