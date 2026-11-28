import { useState, useMemo, useId, useEffect } from "react";
import {
  X,
  Building2,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
} from "lucide-react";
import {
  analyzeArchitectureDistribution,
  detectWorkflowProblem,
  loadSavedTargetArchitecture,
  saveTargetArchitecture,
  ArchitectureTask,
  TaskClassification,
} from "@/lib/target-architecture";
import {
  evaluateMaturityScore,
  loadSavedMaturityAnswers,
  saveMaturityAnswers,
  MATURITY_QUESTIONS,
  MaturityResult,
} from "@/lib/ai-maturity";
import { cn } from "@/lib/cn";
import { fetchEnterpriseState, patchEnterpriseState, scanEnterpriseArchitecture, type ArchitectureScanResult } from "@/lib/enterprise-state-client";
import { api } from "@/state/store";

export interface ArchitectureAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAutonomyGraduation?: () => void;
}

export function ArchitectureAssessmentModal({
  isOpen,
  onClose,
  onOpenAutonomyGraduation,
}: ArchitectureAssessmentModalProps) {
  const dialogTitleId = useId();
  const [activeTab, setActiveTab] = useState<"worksheet" | "maturity">("worksheet");

  // Worksheet state
  const [tasks, setTasks] = useState<ArchitectureTask[]>(() => loadSavedTargetArchitecture());
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<TaskClassification>("redesign");
  const [newTaskZone, setNewTaskZone] = useState<number>(3);
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);

  // Maturity assessment state
  const [answers, setAnswers] = useState<Record<string, number>>(() => loadSavedMaturityAnswers());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [scanResult, setScanResult] = useState<ArchitectureScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTasks(loadSavedTargetArchitecture());
      setAnswers(loadSavedMaturityAnswers());
    }
  }, [isOpen]);

  const summary = useMemo(() => analyzeArchitectureDistribution(tasks), [tasks]);
  const maturityResult: MaturityResult = useMemo(() => evaluateMaturityScore(answers), [answers]);

  if (!isOpen) return null;

  const handleTaskNameChange = (val: string) => {
    setNewTaskName(val);
    const warning = detectWorkflowProblem(val);
    setWorkflowWarning(warning);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    const newTask: ArchitectureTask = {
      id: `task-${Date.now()}`,
      name: newTaskName.trim(),
      category: newTaskCategory,
      departmentZone: newTaskZone,
      isCustom: true,
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveTargetArchitecture(updated);
    setNewTaskName("");
    setWorkflowWarning(null);
  };

  const handleToggleCategory = (taskId: string, category: TaskClassification) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, category } : t));
    setTasks(updated);
    saveTargetArchitecture(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    saveTargetArchitecture(updated);
  };

  const handleSelectOption = (questionId: string, score: number) => {
    const nextAnswers = { ...answers, [questionId]: score };
    setAnswers(nextAnswers);
    saveMaturityAnswers(nextAnswers);
  };

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    void fetchEnterpriseState().then(({ state: ent }) => {
      if (!alive || !ent?.architectureAssessment) return;
      if (Array.isArray(ent.architectureAssessment.tasks)) {
        setTasks(ent.architectureAssessment.tasks as ArchitectureTask[]);
      }
      if (ent.architectureAssessment.answers) {
        setAnswers(ent.architectureAssessment.answers);
      }
    });
    return () => { alive = false; };
  }, [isOpen]);

  const handleSaveAll = () => {
    saveTargetArchitecture(tasks);
    saveMaturityAnswers(answers);
    const totalScore = Object.values(answers).reduce((acc, v) => acc + (Number(v) || 0), 0);
    void patchEnterpriseState({
      architectureAssessment: { tasks, answers, totalScore, maxScore: 21 },
    });
    void api("/api/bots/evals/run", {
      method: "POST",
      body: JSON.stringify({
        botId: "enterprise-architecture",
        botName: "Kiến trúc Doanh nghiệp RAI²",
        interactions: [
          {
            userPrompt: "Sát hạch kiến trúc 7 Vùng",
            botResponse: `Điểm trưởng thành hiện tại: ${totalScore}/21`,
            toolsCalled: ["architecture_audit"],
          },
        ],
      }),
    }).catch(() => {});
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-4xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={dialogTitleId} className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Sát Hạch Kiến Trúc &amp; Trưởng Thành AI
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  The Show-Me Test
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Phân loại tác vụ Keep/Eliminate/Redesign và đo độ trưởng thành qua 7 Vùng.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Clean Segmented Tab Switcher */}
        <div className="flex shrink-0 snap-x gap-1 overflow-x-auto border-b border-hairline/40 p-2 scrollbar-none sm:px-6 bg-card">
          <button
            type="button"
            onClick={() => setActiveTab("worksheet")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] sm:text-[13px] font-medium transition-colors",
              activeTab === "worksheet"
                ? "bg-control text-ink font-semibold"
                : "text-ink-secondary hover:bg-control/50 hover:text-ink"
            )}
          >
            <span>1. Bảng Phân Loại Kiến Trúc (Keep / Eliminate / Redesign)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("maturity")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] sm:text-[13px] font-medium transition-colors",
              activeTab === "maturity"
                ? "bg-control text-ink font-semibold"
                : "text-ink-secondary hover:bg-control/50 hover:text-ink"
            )}
          >
            <span>2. Khảo Sát Độ Trưởng Thành AI ({maturityResult.totalScore}/21 Điểm)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {activeTab === "worksheet" ? (
            /* TAB 1: TARGET ARCHITECTURE WORKSHEET */
            <div className="space-y-4">
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-ink">Kiểm định tự động hạ tầng Workspace (/21 điểm thực tế)</div>
                    <div className="text-[11px] text-ink-secondary">Quét trực tiếp Két Sắt 8 Trụ Cột, TOC, Margin Guard, Bot Enterprise &amp; Lịch 17:00 trên Server.</div>
                  </div>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => {
                      setScanning(true);
                      void scanEnterpriseArchitecture().then((res) => {
                        if (res) setScanResult(res);
                        setScanning(false);
                      });
                    }}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {scanning ? "Đang quét Server..." : "Quét tự động từ Server"}
                  </button>
                </div>
                {scanResult && (
                  <div className="space-y-1.5 pt-1 border-t border-hairline/40">
                    <div className="text-xs font-bold text-ink">Điểm sẵn sàng thực tế: {scanResult.totalScore}/{scanResult.maxScore}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      {scanResult.checks.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-hairline/50 bg-card px-2.5 py-1.5">
                          <span className={c.passed ? "text-ink" : "text-ink-secondary"}>{c.passed ? "✅" : "⚠️"} {c.label}</span>
                          <span className="font-semibold text-ink">{c.points}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Distribution Metric Tiles (Clean Neutral) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-hairline/60 bg-control/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>KEEP (Giữ cho người)</span>
                    <span className="font-semibold text-ink">{summary.keepCount} việc</span>
                  </div>
                  <div className="text-[20px] font-bold text-ink">{summary.keepRatio}%</div>
                  <p className="text-[10px] text-ink-tertiary">Mục tiêu chuẩn: ~30% (Chiến lược, chốt lớn, văn hóa)</p>
                </div>

                <div className="rounded-xl border border-hairline/60 bg-control/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>ELIMINATE (Xóa bỏ)</span>
                    <span className="font-semibold text-ink">{summary.eliminateCount} việc</span>
                  </div>
                  <div className="text-[20px] font-bold text-ink">{summary.eliminateRatio}%</div>
                  <p className="text-[10px] text-ink-tertiary">Mục tiêu chuẩn: ~20% (Báo cáo thừa, họp đọc số)</p>
                </div>

                <div className="rounded-xl border border-hairline/60 bg-control/30 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                    <span>REDESIGN (Thiết kế cho AI)</span>
                    <span className="font-semibold text-ink">{summary.redesignCount} việc</span>
                  </div>
                  <div className="text-[20px] font-bold text-ink">{summary.redesignRatio}%</div>
                  <p className="text-[10px] text-ink-tertiary">Mục tiêu chuẩn: ~50% (Phân loại lead, báo giá, SOP)</p>
                </div>
              </div>

              {/* Warning Alert if distribution has problems */}
              {summary.warnings.length > 0 && (
                <div className="rounded-xl border border-hairline/60 bg-card p-3 text-[12px] text-ink flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-accent shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {summary.warnings.map((w, i) => (
                      <p key={i} className="text-ink-secondary leading-relaxed">
                        • {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Task Form */}
              <div className="rounded-xl border border-hairline/60 bg-card p-3.5 space-y-3">
                <span className="text-[12px] font-semibold text-ink block">
                  Thêm công việc vào bảng rà soát kiến trúc:
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => handleTaskNameChange(e.target.value)}
                    placeholder="Ví dụ: Lập báo giá thiết bị cho khách hàng, họp giao ban sáng..."
                    className="flex-1 rounded-lg border border-hairline/60 bg-control px-3 py-2 text-[13px] text-ink focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value as TaskClassification)}
                      className="rounded-lg border border-hairline/60 bg-control px-2.5 py-2 text-[12px] text-ink focus:outline-none shrink-0"
                    >
                      <option value="redesign">Giao AI (Redesign)</option>
                      <option value="keep">Giữ người (Keep)</option>
                      <option value="eliminate">Xóa bỏ (Eliminate)</option>
                    </select>
                    <select
                      value={newTaskZone}
                      onChange={(e) => setNewTaskZone(Number(e.target.value))}
                      className="rounded-lg border border-hairline/60 bg-control px-2.5 py-2 text-[12px] text-ink focus:outline-none shrink-0"
                    >
                      <option value={1}>Zone 1: Điều hành</option>
                      <option value={2}>Zone 2: Tiếp thị</option>
                      <option value={3}>Zone 3: Bán hàng</option>
                      <option value={4}>Zone 4: Vận hành</option>
                      <option value={5}>Zone 5: Chăm sóc</option>
                      <option value={6}>Zone 6: Tài chính</option>
                      <option value={7}>Zone 7: Nhân sự</option>
                    </select>
                    <button
                      type="button"
                      disabled={!newTaskName.trim()}
                      onClick={handleAddTask}
                      className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white hover:bg-accent/90 disabled:opacity-40 transition-opacity shrink-0 flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span className="hidden sm:inline">Thêm</span>
                    </button>
                  </div>
                </div>

                {/* Workflow Problem Detector Warning */}
                {workflowWarning && (
                  <div className="rounded-lg bg-control/40 p-2 text-[11px] text-accent leading-relaxed flex items-start gap-1.5 border border-hairline/40">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>Bộ bắt lỗi gãy quy trình: </strong>
                      {workflowWarning}
                    </span>
                  </div>
                )}
              </div>

              {/* Task Classification List */}
              <div className="space-y-2">
                <span className="text-[12px] font-semibold text-ink">
                  Danh sách phân loại ({tasks.length} công việc):
                </span>
                <div className="divide-y divide-hairline/40 rounded-xl border border-hairline/60 bg-card overflow-hidden">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-control/20 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-ink-tertiary bg-control px-1.5 py-0.5 rounded">
                            Z{task.departmentZone}
                          </span>
                          <span className="text-[13px] font-medium text-ink truncate block">
                            {task.name}
                          </span>
                        </div>
                        {task.notes && (
                          <p className="text-[11px] text-ink-secondary mt-0.5 line-clamp-1">
                            {task.notes}
                          </p>
                        )}
                      </div>

                      {/* 3 Buttons to Switch Category */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(task.id, "keep")}
                          className={cn(
                            "px-2.5 py-1 rounded text-[11px] font-medium border transition-colors",
                            task.category === "keep"
                              ? "bg-control border-hairline font-semibold text-ink"
                              : "border-transparent text-ink-tertiary hover:bg-control/50 hover:text-ink"
                          )}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(task.id, "eliminate")}
                          className={cn(
                            "px-2.5 py-1 rounded text-[11px] font-medium border transition-colors",
                            task.category === "eliminate"
                              ? "bg-control border-hairline font-semibold text-ink"
                              : "border-transparent text-ink-tertiary hover:bg-control/50 hover:text-ink"
                          )}
                        >
                          Eliminate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(task.id, "redesign")}
                          className={cn(
                            "px-2.5 py-1 rounded text-[11px] font-medium border transition-colors",
                            task.category === "redesign"
                              ? "bg-control border-hairline font-semibold text-ink"
                              : "border-transparent text-ink-tertiary hover:bg-control/50 hover:text-ink"
                          )}
                        >
                          Redesign (AI)
                        </button>
                        {task.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-ink-tertiary hover:text-ink transition-colors ml-1"
                            title="Xóa công việc này"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: 7-ZONE AI MATURITY ASSESSMENT */
            <div className="space-y-5">
              {/* Score & Tier Banner (Clean Neutral Card) */}
              <div className="rounded-xl border border-hairline/60 bg-control/20 p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-medium text-ink-secondary">
                      Kết Quả Đo Độ Trưởng Thành AI (7 Vùng Doanh Nghiệp)
                    </span>
                    <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink mt-0.5">
                      {maturityResult.tierTitle}
                    </h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[22px] sm:text-[24px] font-bold text-ink">
                      {maturityResult.totalScore}
                    </span>
                    <span className="text-[13px] text-ink-tertiary font-medium">/21 Điểm ({maturityResult.percentage}%)</span>
                  </div>
                </div>

                {/* Progress Bar (Single Accent) */}
                <div className="h-2 w-full rounded-full bg-control overflow-hidden border border-hairline/40">
                  <div
                    className="h-full bg-accent transition-all duration-300 rounded-full"
                    style={{ width: `${maturityResult.percentage}%` }}
                  />
                </div>

                <p className="text-[12px] text-ink-secondary leading-relaxed">
                  {maturityResult.diagnosis}
                </p>

                {/* 3 Prescriptions */}
                <div className="border-t border-hairline/40 pt-2.5 space-y-1">
                  <span className="text-[11px] font-semibold text-ink">Đơn thuốc hành động khẩn cấp:</span>
                  <ul className="space-y-1 text-[11px] sm:text-[12px] text-ink-secondary">
                    {maturityResult.prescriptions.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="font-semibold text-accent">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 90-Day Roadmap Spine */}
                <div className="border-t border-hairline/40 pt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                    <Calendar size={13} className="text-accent" />
                    <span>Lộ trình chuyển đổi 90 ngày:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg bg-card p-2 border border-hairline/40 text-ink-secondary">
                      <strong className="text-ink block mb-0.5">30 Ngày Đầu:</strong>
                      {maturityResult.ninetyDayRoadmapSpine.month1}
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-hairline/40 text-ink-secondary">
                      <strong className="text-ink block mb-0.5">60 Ngày Giữa:</strong>
                      {maturityResult.ninetyDayRoadmapSpine.month2}
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-hairline/40 text-ink-secondary">
                      <strong className="text-ink block mb-0.5">90 Ngày Sau:</strong>
                      {maturityResult.ninetyDayRoadmapSpine.month3}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7 Questions Interactive Form */}
              <div className="space-y-3">
                <span className="text-[13px] font-semibold text-ink block">
                  Rà soát 7 câu hỏi đại diện cho 7 Vùng vận hành:
                </span>
                <div className="space-y-3">
                  {MATURITY_QUESTIONS.map((q) => {
                    const currentVal = answers[q.id] ?? 0;
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-hairline/60 bg-card p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono text-ink-secondary bg-control px-2 py-0.5 rounded">
                            {q.zoneName}
                          </span>
                          <span className="text-[11px] font-semibold text-ink">
                            {currentVal}/3 điểm
                          </span>
                        </div>
                        <h4 className="text-[13px] font-medium text-ink leading-snug">
                          {q.question}
                        </h4>

                        {/* 4 Choices */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options.map((opt) => {
                            const isSelected = currentVal === opt.score;
                            return (
                              <button
                                key={opt.score}
                                type="button"
                                onClick={() => handleSelectOption(q.id, opt.score)}
                                className={cn(
                                  "rounded-lg p-2 text-left border transition-all text-[11px] leading-relaxed flex flex-col justify-between",
                                  isSelected
                                    ? "bg-control border-hairline font-medium text-ink ring-1 ring-hairline"
                                    : "bg-card border-hairline/40 text-ink-secondary hover:bg-control/30"
                                )}
                              >
                                <div>
                                  <span className="font-semibold text-ink block">
                                    {opt.score}đ - {opt.label}
                                  </span>
                                  <span className="text-[10px] text-ink-tertiary line-clamp-2 mt-0.5">
                                    {opt.description}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer matching Voice-to-SOP (Image 3) */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <div className="text-[12px] text-center sm:text-left text-ink-tertiary">
            Khung sát hạch Target Architecture &amp; The AI Maturity Assessment.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {saveSuccess && (
              <span className="text-[12px] font-medium text-accent flex items-center gap-1">
                <Check size={14} />
                Đã lưu hồ sơ thành công!
              </span>
            )}
            {onOpenAutonomyGraduation && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAutonomyGraduation();
                }}
                className="px-3 py-2 text-[12px] font-medium text-accent hover:underline flex items-center gap-1 w-full sm:w-auto justify-center"
              >
                <span>Xem Cổng Tốt Nghiệp 95%</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors w-full sm:w-auto text-center"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 transition-opacity w-full sm:w-auto"
            >
              <ShieldCheck size={15} />
              <span>Lưu &amp; Cập Nhật Hồ Sơ</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
