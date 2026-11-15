import type { ContextPillarId } from "./context-vault";
import type { TocDiagnosisResult } from "./toc-detector";
import { loadSavedFingerprint } from "@/components/CompanyFingerprintModal";

export interface MarginGuardConfig {
  targetGrossMargin?: number;
  targetNetMargin?: number;
  maxDiscountAllowed?: number;
  companyName?: string;
  paymentMilestones?: string[];
  rulesPrompt?: string;
}

export function isMarginGuardedRole(identifier: string | number): boolean {
  if (typeof identifier === "number") {
    return identifier === 1 || identifier === 3 || identifier === 6;
  }
  const s = String(identifier || "").toLowerCase().trim();
  if (
    s.includes("zone-1") ||
    s.includes("z1") ||
    s.includes("strategy") ||
    s.includes("chiến lược") ||
    s.includes("điều hành")
  ) return true;
  if (
    s.includes("zone-3") ||
    s.includes("z3") ||
    s.includes("quote") ||
    s.includes("close") ||
    s.includes("sales") ||
    s.includes("bán hàng") ||
    s.includes("kinh doanh")
  ) return true;
  if (
    s.includes("zone-6") ||
    s.includes("z6") ||
    s.includes("margin") ||
    s.includes("cash") ||
    s.includes("finance") ||
    s.includes("tài chính") ||
    s.includes("dòng tiền")
  ) return true;
  return false;
}

export interface BotContextAllocation {
  pillars: ContextPillarId[];
  injectToc: boolean;
  tocSummaryRequired: boolean;
}

/**
 * Role-Based Context Allocation Matrix
 * Strictly adheres to the principle of "Single-Task Depth" and Token Optimization (-80% Token Overhead).
 */
export const BOT_ROLE_CONTEXT_MAP: Record<string, BotContextAllocation> = {
  // Z2: Marketing & Lead
  "rai-lead": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown"],
    injectToc: true,
    tocSummaryRequired: false,
  },
  "rai-copy": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown", "case_studies"],
    injectToc: false,
    tocSummaryRequired: false,
  },

  // Z3: Sales & Closing
  "rai-closer": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown", "sales_process", "case_studies"],
    injectToc: true,
    tocSummaryRequired: true,
  },

  // Z4: Operations & SOP Execution
  "rai-coach": {
    pillars: ["brand_voice", "offer_breakdown", "sops"],
    injectToc: true,
    tocSummaryRequired: true,
  },

  // Z5: Customer Care & Retention
  "rai-care": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown", "sales_process", "sops"],
    injectToc: false,
    tocSummaryRequired: false,
  },

  // Z6: Finance & P&L
  "rai-margin": {
    pillars: ["brand_voice", "offer_breakdown", "industry_context"],
    injectToc: true,
    tocSummaryRequired: true,
  },

  // Z7: Talent & HR
  "rai-talent": {
    pillars: ["brand_voice", "sops", "industry_context"],
    injectToc: false,
    tocSummaryRequired: false,
  },

  // Z1: Executive Strategy & TOC Overseer (Full context access)
  "rai-strategy": {
    pillars: [
      "brand_voice",
      "customer_avatar",
      "offer_breakdown",
      "competitive_positioning",
      "sales_process",
      "case_studies",
      "sops",
      "industry_context",
    ],
    injectToc: true,
    tocSummaryRequired: true,
  },

  // Zone aliases for custom bot creation
  "zone-1": {
    pillars: [
      "brand_voice",
      "customer_avatar",
      "offer_breakdown",
      "competitive_positioning",
      "sales_process",
      "case_studies",
      "sops",
      "industry_context",
    ],
    injectToc: true,
    tocSummaryRequired: true,
  },
  "zone-2": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown"],
    injectToc: true,
    tocSummaryRequired: false,
  },
  "zone-3": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown", "sales_process", "case_studies"],
    injectToc: true,
    tocSummaryRequired: true,
  },
  "zone-4": {
    pillars: ["brand_voice", "offer_breakdown", "sops"],
    injectToc: true,
    tocSummaryRequired: true,
  },
  "zone-5": {
    pillars: ["brand_voice", "customer_avatar", "offer_breakdown", "sales_process", "sops"],
    injectToc: false,
    tocSummaryRequired: false,
  },
  "zone-6": {
    pillars: ["brand_voice", "offer_breakdown", "industry_context"],
    injectToc: true,
    tocSummaryRequired: true,
  },
  "zone-7": {
    pillars: ["brand_voice", "sops", "industry_context"],
    injectToc: false,
    tocSummaryRequired: false,
  },

  // Default fallback for custom/free assistants: zero enterprise injection to ensure isolation
  default: {
    pillars: [],
    injectToc: false,
    tocSummaryRequired: false,
  },
};

export interface DepartmentZoneOption {
  zone: number;
  code: string;
  name: string;
  shortName: string;
  description: string;
  defaultBotKey: string;
}

export const RAI2_DEPARTMENT_ZONES: DepartmentZoneOption[] = [
  { zone: 1, code: "Z1", shortName: "Z1 Điều Hành", name: "Văn Phòng Điều Hành & Chiến Lược", description: "Bao quát 8 trụ cột tri thức và điều phối", defaultBotKey: "rai-strategy" },
  { zone: 2, code: "Z2", shortName: "Z2 Marketing", name: "Phòng Marketing & Thu Hút Lead", description: "Thu hút khách hàng tiềm năng, sản xuất nội dung", defaultBotKey: "rai-lead" },
  { zone: 3, code: "Z3", shortName: "Z3 Bán Hàng", name: "Phòng Kinh Doanh & Chốt Hợp Đồng", description: "Tư vấn, báo giá thần tốc và xử lý từ chối", defaultBotKey: "rai-closer" },
  { zone: 4, code: "Z4", shortName: "Z4 Vận Hành", name: "Phòng Thực Thi & Giám Sát Vận Hành", description: "Đảm bảo tiến độ, chất lượng và chuẩn hóa SOP", defaultBotKey: "rai-coach" },
  { zone: 5, code: "Z5", shortName: "Z5 CSKH", name: "Phòng Chăm Sóc Khách Hàng", description: "Chăm sóc sau bán, xử lý sự vụ và giữ chân khách", defaultBotKey: "rai-care" },
  { zone: 6, code: "Z6", shortName: "Z6 Tài Chính", name: "Phòng Tài Chính & Bảo Vệ Dòng Tiền", description: "Kiểm soát biên lãi, dòng tiền và đòn bẩy P&L", defaultBotKey: "rai-margin" },
  { zone: 7, code: "Z7", shortName: "Z7 Nhân Sự", name: "Phòng Nhân Sự, Đào Tạo & Văn Hóa", description: "Tuyển dụng nhân tài và đào tạo năng lực", defaultBotKey: "rai-talent" },
];

/**
 * Resolves context allocation by checking Bot ID, Zone code, or Department name.
 */
export function resolveBotContextAllocation(identifier: string | number): BotContextAllocation {
  if (typeof identifier === "number") {
    const zoneKey = `zone-${identifier}`;
    if (BOT_ROLE_CONTEXT_MAP[zoneKey]) return BOT_ROLE_CONTEXT_MAP[zoneKey];
  }
  const normalized = String(identifier || "").toLowerCase().trim();
  if (BOT_ROLE_CONTEXT_MAP[normalized]) {
    return BOT_ROLE_CONTEXT_MAP[normalized];
  }
  if (normalized.includes("zone-1") || normalized.includes("z1") || normalized.includes("điều hành") || normalized.includes("chiến lược") || normalized.includes("strategy")) {
    return BOT_ROLE_CONTEXT_MAP["rai-strategy"];
  }
  if (normalized.includes("zone-2") || normalized.includes("z2") || normalized.includes("marketing") || normalized.includes("lead") || normalized.includes("copy")) {
    return BOT_ROLE_CONTEXT_MAP["rai-lead"];
  }
  if (normalized.includes("zone-3") || normalized.includes("z3") || normalized.includes("kinh doanh") || normalized.includes("bán hàng") || normalized.includes("sales") || normalized.includes("closer")) {
    return BOT_ROLE_CONTEXT_MAP["rai-closer"];
  }
  if (normalized.includes("zone-4") || normalized.includes("z4") || normalized.includes("vận hành") || normalized.includes("thực thi") || normalized.includes("sop") || normalized.includes("coach")) {
    return BOT_ROLE_CONTEXT_MAP["rai-coach"];
  }
  if (normalized.includes("zone-5") || normalized.includes("z5") || normalized.includes("cskh") || normalized.includes("chăm sóc") || normalized.includes("care")) {
    return BOT_ROLE_CONTEXT_MAP["rai-care"];
  }
  if (normalized.includes("zone-6") || normalized.includes("z6") || normalized.includes("tài chính") || normalized.includes("dòng tiền") || normalized.includes("margin") || normalized.includes("p&l")) {
    return BOT_ROLE_CONTEXT_MAP["rai-margin"];
  }
  if (normalized.includes("zone-7") || normalized.includes("z7") || normalized.includes("nhân sự") || normalized.includes("tuyển dụng") || normalized.includes("đào tạo") || normalized.includes("talent")) {
    return BOT_ROLE_CONTEXT_MAP["rai-talent"];
  }
  return BOT_ROLE_CONTEXT_MAP.default;
}


const PILLAR_FILE_NAMES: Record<ContextPillarId, string> = {
  brand_voice: "brand_voice.md",
  customer_avatar: "customer_avatar.md",
  offer_breakdown: "offer_breakdown.md",
  competitive_positioning: "positioning.md",
  sales_process: "sales_process.md",
  case_studies: "case_studies.md",
  sops: "standard_operating_procedures.md",
  industry_context: "industry_context.md",
};

const PILLAR_HEADINGS: Record<ContextPillarId, string> = {
  brand_voice: "# 1. Brand Voice DNA (Ngôn Ngữ & Phong Cách Thương Hiệu)",
  customer_avatar: "# 2. Deep Customer Avatar (Chân Dung Khách Hàng Mục Tiêu)",
  offer_breakdown: "# 3. Offer & Core Product Breakdown (Sản Phẩm & Lời Chào Hàng Cốt Lõi)",
  competitive_positioning: "# 4. Competitive Positioning (Bản Đồ Định Vị Đối Thủ)",
  sales_process: "# 5. Sales Process & Handling (Quy Trình Bán Hàng & Xử Lý Từ Chối)",
  case_studies: "# 6. Case Studies & Proof (Bằng Chứng & Ca Thành Công Thực Tế)",
  sops: "# 7. Standard Operating Procedures (Quy Trình Chuẩn SOP Vận Hành)",
  industry_context: "# 8. Industry Context & Macro (Bối Cảnh Ngành & Quy Định)",
};

/**
 * Builds the customized memory file bundle for a specific bot role or department based on current Vault and TOC data.
 */
export function buildBotMemoryBundle(
  botIdOrDepartment: string | number,
  vaultContents: Record<ContextPillarId, string> | null,
  tocDiagnosis: TocDiagnosisResult | null,
  customFingerprint?: MarginGuardConfig | null
): Record<string, string> {
  const allocation = resolveBotContextAllocation(botIdOrDepartment);
  const memoryBundle: Record<string, string> = {};

  // 1. Inject designated Vault Pillars
  if (vaultContents) {
    for (const pillarId of allocation.pillars) {
      const text = vaultContents[pillarId];
      if (text && text.trim().length > 0) {
        const fileName = `memory/${PILLAR_FILE_NAMES[pillarId]}`;
        const heading = PILLAR_HEADINGS[pillarId];
        memoryBundle[fileName] = `${heading}\n\n${text.trim()}\n`;
      }
    }
  }

  // 2. Inject TOC Diagnosis & Levers if applicable
  if (allocation.injectToc && tocDiagnosis) {
    let tocContent = `# BÁO CÁO ĐIỂM NGHẼN RÀNG BUỘC (TOC) & 5 ĐÒN BẨY P&L\n\n`;
    tocContent += `**Vùng Điểm Nghẽn:** Vùng ${tocDiagnosis.zoneNumber} (${tocDiagnosis.departmentName})\n`;
    tocContent += `**Tình trạng:** ${tocDiagnosis.urgencyLevel}\n`;
    tocContent += `**Chẩn đoán:** ${tocDiagnosis.title}\n`;
    tocContent += `**Mô tả:** ${tocDiagnosis.description}\n\n`;

    if (tocDiagnosis.upstreamBlockWarning) {
      tocContent += `> ⚠️ **CẢNH BÁO KHÓA VAN:** ${tocDiagnosis.upstreamBlockWarning}\n\n`;
    }

    if (allocation.tocSummaryRequired) {
      tocContent += `## 5 Đòn Bẩy P&L Cần Hướng Tới:\n`;
      tocContent += `- L1 (Tăng trưởng lead): +${tocDiagnosis.levers.lever1MarketingLeadGrowth}%\n`;
      tocContent += `- L2 (Nén thời gian phản hồi): +${tocDiagnosis.levers.lever2TurnaroundCompressionRatio}%\n`;
      tocContent += `- L3 (Giảm lãng phí/lỗi): +${(tocDiagnosis.levers.lever3ErrorReductionCost / 1_000_000).toFixed(0)} Tr.đ\n`;
      tocContent += `- L4 (Biên lợi nhuận ròng dự phóng): ≥${tocDiagnosis.levers.projectedNetMargin}%\n`;
      tocContent += `- L5 (Tái đầu tư mở rộng): +${(tocDiagnosis.levers.lever5ReinvestmentPool / 1_000_000).toFixed(1)} Tr.đ/tháng\n`;
    }

    memoryBundle["memory/business_toc.md"] = tocContent;
  }

  // 3. Inject Margin Guard Hard Rules for Zone 3 (Sales/Quote), Zone 6 (Finance/Margin), and Zone 1 (Strategy)
  if (isMarginGuardedRole(botIdOrDepartment)) {
    let fingerprint = customFingerprint;
    if (!fingerprint && typeof window !== "undefined") {
      try {
        fingerprint = loadSavedFingerprint();
      } catch {
        fingerprint = null;
      }
    }

    const floorMargin =
      fingerprint?.targetGrossMargin ??
      fingerprint?.targetNetMargin ??
      35;
    const maxDiscount = fingerprint?.maxDiscountAllowed ?? 5;
    const company = fingerprint?.companyName?.trim() || "Doanh nghiệp";
    const milestones = (fingerprint?.paymentMilestones && fingerprint.paymentMilestones.length > 0)
      ? fingerprint.paymentMilestones.map((m, i) => `${i + 1}. ${m}`).join("\n")
      : "1. 50% đặt cọc ngay khi ký hợp đồng/chốt phương án.\n2. 40% nghiệm thu giai đoạn/tập kết vật tư.\n3. 10% thanh toán dứt điểm trong vòng 24h sau khi bàn giao nghiệm thu.";

    const marginGuardDoc = [
      "# CẦU DAO BẢO VỆ BIÊN LÃI (MARGIN GUARD PROTOCOL)",
      "",
      `Áp dụng nghiêm ngặt cho toàn bộ hoạt động Báo giá, Đàm phán và Chốt hợp đồng tại ${company}.`,
      "",
      "## 1. Ngưỡng Biên Lợi Nhuận Sàn (Floor Gross Margin)",
      `- **Biên lợi nhuận sàn bắt buộc:** ≥ **${floorMargin}%**.`,
      `- **Ranh giới đỏ:** TUYỆT ĐỐI KHÔNG tự ý báo giá, giảm giá hoặc đồng ý các yêu cầu khiến biên lợi nhuận rớt dưới **${floorMargin}%**.`,
      "",
      "## 2. Hạn Mức Chiết Khấu Tối Đa (Discount Ceiling)",
      `- **Mức chiết khấu tối đa được phép:** ≤ **${maxDiscount}%**.`,
      "- **Nguyên tắc Quid-Pro-Quo (Đổi Giá Trị Lấy Giá):** Mọi khoản giảm giá PHẢI đi kèm điều kiện trao đổi:",
      "  1. Thanh toán sớm 100% trước hoặc đặt cọc trong vòng 24h.",
      "  2. Tăng số lượng đơn hàng hoặc cam kết hợp đồng dài hạn.",
      "  3. Lược bớt hạng mục công việc, giảm bớt quà tặng hoặc bảo hành mở rộng.",
      "  *(CẤM giảm giá suông vô điều kiện).* ",
      "",
      "## 3. Các Mốc Thanh Toán & Dòng Tiền:",
      milestones,
      "",
      "## 4. Cắt Cầu Dao Tự Động & Kích Hoạt Human-In-The-Loop (HITL)",
      `- Khi khách hàng ép giá dưới sàn hoặc đòi chiết khấu > ${maxDiscount}%:`,
      "  - Cắt cầu dao ngay lập tức: Dừng việc tự ý thương lượng giá.",
      "  - Phản hồi lịch sự theo kịch bản chuẩn:",
      '    > *"Dạ mức giá/chiết khấu này vượt thẩm quyền của em. Em xin phép ghi nhận và chuyển ngay hồ sơ đề xuất này lên Người Sáng Lập / Ban Giám Đốc để xem xét phê duyệt riêng cho anh/chị ạ."*',
      "  - Chuyển giao ngay thông tin deal cho Người Sáng Lập duyệt ngoại lệ.",
    ].join("\n");

    memoryBundle["memory/margin_guard.md"] = marginGuardDoc;

    const rulesDoc = [
      "# QUY TẮC CỐT TỬ (CORE OPERATING RULES)",
      "",
      "## CẦU DAO MARGIN GUARD & KỶ LUẬT GIÁ",
      `1. **Bảo vệ biên lãi:** Mọi đề xuất giá phải bảo đảm biên lợi nhuận ≥ ${floorMargin}%.`,
      `2. **Trần chiết khấu:** Không tự ý chiết khấu vượt quá ${maxDiscount}%, mọi chiết khấu phải có điều kiện bù đắp.`,
      "3. **Kích hoạt HITL khi chạm sàn:** Khi khách ép giá dưới sàn, kích hoạt quy trình từ chối lịch thiệp và chuyển Người Sáng Lập duyệt.",
    ].join("\n");

    memoryBundle["memory/rules.md"] = rulesDoc;

    memoryBundle["MEMORY.md"] = [
      "# BỘ NHỚ LÕI & NGUYÊN TẮC VẬN HÀNH",
      "",
      `- [MARGIN GUARD]: Biên lợi nhuận sàn ≥${floorMargin}%, Chiết khấu tối đa ≤${maxDiscount}%. Cấm hạ giá dưới sàn. Vượt hạn mức: kích hoạt HITL chuyển Người Sáng Lập duyệt.`,
    ].join("\n");
  }

  return memoryBundle;
}

const CUSTOM_NOTE_SPLITTER = "\n\n--- GHI CHÚ RIÊNG CỦA NHÂN SỰ ---\n";

/**
 * Merges a newly synced memory file with any custom user-added notes from the existing memory.
 * Preserves custom notes while updating the company-wide knowledge base.
 */
export function mergeMemoryWithCustomNotes(existingText: string | undefined, newStandardText: string): string {
  if (!existingText || !existingText.trim()) {
    return newStandardText;
  }
  // Check if existing text contains custom notes section
  if (existingText.includes(CUSTOM_NOTE_SPLITTER)) {
    const parts = existingText.split(CUSTOM_NOTE_SPLITTER);
    const customPart = parts.slice(1).join(CUSTOM_NOTE_SPLITTER).trim();
    if (customPart) {
      return `${newStandardText.trim()}${CUSTOM_NOTE_SPLITTER}${customPart}\n`;
    }
  }
  return newStandardText;
}

