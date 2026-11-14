import { evaluateStrategyMap7Zones, StrategyMapSummary } from "./strategy-map";
import { TocDiagnosisResult } from "./toc-detector";

export interface FridayPulseReport {
  generatedAt: string;
  weekDisplay: string;
  overallScore: number;
  absenceReadinessScore: number;
  absenceLevel: {
    levelNumber: 1 | 2 | 3;
    title: string;
    description: string;
  };
  metrics: {
    activeBotsCount: number;
    backlogOver48hCount: number;
    healthyDepartmentsCount: number;
    bottleneckDepartmentName?: string;
    marginPolicyAdherence: string;
  };
  singlePriorityForNextWeek: string;
  actionItems: string[];
  strategySummary: StrategyMapSummary;
}

export function computeFridayPulseReport(params: {
  activeBotIds: string[];
  tocDiagnosis?: TocDiagnosisResult | null;
  backlogCount?: number;
  customMarginScore?: number;
}): FridayPulseReport {
  const { activeBotIds, tocDiagnosis, backlogCount = 0, customMarginScore = 35 } = params;

  const strategySummary = evaluateStrategyMap7Zones({
    activeBotIds,
    tocDiagnosis,
  });

  // Dynamic Absence Readiness Index ($ARI$) formula
  // Combines: 7-Zone coverage (50%), TOC resolution health (30%), Backlog containment (20%)
  const coverageComponent = strategySummary.overallCoverageScore * 0.5;
  const tocComponent = tocDiagnosis ? (tocDiagnosis.urgencyLevel === "CRITICAL" ? 15 : 25) : 30;
  const backlogComponent = Math.max(0, 20 - backlogCount * 4);

  const absenceReadinessScore = Math.min(
    100,
    Math.round(coverageComponent + tocComponent + backlogComponent)
  );

  let absenceLevel: FridayPulseReport["absenceLevel"];
  if (absenceReadinessScore >= 80) {
    absenceLevel = {
      levelNumber: 3,
      title: "Cấp độ 3: Sẵn Sàng Vắng Mặt 14 Ngày (Absence Ready)",
      description: "Hệ thống tự vận hành ổn định. Các phòng ban đều có nhân sự số và rào chắn bảo vệ P&L.",
    };
  } else if (absenceReadinessScore >= 50) {
    absenceLevel = {
      levelNumber: 2,
      title: "Cấp độ 2: Bán Tự Hành (Semi-Autonomous)",
      description: "Có thể vắng mặt 3 - 5 ngày an toàn. Cần bổ sung nhân sự số ở các khâu trọng yếu.",
    };
  } else {
    absenceLevel = {
      levelNumber: 1,
      title: "Cấp độ 1: Phụ Thuộc Người Sáng Lập (Founder Bottleneck)",
      description: "Doanh nghiệp có nguy cơ tắc nghẽn nếu người chủ vắng mặt quá 48 giờ. Cần tập trung giải phóng khâu nghẽn nhất.",
    };
  }

  // Derive The Single Priority for Next Week (Benjamin Simkin's Core Rule)
  let singlePriorityForNextWeek = "Duy trì kiểm soát chất lượng bàn giao và mở rộng phễu khách hàng tiềm năng.";
  const actionItems: string[] = [];

  if (tocDiagnosis) {
    singlePriorityForNextWeek = `Giải tỏa dứt điểm Điểm Nghẽn TOC: ${tocDiagnosis.title} (${tocDiagnosis.departmentName}).`;
    actionItems.push(`Tập trung nguồn lực vào ${tocDiagnosis.departmentName}, không dàn trải chi phí sang việc khác.`);
    if (tocDiagnosis.upstreamBlockWarning) {
      actionItems.push(tocDiagnosis.upstreamBlockWarning);
    }
  } else {
    const unstaffedZone = strategySummary.zones.find((z) => z.activeAgentsCount === 0);
    if (unstaffedZone) {
      singlePriorityForNextWeek = `Kích hoạt nhân sự số cho ${unstaffedZone.name}.`;
      actionItems.push(`Phòng ban ${unstaffedZone.name} chưa có AI đảm trách, hãy tuyển nhân sự số tương ứng.`);
    }
  }

  if (backlogCount > 0) {
    actionItems.push(`Xử lý dứt điểm ${backlogCount} công việc tồn đọng >48h trước giờ tan ca thứ Sáu.`);
  }

  const marginPolicyAdherence =
    customMarginScore >= 35
      ? `Đạt chuẩn bảo vệ P&L (Biên lợi nhuận gộp >= 35%)`
      : `Cảnh báo: Biên lợi nhuận gộp trung bình thấp (${customMarginScore}%), cần kiểm soát chiết khấu!`;

  const now = new Date();
  const weekDisplay = `Tuần ${getWeekNumber(now)} - Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

  return {
    generatedAt: now.toISOString(),
    weekDisplay,
    overallScore: strategySummary.overallCoverageScore,
    absenceReadinessScore,
    absenceLevel,
    metrics: {
      activeBotsCount: activeBotIds.length,
      backlogOver48hCount: backlogCount,
      healthyDepartmentsCount: strategySummary.healthyZonesCount,
      bottleneckDepartmentName: tocDiagnosis?.departmentName,
      marginPolicyAdherence,
    },
    singlePriorityForNextWeek,
    actionItems,
    strategySummary,
  };
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

export function formatFridayPulseMarkdown(report: FridayPulseReport): string {
  const lines: string[] = [
    `# 🔔 BÁO CÁO NHỊP THỞ THỨ SÁU 17:00 (${report.weekDisplay})`,
    `*Hệ điều hành RAI² FIRST OS — Đo lường sức khỏe vận hành & giải phóng Người sáng lập*`,
    "",
    `### 1. Thước Đo Sẵn Sàng Vắng Mặt ($ARI$): **${report.absenceReadinessScore}/100 Điểm**`,
    `> **${report.absenceLevel.title}**`,
    `> ${report.absenceLevel.description}`,
    "",
    `### 2. Chỉ Số Vận Hành Cốt Lõi:`,
    `- **Nhân sự số hoạt động:** ${report.metrics.activeBotsCount} bot đang chạy trên 7 Zone`,
    `- **Số phòng ban vận hành ổn định:** ${report.metrics.healthyDepartmentsCount}/7 phòng ban`,
    `- **Tồn đọng nguy hiểm (>48h):** ${report.metrics.backlogOver48hCount} việc tồn đọng`,
    `- **Chính sách Biên lợi nhuận P&L:** ${report.metrics.marginPolicyAdherence}`,
    "",
    `### 3. 🎯 MỤC TIÊU ƯU TIÊN DUY NHẤT TUẦN TỚI (THE SINGLE PRIORITY):`,
    `> **${report.singlePriorityForNextWeek}**`,
    "",
    `### 4. Hành Động Trọng Tâm Cần Xử Lý:`,
    ...report.actionItems.map((item, idx) => `${idx + 1}. ${item}`),
  ];

  return lines.join("\n");
}
