/**
 * Phân hệ 33: Voice-Text Hand-off Engine
 * Bàn giao tức thì từ âm thanh hội thoại sang bản sao văn bản và trích xuất chỉ số P&L trong < 15ms.
 */

export interface VoiceFinancialIntent {
  intent: "pnl_calculation" | "discount_evaluation" | "quote_request" | "general_query";
  revenue?: number;
  cost?: number;
  discountPercent?: number;
  marginPercent?: number;
  extractedEntities: Record<string, string | number>;
  confidence: number;
}

export interface VoiceHandoffResult {
  sessionId: string;
  transcript: string;
  normalizedText: string;
  financialIntent: VoiceFinancialIntent;
  handoffDurationMs: number;
  slaPassed: boolean; // < 15ms
  recommendedAction: string;
}

/** Chuyển đổi số tiếng Việt bằng lời nói thành số nguyên: "50 triệu" -> 50000000, "42.500.000 đ" -> 42500000 */
export function parseVietnameseSpokenCurrency(text: string): number | null {
  let clean = text.toLowerCase().trim();
  
  // 1. Nhận diện định dạng tiền tệ có dấu chấm phân cách hàng nghìn (VD: 42.500.000 hoặc 100.000)
  const thousandDotMatch = clean.match(/\b(\d{1,3}(?:\.\d{3})+)(?:\s*(?:đ|vnd|dong|đồng))?\b/i);
  if (thousandDotMatch) {
    const rawDigits = thousandDotMatch[1].replace(/\./g, "");
    return parseInt(rawDigits, 10);
  }

  clean = clean.replace(/,/g, ".");
  
  // 2. Mẫu "2 tỷ", "2.5 tỷ"
  const tyMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:tỷ|ty)(?:[^\p{L}]|$)/u);
  if (tyMatch) {
    return Math.round(parseFloat(tyMatch[1]) * 1_000_000_000);
  }

  // 3. Mẫu "50 triệu", "50.5 triệu", "50tr"
  const trieuMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:triệu|trieu|tr)(?:[^\p{L}]|$)/u);
  if (trieuMatch) {
    return Math.round(parseFloat(trieuMatch[1]) * 1_000_000);
  }

  // 4. Mẫu "500 nghìn", "500k"
  const nghinMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:nghìn|ngan|k)(?:[^\p{L}]|$)/u);
  if (nghinMatch) {
    return Math.round(parseFloat(nghinMatch[1]) * 1_000);
  }

  // 5. Mẫu số thuần
  const numMatch = clean.match(/\b\d+\b/);
  if (numMatch) {
    return parseInt(numMatch[0], 10);
  }

  return null;
}

export class VoiceHandoffEngine {
  handoff(transcript: string, sessionId = `v_${Date.now()}`): VoiceHandoffResult {
    const start = performance.now();
    const normalized = transcript.trim();

    let intent: VoiceFinancialIntent["intent"] = "general_query";
    let revenue: number | undefined;
    let cost: number | undefined;
    let discountPercent: number | undefined;
    let marginPercent: number | undefined;
    const extractedEntities: Record<string, string | number> = {};

    // 1. Phân tích ngữ nghĩa P&L: Doanh thu / Chi phí / Lợi nhuận
    const revMatch = normalized.match(/(?:doanh thu|thu về|bán được)[^0-9]*?(\d+(?:\.\d+)?\s*(?:triệu|trieu|tr|tỷ|ty|k|nghìn)?)/iu);
    if (revMatch) {
      revenue = parseVietnameseSpokenCurrency(revMatch[1]) ?? undefined;
      if (revenue) extractedEntities.revenue = revenue;
    }

    const costMatch = normalized.match(/(?:chi phí|giá vốn|vốn|tổn phí)[^0-9]*?(\d+(?:\.\d+)?\s*(?:triệu|trieu|tr|tỷ|ty|k|nghìn)?)/iu);
    if (costMatch) {
      cost = parseVietnameseSpokenCurrency(costMatch[1]) ?? undefined;
      if (cost) extractedEntities.cost = cost;
    }

    const discountMatch = normalized.match(/(?:giảm|chiết khấu)\s*(\d+(?:\.\d+)?)\s*%/i);
    if (discountMatch) {
      discountPercent = parseFloat(discountMatch[1]);
      extractedEntities.discountPercent = discountPercent;
    }

    if (revenue !== undefined && cost !== undefined) {
      intent = "pnl_calculation";
      marginPercent = revenue === 0 ? (cost > 0 ? -100 : 0) : Math.round(((revenue - cost) / revenue) * 1000) / 10;
      extractedEntities.marginPercent = marginPercent;
    } else if (discountPercent !== undefined) {
      intent = "discount_evaluation";
    }

    const duration = Math.round((performance.now() - start) * 100) / 100;

    let recommendedAction = "Phản hồi thông tin tổng quát";
    if (intent === "pnl_calculation") {
      recommendedAction = `Hiển thị thẻ tính lời lỗ P&L: Doanh thu ${revenue?.toLocaleString("vi-VN")} đ, Giá vốn ${cost?.toLocaleString("vi-VN")} đ, Biên lợi nhuận ${marginPercent}%`;
    } else if (intent === "discount_evaluation") {
      recommendedAction = `Kích hoạt kiểm tra trần chiết khấu (${discountPercent}%) đối chiếu chính sách đại lý`;
    }

    return {
      sessionId,
      transcript,
      normalizedText: normalized,
      financialIntent: {
        intent,
        revenue,
        cost,
        discountPercent,
        marginPercent,
        extractedEntities,
        confidence: intent !== "general_query" ? 0.95 : 0.7,
      },
      handoffDurationMs: duration,
      slaPassed: duration < 15.0,
      recommendedAction,
    };
  }
}

let defaultVoiceHandoff: VoiceHandoffEngine | null = null;
export function getVoiceHandoffEngine(): VoiceHandoffEngine {
  if (!defaultVoiceHandoff) {
    defaultVoiceHandoff = new VoiceHandoffEngine();
  }
  return defaultVoiceHandoff;
}
