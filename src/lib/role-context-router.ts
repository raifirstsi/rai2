import type { ContextPillarId } from "./context-vault";
import type { TocDiagnosisResult } from "./toc-detector";

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

  // Default fallback for general assistants
  default: {
    pillars: ["brand_voice"],
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
export function resolveBotContextAllocation(identifier: string): BotContextAllocation {
  const normalized = (identifier || "").toLowerCase().trim();
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
  botIdOrDepartment: string,
  vaultContents: Record<ContextPillarId, string> | null,
  tocDiagnosis: TocDiagnosisResult | null
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

