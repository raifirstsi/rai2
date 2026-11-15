import React, { useEffect, useMemo, useState, useId } from "react";
import {
  X,
  Check,
  Sparkles,
  Mic,
  MicOff,
  Layers,
  Route,
  RotateCcw,
  Loader2,
  FileCheck,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";
import { loadSavedTocDiagnosis } from "@/lib/toc-detector";
import { buildBotMemoryBundle, mergeMemoryWithCustomNotes } from "@/lib/role-context-router";
import { saveMemoryDoc, fetchMemoryDoc } from "@/lib/memory";
import { evaluateDataReadiness } from "@/lib/data-readiness";
import { VoiceToSopModal } from "./VoiceToSopModal";
import { DataReadinessGauge } from "./DataReadinessGauge";
import {
  CONTEXT_PILLARS,
  distillUnscriptedKnowledge,
  routeContextForTask,
  scoreContextSharpness,
  loadSavedContextVault,
  saveContextVaultToStorage,
  type ContextPillarId,
  type TaskType,
} from "../lib/context-vault.ts";

export { loadSavedContextVault, saveContextVaultToStorage };


interface ContextVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

const SHORT_PILLAR_LABELS: Record<ContextPillarId, string> = {
  brand_voice: "1. Brand Voice",
  customer_avatar: "2. Khách Hàng",
  offer_breakdown: "3. Sản Phẩm & Offer",
  competitive_positioning: "4. Định Vị Đối Thủ",
  sales_process: "5. Quy Trình Bán Hàng",
  case_studies: "6. Case Study & Proof",
  sops: "7. Quy Trình SOP",
  industry_context: "8. Bối Cảnh Ngành",
};

export const ContextVaultModal: React.FC<ContextVaultModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const dialogTitleId = useId();
  const [activeTab, setActiveTab] = useState<ContextPillarId>("brand_voice");
  const [contents, setContents] = useState<Record<ContextPillarId, string>>(() => {
    const saved = loadSavedContextVault();
    if (saved) return saved;
    const initial: Record<string, string> = {};
    for (const key of Object.keys(CONTEXT_PILLARS)) {
      initial[key] = CONTEXT_PILLARS[key as ContextPillarId].defaultTemplate;
    }
    return initial as Record<ContextPillarId, string>;
  });

  const [rawMonologue, setRawMonologue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [distillNotice, setDistillNotice] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<TaskType>("proposal");
  const [viewMode, setViewMode] = useState<"edit" | "router" | "record">("edit");
  const [voiceToSopOpen, setVoiceToSopOpen] = useState(false);
  const { state } = useStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isHardGateLocked, setIsHardGateLocked] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return true;
      const saved = window.localStorage.getItem("rai2_quote_hard_gate_interlock");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const readiness = useMemo(() => evaluateDataReadiness(contents), [contents]);

  useEffect(() => {
    if (isOpen) {
      saveContextVaultToStorage(contents);
    }
  }, [isOpen, contents]);

  const currentContent = contents[activeTab] || "";
  const sharpness = useMemo(
    () => scoreContextSharpness(currentContent),
    [currentContent]
  );

  const routed = useMemo(
    () => routeContextForTask(activeTask, contents),
    [activeTask, contents]
  );

  if (!isOpen) return null;

  const handleSyncAllBots = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      saveContextVaultToStorage(contents);
      const toc = loadSavedTocDiagnosis();
      let count = 0;
      if (state.bots && state.bots.length > 0) {
        for (const b of state.bots) {
          const bundle = buildBotMemoryBundle(b.section || b.id, contents, toc);

          // If fuel score < 8 and hard gate is locked, inject interlock constraint
          if (readiness.totalScore < 8 && isHardGateLocked) {
            const interlockConstraint =
              "\n\n### [CẦU DAO AN TOÀN - HARD GATE INTERLOCK]\n" +
              "ĐIỂM NHIÊN LIỆU HIỆN TẠI DƯỚI 8/20. TẠM DỪNG CHẾ ĐỘ BOT TỰ ĐỘNG GỬI BÁO GIÁ. " +
              "Mọi kịch bản báo giá phải soạn bản thảo và chuyển cho Người Chủ duyệt trước khi gửi khách hàng.";

            for (const [k, v] of Object.entries(bundle)) {
              if (k.includes("rules") || k.includes("constraints") || k.includes("sops")) {
                bundle[k] = `${v}${interlockConstraint}`;
              }
            }
          }

          for (const [filePath, fileContent] of Object.entries(bundle)) {
            const relPath = filePath.replace(/^memory\//, "");
            try {
              const existing = await fetchMemoryDoc(b.id, relPath).catch(() => null);
              const merged = mergeMemoryWithCustomNotes(existing?.text, fileContent);
              await saveMemoryDoc(b.id, relPath, merged, undefined).catch(() => {});
            } catch {
              await saveMemoryDoc(b.id, relPath, fileContent, undefined).catch(() => {});
            }
          }
          count++;
        }
      }
      setSyncStatus(`Đã đồng bộ thông minh cho ${count} bot`);
      if (onSyncComplete) onSyncComplete();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (e) {
      console.error("Context sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleContentChange = (val: string) => {
    setContents((prev) => ({ ...prev, [activeTab]: val }));
  };

  const handleResetToTemplate = () => {
    setContents((prev) => ({
      ...prev,
      [activeTab]: CONTEXT_PILLARS[activeTab].defaultTemplate,
    }));
  };

  const handleDistill = () => {
    if (!rawMonologue.trim()) return;
    const result = distillUnscriptedKnowledge(rawMonologue);
    setContents((prev) => ({
      ...prev,
      [result.detectedPillar]: `${prev[result.detectedPillar] || ""}\n\n${result.memory}\n\n${result.soul}`,
    }));
    setActiveTab(result.detectedPillar);
    setDistillNotice(result.summary);
    setViewMode("edit");
  };

  const handleToggleRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
        try {
          const SpeechRecognition = (window as unknown as { SpeechRecognition: any; webkitSpeechRecognition: any }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: any }).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "vi-VN";
          recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            setRawMonologue((prev) => (prev ? `${prev} ${transcript}` : transcript));
          };
          recognition.onerror = () => setIsRecording(false);
          recognition.onend = () => setIsRecording(false);
          recognition.start();
        } catch {
          // fallback
        }
      }
    } else {
      setIsRecording(false);
    }
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
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-[1000px] flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Layers size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={dialogTitleId} className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Két Sắt Ngữ Cảnh 8 Trụ Cột
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Context Vault
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Thu âm hoặc nạp tri thức lõi cho hệ thống RAI doanh nghiệp.
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

        {/* View Mode Segmented Bar */}
        <div className="flex shrink-0 snap-x gap-1 overflow-x-auto border-b border-hairline/40 p-2 scrollbar-none sm:px-5">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition-colors",
              viewMode === "edit"
                ? "bg-control font-medium text-ink"
                : "text-ink-secondary hover:bg-control/50 hover:text-ink"
            )}
          >
            <Layers size={13} />
            <span>8 Trụ Cột</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("record")}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition-colors",
              viewMode === "record"
                ? "bg-control font-medium text-ink"
                : "text-ink-secondary hover:bg-control/50 hover:text-ink"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <span>Thu Âm Nhanh</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("router")}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition-colors",
              viewMode === "router"
                ? "bg-control font-medium text-ink"
                : "text-ink-secondary hover:bg-control/50 hover:text-ink"
            )}
          >
            <Route size={13} />
            <span>Bộ Định Tuyến (-80% Token)</span>
          </button>
        </div>

        {/* Data Readiness Fuel Gauge /20 */}
        <div className="px-3 pt-3 shrink-0 sm:px-5">
          <DataReadinessGauge
            vaultData={contents}
            onSelectPillar={(pillarId) => {
              setViewMode("edit");
              setActiveTab(pillarId as ContextPillarId);
            }}
          />
        </div>

        {/* Hard Gate Interlock (Active when fuelScore < 8/20) */}
        {readiness.totalScore < 8 && (
          <div
            data-testid="hard-gate-interlock"
            className="mx-3 mt-2.5 sm:mx-5 rounded-xl border border-hairline/60 bg-card p-3 sm:p-3.5 space-y-2.5 shadow-xs shrink-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                  <ShieldAlert size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[12px] sm:text-[13px] font-semibold text-ink truncate block">
                    Cầu Dao An Toàn (Hard Gate Interlock)
                  </span>
                  <span className="text-[11px] text-ink-secondary">
                    Bảo vệ doanh nghiệp khỏi AI báo giá ảo giác
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium border shrink-0",
                  isHardGateLocked
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-control text-ink-secondary border-hairline"
                )}
              >
                {isHardGateLocked ? "Đang Khóa An Toàn" : "Mở Khóa Cưỡng Bức"}
              </span>
            </div>

            <p className="text-[12px] text-ink leading-relaxed">
              Tạm dừng chế độ bot tự động gửi báo giá cho đến khi bổ sung đủ dữ liệu sàn (Điểm nhiên liệu: {readiness.totalScore}/20, dưới ngưỡng an toàn 8/20).
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-hairline/40">
              <span className="text-[11px] text-ink-tertiary">
                Trạng thái: {isHardGateLocked ? "Mọi báo giá bắt buộc phải có Founder duyệt" : "Cảnh báo: Bot có nguy cơ báo giá sai biên lợi nhuận sàn"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !isHardGateLocked;
                  setIsHardGateLocked(next);
                  try {
                    if (typeof window !== "undefined" && window.localStorage) {
                      window.localStorage.setItem("rai2_quote_hard_gate_interlock", String(next));
                    }
                  } catch {}
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors border shrink-0",
                  isHardGateLocked
                    ? "bg-accent text-white border-transparent hover:bg-accent/90"
                    : "bg-control text-ink border-hairline hover:bg-control/80"
                )}
              >
                {isHardGateLocked ? "Bật Khóa (Khuyến nghị)" : "Mở Khóa Tự Động"}
              </button>
            </div>
          </div>
        )}

        {/* Content Body: Edit Mode */}
        {viewMode === "edit" && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Horizontal Pillar Tabs (Mobile) / Sidebar Tabs (Desktop) */}
            <div className="flex w-full shrink-0 snap-x gap-1 overflow-x-auto border-b border-hairline/40 p-2 scrollbar-none md:w-[200px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-3">
              <div className="hidden px-2 pb-2 pt-1 text-[12px] font-medium text-ink-tertiary md:flex">
                8 Trụ Cột Tri Thức
              </div>
              {(Object.keys(CONTEXT_PILLARS) as ContextPillarId[]).map((id) => {
                const p = CONTEXT_PILLARS[id];
                const active = activeTab === id;
                const shortLabel = SHORT_PILLAR_LABELS[id] || p.title;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "shrink-0 snap-start whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors md:whitespace-normal",
                      active
                        ? "bg-control font-medium text-ink"
                        : "text-ink-secondary hover:bg-control/60 hover:text-ink"
                    )}
                  >
                    <div className="truncate">{shortLabel}</div>
                  </button>
                );
              })}
            </div>

            {/* Main Editor & Sharpness Audit */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Textarea Area */}
              <div className="flex-1 flex flex-col p-3.5 sm:p-4 overflow-y-auto space-y-2.5">
                {distillNotice && (
                  <div className="flex items-center justify-between rounded-xl border border-hairline/40 bg-card p-2.5 text-[13px] text-ink">
                    <span>{distillNotice}</span>
                    <button
                      type="button"
                      onClick={() => setDistillNotice(null)}
                      className="text-ink-tertiary hover:text-ink font-bold ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[13px] sm:text-[14px] text-ink">
                      {CONTEXT_PILLARS[activeTab].title}
                    </h3>
                    <p className="text-[12px] text-ink-secondary">
                      {CONTEXT_PILLARS[activeTab].subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === "sops" && (
                      <button
                        type="button"
                        onClick={() => setVoiceToSopOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-accent/20 transition-colors"
                      >
                        <FileCheck size={13} />
                        <span>Đóng gói SOP (Voice)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleResetToTemplate}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline"
                    >
                      <RotateCcw size={12} />
                      <span>Nạp mẫu chuẩn</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={currentContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="min-h-[200px] w-full flex-1 resize-none rounded-lg border border-hairline/40 bg-inset p-3 font-mono text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-focus/60"
                  placeholder="Nhập nội dung bối cảnh..."
                />
              </div>

              {/* Sharpness Gauge Panel */}
              <div className="flex w-full flex-col gap-2.5 overflow-y-auto border-t border-hairline/40 p-3.5 sm:p-4 lg:w-64 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">
                    Độ Sắc Nét:
                  </span>
                  <span
                    className={cn(
                       "ui-chip border",
                      sharpness.isSharp
                        ? "bg-card text-accent-text border-hairline"
                        : "bg-card text-warning border-hairline"
                    )}
                  >
                    {sharpness.score}/100 {sharpness.isSharp ? "✓ Đạt" : "⚠ Cần sửa"}
                  </span>
                </div>

                <div className="w-full bg-control rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${sharpness.score}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-lg border border-hairline/40 bg-card p-2">
                    <div className="text-ink-tertiary">Số từ:</div>
                    <div className="font-semibold text-ink">
                      {sharpness.wordCount}
                    </div>
                  </div>
                    <div className="rounded-lg border border-hairline/40 bg-card p-2">
                    <div className="text-ink-tertiary">Từ/câu TB:</div>
                    <div className="font-semibold text-ink">
                      {sharpness.averageWordsPerSentence} (chuẩn 12-18)
                    </div>
                  </div>
                </div>

                {sharpness.flaggedJargon.length > 0 && (
                  <div className="rounded-lg border border-hairline/40 bg-card p-2.5 text-[12px]">
                    <div className="font-semibold text-ink-secondary mb-1">Từ sáo rỗng:</div>
                    <div className="flex flex-wrap gap-1">
                      {sharpness.flaggedJargon.map((j) => (
                        <span
                          key={j}
                          className="px-1.5 py-0.5 rounded bg-inset text-ink-secondary line-through text-[11px]"
                        >
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[13px] font-semibold text-ink mb-1">
                    Góp ý tinh chỉnh:
                  </div>
                  <ul className="text-[12px] space-y-1 text-ink-secondary">
                    {sharpness.feedback.map((f, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-accent-text">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record First View */}
        {viewMode === "record" && (
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="text-center mb-4">
              <h3 className="text-[17px] font-semibold text-ink">
                Thu Âm Hoặc Dán Bối Cảnh Thực Chiến
              </h3>
              <p className="text-[13px] text-ink-secondary mt-0.5">
                Nói ra kinh nghiệm thực tế, AI tự động chắt lọc vào Két Sắt.
              </p>
            </div>

            <div className="flex items-center justify-center mb-3">
              <button
                type="button"
                onClick={handleToggleRecord}
                className={cn(
                  "ui-button ui-button-lg",
                  isRecording
                    ? "bg-danger text-white animate-pulse"
                    : "ui-button-primary"
                )}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                <span>{isRecording ? "Đang nghe... (Chạm để dừng)" : "Bắt đầu thu âm"}</span>
              </button>
            </div>

            <textarea
              value={rawMonologue}
              onChange={(e) => setRawMonologue(e.target.value)}
              className="h-40 w-full resize-none rounded-lg border border-hairline/40 bg-inset p-3.5 font-sans text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-focus/60 sm:h-48"
              placeholder="Hoặc dán toàn bộ đoạn trao đổi, transcript cuộc họp, quy tắc bán hàng vào đây..."
            />

            <div className="mt-3 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setRawMonologue("")}
                className="ui-button w-full sm:w-auto"
              >
                Xóa văn bản
              </button>
              <button
                type="button"
                onClick={handleDistill}
                disabled={!rawMonologue.trim()}
                className="ui-button ui-button-primary ui-button-lg w-full sm:w-auto"
              >
                <Sparkles size={13} />
                <span>Chắt Lọc Tri Thức →</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Context Router View */}
        {viewMode === "router" && (
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-3.5">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">
                Tự Động Trích Xuất Bối Cảnh, Tiết Kiệm 80% Token
              </h3>
              <p className="text-[13px] text-ink-secondary mt-0.5">
                Chỉ nạp đúng 2–3 trụ cột liên quan theo từng tác vụ, không nạp tràn lan.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "proposal", label: "Lập Báo Giá" },
                { id: "ad_copy", label: "Viết Quảng Cáo" },
                { id: "cskh", label: "Chăm Sóc KH" },
                { id: "hiring", label: "Tuyển Dụng" },
                { id: "qc", label: "Kiểm Soát QC" },
                { id: "finance", label: "Đối Soát Tài Chính" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTask(t.id as TaskType)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-[13px] transition-colors",
                    activeTask === t.id
                      ? "bg-control font-medium text-ink"
                      : "text-ink-secondary hover:bg-control/50 hover:text-ink"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-hairline/40 bg-card p-3 text-[13px]">
                <div className="font-semibold text-ink mb-1">
                  Trụ cột nạp ({routed.activePillars.length}/8):
                </div>
                <div className="space-y-0.5">
                  {routed.activePillars.map((p) => (
                    <div key={p} className="text-accent-text font-medium">
                      ✓ {CONTEXT_PILLARS[p].title}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-hairline/40 bg-card p-3 text-[13px]">
                <div className="font-semibold text-ink mb-0.5">
                  Token Tiết Kiệm:
                </div>
                <div className="text-[18px] font-black text-accent-text">
                  ~{routed.tokensSavedEstimate.toLocaleString()} tokens
                </div>
                <div className="text-[11px] text-ink-tertiary mt-0.5">
                  Giảm 75% – 85% chi phí API.
                </div>
              </div>

              <div className="rounded-xl border border-hairline/40 bg-card p-3 text-[13px]">
                <div className="font-semibold text-ink mb-0.5">
                  Độ chính xác:
                </div>
                <div className="text-[18px] font-black text-ink">
                  &gt; 92%
                </div>
                <div className="text-[11px] text-ink-tertiary mt-0.5">
                  Đặt đúng vị trí tối ưu ngữ cảnh.
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="text-[13px] font-semibold text-ink mb-1">
                Xem trước bối cảnh tinh gọn:
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-inset p-3 font-mono text-[12px] leading-relaxed text-ink-secondary">
                {routed.combinedContext}
              </pre>
            </div>
          </div>
        )}

        {/* Sticky Action Footer CTA matching Image 3 */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <div className="text-[12px] text-center sm:text-left text-ink-tertiary">
            {syncStatus || "Mã hóa và lưu trữ cục bộ trong Két Sắt Doanh Nghiệp."}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors hidden sm:inline-flex"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSyncAllBots}
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-50 transition-opacity w-full sm:w-auto"
            >
              {isSyncing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang Đồng Bộ...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Lưu & Đồng Bộ Toàn Bộ RAIs</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>

      {voiceToSopOpen && (
        <VoiceToSopModal
          isOpen={voiceToSopOpen}
          onClose={() => setVoiceToSopOpen(false)}
          onSopSaved={() => {
            const fresh = loadSavedContextVault();
            if (fresh) setContents(fresh);
          }}
        />
      )}
    </div>
  );
};
