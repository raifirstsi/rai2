export type TaskClassification = "keep" | "eliminate" | "redesign";

export interface ArchitectureTask {
  id: string;
  name: string;
  category: TaskClassification;
  departmentZone: number; // 1-7
  notes?: string;
  isCustom?: boolean;
}

export interface WorkflowProblemWarning {
  keyword: string;
  advice: string;
}

export const WORKFLOW_PROBLEM_KEYWORDS: WorkflowProblemWarning[] = [
  {
    keyword: "copy paste",
    advice: "Sao chép dữ liệu thủ công là dấu hiệu gãy quy trình tiếp nhận (intake). Hãy dùng webhook hoặc API thay vì biến bot thành nhân công sao chép.",
  },
  {
    keyword: "nhắc nhở",
    advice: "Nhắc gửi báo cáo liên tục là lỗi do quy trình thiếu định nghĩa hoàn thành (DoD). Hãy chuẩn hóa SOP thay vì dùng bot làm còi báo động.",
  },
  {
    keyword: "gõ lại",
    advice: "Nhập liệu thủ công từ giấy/ảnh vào Excel là tác vụ cần chuẩn hóa biểu mẫu online ngay từ khâu tiếp nhận.",
  },
  {
    keyword: "họp giao ban",
    advice: "Họp hành chỉ để đọc số liệu nên bị xóa bỏ (Eliminate). Thay thế bằng Báo cáo Nhịp thở Thứ Sáu 17:00.",
  },
];

export const DEFAULT_PRESET_TASKS: ArchitectureTask[] = [
  {
    id: "task-1",
    name: "Gặp gỡ chốt các hợp đồng chiến lược & đối tác lớn",
    category: "keep",
    departmentZone: 1,
    notes: "Kết nối niềm tin và trực giác kinh doanh - Phải do Người Chủ nắm giữ.",
  },
  {
    id: "task-2",
    name: "Họp giao ban đọc số liệu & chất vấn nội bộ",
    category: "eliminate",
    departmentZone: 1,
    notes: "Lãng phí thời gian - Thay thế bằng Báo cáo Nhịp thở 17:00 Thứ Sáu.",
  },
  {
    id: "task-3",
    name: "Phân loại và nuôi dưỡng khách hàng tiềm năng 24/7",
    category: "redesign",
    departmentZone: 2,
    notes: "Giao cho bot Marketing lọc phễu và gắn tag tự động.",
  },
  {
    id: "task-4",
    name: "Soạn thảo báo giá chuẩn và kiểm tra trần chiết khấu",
    category: "redesign",
    departmentZone: 3,
    notes: "Giao cho bot Báo giá kèm chốt chặn Margin Guard >=35%.",
  },
  {
    id: "task-5",
    name: "Báo cáo tiến độ nội bộ trùng lặp qua nhiều kênh chat",
    category: "eliminate",
    departmentZone: 4,
    notes: "Gây nhiễu thông tin - Gom về một dashboard tập trung duy nhất.",
  },
  {
    id: "task-6",
    name: "Đóng gói sự cố phát sinh thành quy trình chuẩn 4 phần",
    category: "redesign",
    departmentZone: 4,
    notes: "Thu âm độc thoại 1-chạm qua Voice-to-SOP nạp vào bộ nhớ.",
  },
  {
    id: "task-7",
    name: "Lắng nghe tâm tư và xây dựng văn hóa đội ngũ nòng cốt",
    category: "keep",
    departmentZone: 7,
    notes: "Cảm xúc con người - Tuyệt đối không giao phó cho AI.",
  },
  {
    id: "task-8",
    name: "Nhắc hạn thanh toán & theo dõi công nợ đến hạn",
    category: "redesign",
    departmentZone: 6,
    notes: "Giao cho bot Tài chính gửi thông báo tự động theo lịch hẹn.",
  },
];

export interface ArchitectureSummary {
  keepCount: number;
  eliminateCount: number;
  redesignCount: number;
  totalCount: number;
  keepRatio: number; // target ~30%
  eliminateRatio: number; // target ~20%
  redesignRatio: number; // target ~50%
  isHealthyDistribution: boolean;
  warnings: string[];
}

export function detectWorkflowProblem(taskDescription: string): string | null {
  const normalized = taskDescription.toLowerCase();
  for (const item of WORKFLOW_PROBLEM_KEYWORDS) {
    if (normalized.includes(item.keyword)) {
      return item.advice;
    }
  }
  return null;
}

export function analyzeArchitectureDistribution(tasks: ArchitectureTask[]): ArchitectureSummary {
  const total = tasks.length;
  if (total === 0) {
    return {
      keepCount: 0,
      eliminateCount: 0,
      redesignCount: 0,
      totalCount: 0,
      keepRatio: 0,
      eliminateRatio: 0,
      redesignRatio: 0,
      isHealthyDistribution: false,
      warnings: ["Chưa có tác vụ nào được phân loại trong bảng kiến trúc."],
    };
  }

  const keepCount = tasks.filter((t) => t.category === "keep").length;
  const eliminateCount = tasks.filter((t) => t.category === "eliminate").length;
  const redesignCount = tasks.filter((t) => t.category === "redesign").length;

  const keepRatio = Math.round((keepCount / total) * 100);
  const eliminateRatio = Math.round((eliminateCount / total) * 100);
  const redesignRatio = Math.round((redesignCount / total) * 100);

  const warnings: string[] = [];

  if (eliminateCount === 0) {
    warnings.push("Bạn chưa xóa bỏ (Eliminate) tác vụ thừa nào. Rắc AI lên quy trình rác sẽ chỉ tạo ra rác nhanh hơn.");
  }
  if (keepRatio > 55) {
    warnings.push("Tỷ lệ giữ cho con người (>55%) quá cao. Người chủ đang mắc kẹt trong bẫy MeOS và chưa dám buông việc.");
  }
  if (redesignRatio > 75) {
    warnings.push("Tỷ lệ giao cho AI (>75%) quá nóng vội. Cần giữ lại ít nhất 20-30% các công việc cốt lõi về chiến lược và cảm xúc.");
  }

  const isHealthyDistribution =
    eliminateCount > 0 &&
    keepRatio >= 20 &&
    keepRatio <= 45 &&
    redesignRatio >= 35 &&
    redesignRatio <= 65;

  return {
    keepCount,
    eliminateCount,
    redesignCount,
    totalCount: total,
    keepRatio,
    eliminateRatio,
    redesignRatio,
    isHealthyDistribution,
    warnings,
  };
}

const STORAGE_KEY_ARCHITECTURE = "rai2_target_architecture_worksheet";

export function loadSavedTargetArchitecture(): ArchitectureTask[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_PRESET_TASKS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ARCHITECTURE);
    if (!raw) return DEFAULT_PRESET_TASKS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_PRESET_TASKS;
  } catch {
    return DEFAULT_PRESET_TASKS;
  }
}

export function saveTargetArchitecture(tasks: ArchitectureTask[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_ARCHITECTURE, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Could not save target architecture worksheet:", e);
  }
}
