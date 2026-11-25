/**
 * Phân hệ Đo lường Hoàn vốn 90 Ngày (90-Day Payback Period ROI Calculator)
 * Đánh giá tính khả thi tài chính, dòng tiền thuần và tốc độ thu hồi vốn đầu tư AI First.
 */

export interface PaybackCalculatorInput {
  totalInvestmentVnd: number; // Tổng chi phí đầu tư ban đầu (VND)
  monthlyAIOpexVnd?: number; // Chi phí hạ tầng/API hàng tháng (VND)
  hoursSavedPerDay?: number; // Số giờ nhân viên tiết kiệm được mỗi ngày
  hourlyLaborCostVnd?: number; // Chi phí nhân công mỗi giờ (VND)
  incrementalMonthlyRevenueVnd?: number; // Doanh thu tăng thêm hàng tháng nhờ AI
  averageGrossMarginPercent?: number; // Biên lợi nhuận gộp (%)
  leakagePreventionMonthlyVnd?: number; // Thất thoát giá vốn/chiết khấu được ngăn chặn (VND)
}

export interface PaybackCalculatorResult {
  totalInvestmentVnd: number;
  dailyMetrics: {
    laborSavingsVnd: number;
    incrementalProfitVnd: number;
    leakagePreventionVnd: number;
    aiOpexVnd: number;
    netCashflowBenefitVnd: number;
  };
  paybackPeriodDays: number;
  ninetyDayProjection: {
    totalCumulativeBenefitVnd: number;
    netProfitAfterPaybackVnd: number;
    roiPercent: number;
  };
  achieves90DayPayback: boolean;
  financialHealthTier: "tier_1_exceptional" | "tier_2_viable" | "tier_3_high_risk";
  recommendations: string[];
}

export class PaybackRoiCalculator {
  public calculate(input: PaybackCalculatorInput): PaybackCalculatorResult {
    const totalInvestment = Math.max(1, input.totalInvestmentVnd || 0);
    const monthlyOpex = Math.max(0, input.monthlyAIOpexVnd ?? 2_000_000); // Mặc định 2tr/tháng phí server & token
    const hoursSaved = Math.max(0, input.hoursSavedPerDay ?? 4); // Mặc định 4h/ngày cho 1 team bán hàng/kế toán
    const hourlyCost = Math.max(0, input.hourlyLaborCostVnd ?? 65_000); // 65k/h lương trung bình nhân viên
    const incrementalRev = Math.max(0, input.incrementalMonthlyRevenueVnd ?? 30_000_000); // 30tr doanh thu tăng thêm
    const marginPct = Math.max(1, Math.min(100, input.averageGrossMarginPercent ?? 25)); // 25% margin
    const leakageMonthly = Math.max(0, input.leakagePreventionMonthlyVnd ?? 5_000_000); // Ngăn rò rỉ 5tr/tháng

    // 1. Phân tích lợi ích dòng tiền hàng ngày (Daily Net Cashflow Benefit)
    const dailyLaborSavings = hoursSaved * hourlyCost;
    const dailyIncrementalProfit = (incrementalRev * (marginPct / 100)) / 30;
    const dailyLeakagePrevention = leakageMonthly / 30;
    const dailyAIOpex = monthlyOpex / 30;

    const dailyNetBenefit = (dailyLaborSavings + dailyIncrementalProfit + dailyLeakagePrevention) - dailyAIOpex;

    // 2. Tính số ngày hoàn vốn (Payback Period Days)
    let paybackPeriodDays = 999;
    if (dailyNetBenefit > 0) {
      paybackPeriodDays = Number((totalInvestment / dailyNetBenefit).toFixed(1));
    }

    // 3. Dự phóng 90 ngày (90-Day Projection)
    const totalCumulativeBenefit = Number((dailyNetBenefit * 90).toFixed(0));
    const netProfitAfterPayback = Number((totalCumulativeBenefit - totalInvestment).toFixed(0));
    const roiPercent = Number(((netProfitAfterPayback / totalInvestment) * 100).toFixed(1));

    const achieves90DayPayback = paybackPeriodDays <= 90;

    // 4. Phân tầng sức khỏe tài chính & Khuyến nghị hành động
    let financialHealthTier: "tier_1_exceptional" | "tier_2_viable" | "tier_3_high_risk" = "tier_2_viable";
    const recommendations: string[] = [];

    if (paybackPeriodDays <= 45) {
      financialHealthTier = "tier_1_exceptional";
      recommendations.push("Dự án thu hồi vốn siêu tốc dưới 45 ngày. Khuyến nghị mở rộng nhân sự số sang các phòng ban khác.");
      recommendations.push("Tối ưu hóa phễu chốt đơn tự động để tăng thêm doanh thu gia tăng.");
    } else if (paybackPeriodDays <= 90) {
      financialHealthTier = "tier_2_viable";
      recommendations.push("Đạt mục tiêu hoàn vốn trong chu kỳ chuẩn mực 90 ngày của triết lý RAI² First OS.");
      recommendations.push("Duy trì giám sát sát sao điểm nghẽn TOC lúc 17:00 hàng ngày để bảo toàn dòng tiền.");
    } else {
      financialHealthTier = "tier_3_high_risk";
      recommendations.push("CẢNH BÁO: Thời gian hoàn vốn dự kiến vượt quá 90 ngày. Cần tái cấu trúc phạm vi đầu tư.");
      recommendations.push("Tập trung giải phóng điểm nghẽn năng suất để tăng số giờ tiết kiệm của nhân viên.");
    }

    return {
      totalInvestmentVnd: totalInvestment,
      dailyMetrics: {
        laborSavingsVnd: Number(dailyLaborSavings.toFixed(0)),
        incrementalProfitVnd: Number(dailyIncrementalProfit.toFixed(0)),
        leakagePreventionVnd: Number(dailyLeakagePrevention.toFixed(0)),
        aiOpexVnd: Number(dailyAIOpex.toFixed(0)),
        netCashflowBenefitVnd: Number(dailyNetBenefit.toFixed(0)),
      },
      paybackPeriodDays,
      ninetyDayProjection: {
        totalCumulativeBenefitVnd: totalCumulativeBenefit,
        netProfitAfterPaybackVnd: netProfitAfterPayback,
        roiPercent,
      },
      achieves90DayPayback,
      financialHealthTier,
      recommendations,
    };
  }
}

let roiCalculatorInstance: PaybackRoiCalculator | null = null;
export function getPaybackRoiCalculator(): PaybackRoiCalculator {
  if (!roiCalculatorInstance) {
    roiCalculatorInstance = new PaybackRoiCalculator();
  }
  return roiCalculatorInstance;
}
