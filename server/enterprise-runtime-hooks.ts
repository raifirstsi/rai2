import { getEnterpriseStateStore } from "./enterprise-state.ts";
import { getRai2EntitlementSnapshot } from "./rai2-entitlement.ts";
import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";

export interface EnterpriseBotLike {
  id?: string;
  name?: string;
  section?: string;
  playbooks?: ReadonlyArray<string | { id?: string; name?: string; title?: string }>;
}

export function isEnterpriseRuntimeBot(bot: EnterpriseBotLike | null | undefined): boolean {
  if (!bot) return false;
  if (typeof bot.section === "string" && bot.section.trim().length > 0) return true;
  if (Array.isArray(bot.playbooks) && bot.playbooks.some((p) => {
    const label = typeof p === "string" ? p : (p?.name ?? p?.title ?? p?.id ?? "");
    return /toc|margin|vault|enterprise|zone/i.test(label);
  })) {
    return true;
  }
  return false;
}

const PILLAR_LABELS: Array<[string, string]> = [
  ["vision", "Tầm nhìn & Sứ mệnh"],
  ["products", "Sản phẩm / Dịch vụ cốt lõi"],
  ["pricing", "Bảng giá & Biên lợi nhuận chuẩn"],
  ["idealCustomer", "Khách hàng mục tiêu (ICP)"],
  ["salesProcess", "Quy trình bán hàng & Chốt đơn"],
  ["toneOfVoice", "Giọng văn & Phong cách thương hiệu"],
  ["forbiddenRules", "Điều cấm kỵ & Ranh giới đỏ"],
  ["kpis", "KPI & Chỉ số vận hành bắt buộc"],
];

/**
 * Builds the live Enterprise OS runtime system prompt section from persisted EnterpriseStateStore
 * (Context Vault 8 pillars, TOC bottleneck diagnosis, and Margin Guard P&L thresholds).
 * Returns empty string for Personal bots or non-VIP accounts (zero leakage).
 */
export function buildEnterprisePromptSection(
  bot: EnterpriseBotLike | null | undefined,
  workspaceId = "default",
): string {
  const ent = getRai2EntitlementSnapshot();
  if (!ent.enterpriseAccess) return "";
  if (!isEnterpriseRuntimeBot(bot)) return "";

  const state = getEnterpriseStateStore().getState(workspaceId);
  const parts: string[] = [];

  const pillars = state.contextVault?.pillars ?? {};
  const pillarLines: string[] = [];
  for (const [key, label] of PILLAR_LABELS) {
    const val = typeof pillars[key] === "string" ? pillars[key].trim() : "";
    if (val) {
      pillarLines.push(`- ${label}: ${val}`);
    }
  }
  if (pillarLines.length > 0) {
    parts.push(
      `### KÉT SẮT NGỮ CẢNH DOANH NGHIỆP (8 TRỤ CỘT)${state.contextVault?.hardGateLocked ? " [HARD-GATE LOCKED]" : ""}\n${pillarLines.join("\n")}`,
    );
  }

  if (state.tocDiagnosis && typeof state.tocDiagnosis === "object") {
    const d = state.tocDiagnosis as Record<string, unknown>;
    const summaryBits = [
      typeof d.bottleneckZone === "string" && d.bottleneckZone ? `Vùng nghẽn #1: ${d.bottleneckZone}` : "",
      typeof d.symptom === "string" && d.symptom ? `Triệu chứng: ${d.symptom}` : "",
      typeof d.rootCause === "string" && d.rootCause ? `Nguyên nhân gốc: ${d.rootCause}` : "",
      typeof d.actionPlan === "string" && d.actionPlan ? `Hành động tháo nghẽn: ${d.actionPlan}` : "",
    ].filter(Boolean);
    if (summaryBits.length > 0) {
      parts.push(`### ĐIỂM NGHẼN TOC HIỆN TẠI\n${summaryBits.map((b) => `- ${b}`).join("\n")}`);
    }
  }

  const minMargin = state.marginGuard?.minThresholdPct ?? 18;
  const maxDiscount = state.marginGuard?.maxDiscountPct ?? 15;
  parts.push(
    [
      "### CẦU DAO MARGIN GUARD (BẢO VỆ BIÊN LỢI NHUẬN BẮT BUỘC)",
      `- Biên lợi nhuận ròng tối thiểu: ${minMargin}%`,
      `- Chiết khấu tối đa cho phép không cần duyệt: ${maxDiscount}%`,
      `- TUYỆT ĐỐI KHÔNG tự ý đề xuất giảm giá > ${maxDiscount}% hoặc để biên lợi nhuận < ${minMargin}% khi chưa có phê duyệt của Founder.`,
    ].join("\n"),
  );

  return `\n[ENTERPRISE OS RUNTIME CONTEXT]\n${parts.join("\n\n")}`;
}

export interface MarginGuardCheckResult {
  violated: boolean;
  reason?: string;
  detectedDiscountPct?: number;
  detectedMarginPct?: number;
  minThresholdPct: number;
  maxDiscountPct: number;
  warningBanner?: string;
}

const DISCOUNT_RE = /(?:chiết khấu|giảm giá|giảm|ưu đãi|discount|off)\s*(?:tới|đến|lên tới|ngay|thêm|còn|khoảng|=|:)?\s*(\d+(?:[.,]\d+)?)\s*%/gi;
const MARGIN_RE = /(?:biên lợi nhuận|lợi nhuận ròng|margin|gross margin)\s*(?:còn|là|chỉ|khoảng|=|:)?\s*(\d+(?:[.,]\d+)?)\s*%/gi;

/**
 * Server-side Margin Guard scanner for outgoing Enterprise bot replies.
 */
export function checkServerMarginGuard(
  text: string,
  workspaceId = "default",
  actor = "bot",
): MarginGuardCheckResult {
  const state = getEnterpriseStateStore().getState(workspaceId);
  const minThresholdPct = state.marginGuard?.minThresholdPct ?? 18;
  const maxDiscountPct = state.marginGuard?.maxDiscountPct ?? 15;

  let maxSeenDiscount: number | undefined;
  let minSeenMargin: number | undefined;

  for (const m of text.matchAll(DISCOUNT_RE)) {
    const val = Number.parseFloat((m[1] ?? "").replace(",", "."));
    if (Number.isFinite(val) && (maxSeenDiscount === undefined || val > maxSeenDiscount)) {
      maxSeenDiscount = val;
    }
  }
  for (const m of text.matchAll(MARGIN_RE)) {
    const val = Number.parseFloat((m[1] ?? "").replace(",", "."));
    if (Number.isFinite(val) && (minSeenMargin === undefined || val < minSeenMargin)) {
      minSeenMargin = val;
    }
  }

  const discountViolation = maxSeenDiscount !== undefined && maxSeenDiscount > maxDiscountPct;
  const marginViolation = minSeenMargin !== undefined && minSeenMargin < minThresholdPct;

  if (!discountViolation && !marginViolation) {
    return { violated: false, minThresholdPct, maxDiscountPct };
  }

  const reasons: string[] = [];
  if (discountViolation) {
    reasons.push(`Chiết khấu ${maxSeenDiscount}% vượt trần ${maxDiscountPct}%`);
  }
  if (marginViolation) {
    reasons.push(`Biên lợi nhuận ${minSeenMargin}% thấp hơn ngưỡng tối thiểu ${minThresholdPct}%`);
  }
  const reason = reasons.join("; ");
  const warningBanner = `[⚠️ MARGIN GUARD SERVER ALERT] ${reason}. Cần Founder phê duyệt ngoại lệ trước khi áp dụng.`;

  try {
    getWorkspaceAuditLedger().append(workspaceId, actor, "enterprise.margin_guard_triggered", {
      reason,
      detectedDiscountPct: maxSeenDiscount,
      detectedMarginPct: minSeenMargin,
      minThresholdPct,
      maxDiscountPct,
    });
  } catch {
    // Non-fatal
  }

  return {
    violated: true,
    reason,
    detectedDiscountPct: maxSeenDiscount,
    detectedMarginPct: minSeenMargin,
    minThresholdPct,
    maxDiscountPct,
    warningBanner,
  };
}
