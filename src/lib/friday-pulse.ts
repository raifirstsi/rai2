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

export function getCurrentWeekDisplay(d = new Date()): string {
  return `Tuần ${getWeekNumber(d)} - Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}

export const STORAGE_KEY_PULSE_WEBHOOK = "rai2_friday_pulse_webhook";
export const STORAGE_KEY_PULSE_LAST_SENT = "rai2_friday_pulse_last_sent";
export const STORAGE_KEY_PULSE_REVIEWED = "rai2_friday_pulse_reviewed_week";

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    return undefined;
  }
  return undefined;
}

export function getFridayPulseWebhookUrl(): string {
  const storage = getLocalStorage();
  if (!storage) return "";
  try {
    return storage.getItem(STORAGE_KEY_PULSE_WEBHOOK) || "";
  } catch {
    return "";
  }
}

export function saveFridayPulseWebhookUrl(url: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_PULSE_WEBHOOK, url.trim());
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("rai2:friday-pulse-webhook-updated", { detail: { url: url.trim() } }));
    }
  } catch (e) {
    console.warn("Could not save Friday pulse webhook URL:", e);
  }
}

export function getLastSentFridayPulse(): { at: string; week: string } | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_PULSE_LAST_SENT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isFridayPulseDue(now = new Date()): boolean {
  const day = now.getDay();
  const hours = now.getHours();

  // Due from Friday 17:00 through Sunday end of week
  const isWeekendOrFridayEve =
    (day === 5 && hours >= 17) || day === 6 || day === 0;

  if (!isWeekendOrFridayEve) return false;

  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const reviewedWeek = storage.getItem(STORAGE_KEY_PULSE_REVIEWED);
    const currentWeek = getCurrentWeekDisplay(now);
    return reviewedWeek !== currentWeek;
  } catch {
    return false;
  }
}

export function markFridayPulseReviewed(week?: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const targetWeek = week || getCurrentWeekDisplay();
    storage.setItem(STORAGE_KEY_PULSE_REVIEWED, targetWeek);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("rai2:friday-pulse-reviewed", { detail: { week: targetWeek } })
      );
    }
  } catch (e) {
    console.warn("Could not mark Friday pulse reviewed:", e);
  }
}

export function dismissFridayPulseDue(week?: string): void {
  markFridayPulseReviewed(week);
}

export async function sendFridayPulseWebhook(
  url: string,
  report: FridayPulseReport
): Promise<{ ok: boolean; error?: string }> {
  if (!url || !url.trim()) {
    return { ok: false, error: "Chưa cung cấp địa chỉ URL Webhook." };
  }

  const cleanUrl = url.trim();
  const text = formatFridayPulseMarkdown(report);

  try {
    let payload: Record<string, unknown>;
    if (cleanUrl.includes("api.telegram.org")) {
      let chatId: string | undefined;
      try {
        const parsed = new URL(cleanUrl);
        chatId = parsed.searchParams.get("chat_id") || parsed.searchParams.get("to") || undefined;
      } catch {}
      payload = {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      };
    } else {
      payload = {
        event: "friday_pulse",
        week: report.weekDisplay,
        score: report.absenceReadinessScore,
        level: report.absenceLevel.title,
        singlePriority: report.singlePriorityForNextWeek,
        text,
        report,
      };
    }

    const res = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `Webhook phản hồi lỗi HTTP ${res.status}` };
    }

    const storage = getLocalStorage();
    if (storage) {
      storage.setItem(
        STORAGE_KEY_PULSE_LAST_SENT,
        JSON.stringify({ at: new Date().toISOString(), week: report.weekDisplay })
      );
    }

    return { ok: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}
