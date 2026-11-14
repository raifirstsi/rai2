import { loadSavedContextVault, saveContextVaultToStorage } from "./context-vault";

export type SopCategory =
  | "sales"
  | "delivery"
  | "support"
  | "operations"
  | "finance"
  | "hr"
  | "general";

export interface ExtractedSop {
  id: string;
  title: string;
  category: SopCategory;
  trigger: string;
  steps: string[];
  guardrails: string[];
  definitionOfDone: string;
  createdAt: string;
  rawInputSnippet?: string;
}

export const SOP_CATEGORY_LABELS: Record<SopCategory, string> = {
  sales: "Bán hàng & Chốt hợp đồng",
  delivery: "Bàn giao & Thực thi dịch vụ",
  support: "Chăm sóc & Xử lý sự cố",
  operations: "Vận hành nội bộ",
  finance: "Tài chính & Dòng tiền",
  hr: "Nhân sự & Đào tạo",
  general: "Quy chuẩn chung",
};

function inferCategoryFromText(text: string): SopCategory {
  const lower = text.toLowerCase();
  if (lower.includes("khiếu nại") || lower.includes("phàn nàn") || lower.includes("bảo hành") || lower.includes("hỗ trợ khách") || lower.includes("chăm sóc")) {
    return "support";
  }
  if (lower.includes("bán hàng") || lower.includes("báo giá") || lower.includes("chốt đơn") || lower.includes("chiết khấu")) {
    return "sales";
  }
  if (lower.includes("giao hàng") || lower.includes("thi công") || lower.includes("bàn giao") || lower.includes("nghiệm thu")) {
    return "delivery";
  }
  if (lower.includes("thanh toán") || lower.includes("công nợ") || lower.includes("chi phí") || lower.includes("hóa đơn")) {
    return "finance";
  }
  if (lower.includes("tuyển dụng") || lower.includes("đào tạo") || lower.includes("nhân viên") || lower.includes("thử việc")) {
    return "hr";
  }
  if (lower.includes("vận hành") || lower.includes("kiểm kê") || lower.includes("nhập kho") || lower.includes("báo cáo")) {
    return "operations";
  }
  return "general";
}

function extractTitleFromText(text: string, fallbackTitle?: string): string {
  if (fallbackTitle?.trim()) return fallbackTitle.trim();

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleaned = line.replace(/^[#\-*0-9.)\s]+/, "").trim();
    if (cleaned.length >= 6 && cleaned.length <= 80) {
      if (cleaned.toLowerCase().startsWith("sop") || cleaned.toLowerCase().startsWith("quy trình")) {
        return cleaned;
      }
      return `Quy trình ${cleaned}`;
    }
  }

  return "Quy trình Vận hành Tiêu chuẩn";
}

export function compileMonologueToSop(
  transcriptOrNotes: string,
  options?: {
    defaultTitle?: string;
    category?: SopCategory;
  }
): ExtractedSop {
  const trimmed = transcriptOrNotes.trim();
  const inferredCat = options?.category || inferCategoryFromText(trimmed);
  const title = extractTitleFromText(trimmed, options?.defaultTitle);

  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let trigger = "";
  const steps: string[] = [];
  const guardrails: string[] = [];
  let definitionOfDone = "";

  let currentSection: "trigger" | "steps" | "guardrails" | "dod" | "none" = "none";

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Check section header indicators
    if (lower.includes("bối cảnh") || lower.includes("kích hoạt") || lower.includes("trigger") || lower.startsWith("khi ")) {
      currentSection = "trigger";
      const content = line.replace(/^(bối cảnh|kích hoạt|trigger|khi\s*:?)/i, "").replace(/^[#\-*:\s]+/, "").trim();
      if (content) trigger = content;
      continue;
    }

    if (lower.includes("bước") || lower.includes("thực hiện") || lower.includes("checklist") || lower.includes("các bước")) {
      currentSection = "steps";
      const content = line.replace(/^(các bước|thực hiện|checklist|bước\s*\d*:?)/i, "").replace(/^[#\-*:\s]+/, "").trim();
      if (content) steps.push(content);
      continue;
    }

    if (lower.includes("lưu ý") || lower.includes("cấm") || lower.includes("không được") || lower.includes("ranh giới") || lower.includes("giới hạn")) {
      currentSection = "guardrails";
      const content = line.replace(/^(lưu ý|cấm|không được|ranh giới|giới hạn:?)/i, "").replace(/^[#\-*:\s]+/, "").trim();
      if (content) guardrails.push(content);
      continue;
    }

    if (lower.includes("hoàn thành") || lower.includes("nghiệm thu") || lower.includes("tiêu chuẩn") || lower.includes("kết thúc") || lower.includes("dod")) {
      currentSection = "dod";
      const content = line.replace(/^(hoàn thành|nghiệm thu|tiêu chuẩn|kết thúc|dod:?)/i, "").replace(/^[#\-*:\s]+/, "").trim();
      if (content) definitionOfDone = content;
      continue;
    }

    // Line is content under current section
    const cleanLine = line.replace(/^[#\-*0-9.)\s]+/, "").trim();
    if (!cleanLine) continue;

    if (currentSection === "trigger" && !trigger) {
      trigger = cleanLine;
    } else if (currentSection === "guardrails") {
      guardrails.push(cleanLine);
    } else if (currentSection === "dod" && !definitionOfDone) {
      definitionOfDone = cleanLine;
    } else {
      // Default or inside steps
      if (
        lower.startsWith("không được") ||
        lower.startsWith("tuyệt đối") ||
        lower.startsWith("cấm") ||
        lower.startsWith("lưu ý")
      ) {
        guardrails.push(cleanLine);
      } else {
        steps.push(cleanLine);
      }
    }
  }

  // Fallback defaults if monologue was brief or unstructured
  if (!trigger) {
    trigger = `Kích hoạt khi phát sinh yêu cầu liên quan đến ${title.toLowerCase()}.`;
  }
  if (steps.length === 0) {
    steps.push("Tiếp nhận thông tin chi tiết và xác minh tính chính xác của dữ liệu đầu vào.");
    steps.push("Thực thi theo quy chuẩn nghiệp vụ chuyên môn và đối soát kết quả.");
    steps.push("Gửi biên bản hoặc thông báo xác nhận hoàn thành đến các bên liên quan.");
  }
  if (guardrails.length === 0) {
    guardrails.push("Tuyệt đối không tự ý cam kết vượt thẩm quyền hoặc vượt ngân sách được giao.");
    guardrails.push("Bảo đảm tuân thủ nguyên tắc bảo mật thông tin và biên lợi nhuận của doanh nghiệp.");
  }
  if (!definitionOfDone) {
    definitionOfDone = "Khách hàng hoặc quản lý xác nhận nghiệm thu đạt yêu cầu, dữ liệu lưu trữ đầy đủ vào hệ thống.";
  }

  const generatedId = `SOP-${Date.now().toString(36).toUpperCase()}`;

  return {
    id: generatedId,
    title,
    category: inferredCat,
    trigger,
    steps,
    guardrails,
    definitionOfDone,
    createdAt: new Date().toISOString(),
    rawInputSnippet: trimmed.slice(0, 300),
  };
}

export function formatSopToMarkdown(sop: ExtractedSop): string {
  const categoryLabel = SOP_CATEGORY_LABELS[sop.category] || sop.category;
  const stepsMd = sop.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n");
  const guardrailsMd = sop.guardrails.map((g) => `- ⚠️ ${g}`).join("\n");

  return `### ${sop.title}
- **Mã quy trình:** \`${sop.id}\`
- **Phân loại nghiệp vụ:** ${categoryLabel}
- **Ngày chuẩn hóa:** ${new Date(sop.createdAt).toLocaleDateString("vi-VN")}

#### 1. Bối cảnh & Điều kiện kích hoạt (Trigger)
${sop.trigger}

#### 2. Các bước thực thi tuần tự (Execution Checklist)
${stepsMd}

#### 3. Ranh giới cấm & Quy tắc an toàn (Guardrails & Limits)
${guardrailsMd}

#### 4. Tiêu chuẩn hoàn thành (Definition of Done)
- ✅ ${sop.definitionOfDone}
`;
}

export function appendSopToVaultMarkdown(existingMarkdown: string, sop: ExtractedSop): string {
  const formatted = formatSopToMarkdown(sop).trim();
  const base = existingMarkdown.trim();

  if (!base) {
    return `# STANDARD OPERATING PROCEDURES (SOP) - RAI² FIRST OS\n\n${formatted}\n`;
  }

  // Prevent duplicate insertion by checking SOP code or title
  if (base.includes(`\`${sop.id}\``) || base.includes(`### ${sop.title}`)) {
    return base;
  }

  return `${base}\n\n---\n\n${formatted}\n`;
}

export function saveSopToVault(
  sop: ExtractedSop,
  customVaultContents?: Record<string, string>
): {
  updatedContents: Record<string, string>;
  sopMarkdown: string;
} {
  const current = customVaultContents || loadSavedContextVault() || ({} as Record<string, string>);
  const existingSops = current.sops || "";
  const updatedSops = appendSopToVaultMarkdown(existingSops, sop);

  const updatedContents: Record<string, string> = {
    ...current,
    sops: updatedSops,
  };

  saveContextVaultToStorage(updatedContents as Parameters<typeof saveContextVaultToStorage>[0]);

  return {
    updatedContents,
    sopMarkdown: formatSopToMarkdown(sop),
  };
}
