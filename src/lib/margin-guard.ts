export type MarginGuardStatus =
  | "APPROVED"
  | "BLOCKED"
  | "CRITICAL_DANGER"
  | "INVALID";

export interface MarginQuoteInput {
  proposedPrice: number;
  directCosts: number;
  minMarginThresholdPct?: number;
  offerName?: string;
  clientName?: string;
  scopeSummary?: string;
}

export interface MarginQuoteEvaluation {
  proposedPrice: number;
  directCosts: number;
  grossMarginAmount: number;
  grossMarginPct: number;
  minMarginThresholdPct: number;
  status: MarginGuardStatus;
  badgeText: string;
  reason: string;
  escalationRequired: boolean;
  recommendedMinPrice: number;
  potentialNetProfitEstimate: number;
  evaluatedAt: string;
}

export const DEFAULT_MIN_MARGIN_THRESHOLD_PCT = 35;

export function evaluateMarginQuote(input: MarginQuoteInput): MarginQuoteEvaluation {
  const minThreshold =
    typeof input.minMarginThresholdPct === "number" && input.minMarginThresholdPct > 0
      ? input.minMarginThresholdPct
      : DEFAULT_MIN_MARGIN_THRESHOLD_PCT;

  const price = input.proposedPrice;
  const costs = input.directCosts;
  const now = new Date().toISOString();

  if (price <= 0 || costs < 0) {
    return {
      proposedPrice: price,
      directCosts: costs,
      grossMarginAmount: 0,
      grossMarginPct: 0,
      minMarginThresholdPct: minThreshold,
      status: "INVALID",
      badgeText: "DỮ LIỆU KHÔNG HỢP LỆ",
      reason: "Giá bán đề xuất phải lớn hơn 0 và chi phí vốn không được là số âm.",
      escalationRequired: true,
      recommendedMinPrice: 0,
      potentialNetProfitEstimate: 0,
      evaluatedAt: now,
    };
  }

  const grossMarginAmount = price - costs;
  const grossMarginPct = Math.round(((grossMarginAmount / price) * 100) * 10) / 10;
  const recommendedMinPrice = Math.round(costs / (1 - minThreshold / 100));

  // Estimate net profit after average SME overhead OPEX (~15% of revenue)
  const potentialNetProfitEstimate = Math.max(0, grossMarginAmount - price * 0.15);

  if (grossMarginPct < 20) {
    return {
      proposedPrice: price,
      directCosts: costs,
      grossMarginAmount,
      grossMarginPct,
      minMarginThresholdPct: minThreshold,
      status: "CRITICAL_DANGER",
      badgeText: "BÁO ĐỘNG ĐỎ: NGUY CƠ LỖ RÒNG",
      reason: `Biên lợi nhuận gộp chỉ đạt ${grossMarginPct}%, nguy cơ lỗ ròng chắc chắn xảy ra sau khi trừ chi phí vận hành (OPEX). Bắt buộc chặn xuất báo giá và chuyển Founder duyệt ngoại lệ!`,
      escalationRequired: true,
      recommendedMinPrice,
      potentialNetProfitEstimate,
      evaluatedAt: now,
    };
  }

  if (grossMarginPct < minThreshold) {
    return {
      proposedPrice: price,
      directCosts: costs,
      grossMarginAmount,
      grossMarginPct,
      minMarginThresholdPct: minThreshold,
      status: "BLOCKED",
      badgeText: `CHẶN BÁO GIÁ: DƯỚI NGƯỠNG ${minThreshold}%`,
      reason: `Biên lợi nhuận gộp đạt ${grossMarginPct}%, vi phạm cam kết bảo vệ P&L (ngưỡng tối thiểu >= ${minThreshold}%). Khuyến nghị: Nâng giá lên tối thiểu ${recommendedMinPrice.toLocaleString("vi-VN")} đ hoặc cắt giảm phạm vi công việc (scope).`,
      escalationRequired: true,
      recommendedMinPrice,
      potentialNetProfitEstimate,
      evaluatedAt: now,
    };
  }

  return {
    proposedPrice: price,
    directCosts: costs,
    grossMarginAmount,
    grossMarginPct,
    minMarginThresholdPct: minThreshold,
    status: "APPROVED",
    badgeText: "ĐẠT CHUẨN AN TOÀN TÀI CHÍNH",
    reason: `Biên lợi nhuận gộp đạt ${grossMarginPct}% (vượt ngưỡng an toàn >= ${minThreshold}%). Đủ điều kiện phê duyệt xuất báo giá cho khách hàng.`,
    escalationRequired: false,
    recommendedMinPrice,
    potentialNetProfitEstimate,
    evaluatedAt: now,
  };
}

export function parseNumberWithUnits(str: string): number | null {
  const cleaned = str.trim().toLowerCase().replace(/[,.\s]/g, "");
  // Check for "triệu" or "tr" or "m"
  const trieuMatch = str.match(/([\d,.]+)\s*(triệu|tr|m)/i);
  if (trieuMatch) {
    const val = parseFloat(trieuMatch[1].replace(/,/g, "."));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }

  // Check for "k" or "nghìn"
  const nghinMatch = str.match(/([\d,.]+)\s*(nghìn|k)/i);
  if (nghinMatch) {
    const val = parseFloat(nghinMatch[1].replace(/,/g, "."));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // Raw digits
  const rawNum = parseInt(cleaned, 10);
  return isNaN(rawNum) ? null : rawNum;
}

export function extractQuoteMetricsFromText(text: string): {
  proposedPrice?: number;
  directCosts?: number;
} {
  let proposedPrice: number | undefined;
  let directCosts: number | undefined;

  // Patterns for price: "giá bán", "báo giá", "tổng giá", "phí", "price"
  const priceMatches = text.match(
    /(?:giá\s*bán|báo\s*giá|tổng\s*giá|phí|price)[^\d]{0,25}?([0-9.,]+(?:\s*(?:triệu|tr|nghìn|k|đ|vnd))?)/i
  );
  if (priceMatches && priceMatches[1]) {
    const parsed = parseNumberWithUnits(priceMatches[1]);
    if (parsed) proposedPrice = parsed;
  }

  // Patterns for costs: "chi phí", "giá vốn", "vốn trực tiếp", "cogs", "cost"
  const costMatches = text.match(
    /(?:chi\s*phí|giá\s*vốn|vốn|cogs|cost)[^\d]{0,25}?([0-9.,]+(?:\s*(?:triệu|tr|nghìn|k|đ|vnd))?)/i
  );
  if (costMatches && costMatches[1]) {
    const parsed = parseNumberWithUnits(costMatches[1]);
    if (parsed) directCosts = parsed;
  }

  return { proposedPrice, directCosts };
}

export function formatMarginGuardReport(evaluation: MarginQuoteEvaluation): string {
  const icon =
    evaluation.status === "APPROVED"
      ? "✅"
      : evaluation.status === "CRITICAL_DANGER"
      ? "🛑"
      : evaluation.status === "BLOCKED"
      ? "⚠️"
      : "❓";

  const statusLabel =
    evaluation.status === "APPROVED"
      ? "ĐÃ DUYỆT TỰ ĐỘNG (APPROVED)"
      : evaluation.status === "CRITICAL_DANGER"
      ? "BÁO ĐỘNG ĐỎ (CRITICAL DANGER)"
      : evaluation.status === "BLOCKED"
      ? "CHẶN XUẤT BÁO GIÁ (BLOCKED)"
      : "KHÔNG HỢP LỆ (INVALID)";

  return `
> ${icon} **MARGIN GUARD AUDIT: ${statusLabel}**
> - **Giá bán đề xuất:** ${evaluation.proposedPrice.toLocaleString("vi-VN")} đ
> - **Chi phí trực tiếp (COGS):** ${evaluation.directCosts.toLocaleString("vi-VN")} đ
> - **Lợi nhuận gộp:** ${evaluation.grossMarginAmount.toLocaleString("vi-VN")} đ (**${evaluation.grossMarginPct}%**)
> - **Ngưỡng an toàn quy định:** >= ${evaluation.minMarginThresholdPct}%
${
  evaluation.escalationRequired
    ? `> - **Khuyến nghị giá sàn an toàn:** ${evaluation.recommendedMinPrice.toLocaleString("vi-VN")} đ
> - **Trạng thái:** ${evaluation.reason}
> - **Hành động bắt buộc:** Yêu cầu Người sáng lập phê duyệt ngoại lệ (HITL Escalation) trước khi gửi cho khách!`
    : `> - **Ước tính lợi nhuận ròng sau OPEX (~15%):** ~${evaluation.potentialNetProfitEstimate.toLocaleString("vi-VN")} đ
> - **Trạng thái:** ${evaluation.reason}`
}
`.trim();
}
