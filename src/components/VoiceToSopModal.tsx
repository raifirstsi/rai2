import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  FileCheck,
  AlertTriangle,
  Check,
  Loader2,
  Mic,
  MicOff,
  BookOpen,
} from "lucide-react";
import { useStore } from "@/state/store";
import {
  compileMonologueToSop,
  ExtractedSop,
  formatSopToMarkdown,
  saveSopToVault,
  SopCategory,
  SOP_CATEGORY_LABELS,
} from "@/lib/voice-to-sop";
import { saveMemoryDoc, fetchMemoryDoc } from "@/lib/memory";
import { mergeMemoryWithCustomNotes } from "@/lib/role-context-router";

interface VoiceToSopModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onSopSaved?: (sop: ExtractedSop) => void;
}

export function VoiceToSopModal({
  isOpen,
  onClose,
  initialText = "",
  onSopSaved,
}: VoiceToSopModalProps) {
  const { state } = useStore();
  const [rawText, setRawText] = useState(initialText);
  const [selectedCategory, setSelectedCategory] = useState<SopCategory>("general");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(false);
  const [extractedSop, setExtractedSop] = useState<ExtractedSop | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [syncToAllBots, setSyncToAllBots] = useState(true);

  // Editable fields during review
  const [editTitle, setEditTitle] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editSteps, setEditSteps] = useState<string[]>([]);
  const [editGuardrails, setEditGuardrails] = useState<string[]>([]);
  const [editDod, setEditDod] = useState("");

  useEffect(() => {
    if (initialText) {
      setRawText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSpeech = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
      setRecordingSupported(hasSpeech);
    }
  }, []);

  if (!isOpen) return null;

  const handleStartRecording = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      // @ts-expect-error browser compatibility
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "vi-VN";

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript.trim()) {
          setRawText((prev) => (prev ? `${prev} ${currentTranscript}` : currentTranscript));
        }
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition error:", e);
      setIsRecording(false);
    }
  };

  const handleExtract = () => {
    if (!rawText.trim()) return;
    const compiled = compileMonologueToSop(rawText, {
      category: selectedCategory !== "general" ? selectedCategory : undefined,
    });

    setExtractedSop(compiled);
    setEditTitle(compiled.title);
    setEditTrigger(compiled.trigger);
    setEditSteps([...compiled.steps]);
    setEditGuardrails([...compiled.guardrails]);
    setEditDod(compiled.definitionOfDone);
  };

  const handleConfirmAndSave = async () => {
    if (!extractedSop) return;
    setIsSaving(true);
    setSaveSuccessMessage("");

    try {
      const finalizedSop: ExtractedSop = {
        ...extractedSop,
        title: editTitle.trim() || extractedSop.title,
        trigger: editTrigger.trim() || extractedSop.trigger,
        steps: editSteps.filter((s) => s.trim().length > 0),
        guardrails: editGuardrails.filter((g) => g.trim().length > 0),
        definitionOfDone: editDod.trim() || extractedSop.definitionOfDone,
      };

      // 1. Save into Context Vault localStorage & trigger storage event
      saveSopToVault(finalizedSop);

      // 2. Optionally sync into relevant bots' memory/sops.md
      if (syncToAllBots && state.bots && state.bots.length > 0) {
        const formattedMd = formatSopToMarkdown(finalizedSop);
        for (const bot of state.bots) {
          try {
            const existing = await fetchMemoryDoc(bot.id, "sops.md").catch(() => null);
            const currentText = existing?.text || "# STANDARD OPERATING PROCEDURES (SOP)\n";
            const merged = mergeMemoryWithCustomNotes(
              currentText,
              `${currentText.trim()}\n\n---\n\n${formattedMd.trim()}`
            );
            await saveMemoryDoc(bot.id, "sops.md", merged, undefined).catch(() => {});
          } catch {
            // Ignore single bot sync errors
          }
        }
      }

      setSaveSuccessMessage("Đã đóng gói và nạp SOP thành công vào Két Sắt & Bot!");
      if (onSopSaved) onSopSaved(finalizedSop);

      setTimeout(() => {
        setIsSaving(false);
        setExtractedSop(null);
        setRawText("");
        onClose();
      }, 1000);
    } catch (e) {
      console.error("Save SOP error:", e);
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FileCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-ink">
                  Voice-to-SOP: Đóng Gói Quy Trình 1-Chạm
                </h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Record First
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary">
                Biến độc thoại hoặc kinh nghiệm xử lý sự cố của Founder thành quy trình chuẩn 4 phần.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!extractedSop ? (
            /* Step 1: Input / Recording */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-[13px] font-medium text-ink flex items-center gap-2">
                  <span>Lời nói, Độc thoại hoặc Ghi chép của Người chủ</span>
                </label>
                <div className="flex items-center gap-2">
                  {recordingSupported && (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        isRecording
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-raised text-ink hover:bg-raised/80"
                      }`}
                    >
                      {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                      {isRecording ? "Đang lắng nghe..." : "Thu âm trực tiếp"}
                    </button>
                  )}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as SopCategory)}
                    className="rounded-lg border border-hairline/60 bg-control px-2.5 py-1.5 text-[12px] text-ink focus:outline-none"
                  >
                    {Object.entries(SOP_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="Ví dụ độc thoại của Founder: 'Khi khách hàng phàn nàn về việc giao hàng trễ, bước 1 kế toán phải kiểm tra mã vận đơn ngay. Sau đó gọi điện xin lỗi khách trong 15 phút và hẹn lịch mới. Lưu ý tuyệt đối không đổ lỗi cho shipper trước mặt khách. Xong việc khi khách đồng ý lịch mới...'"
                className="w-full rounded-xl border border-hairline/60 bg-control p-4 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-accent focus:outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] text-ink-secondary">
                  💡 Mẹo: Nói tự nhiên như khi bạn đang chỉ việc cho một trợ lý mới.
                </span>
                <button
                  type="button"
                  disabled={!rawText.trim()}
                  onClick={handleExtract}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-40 transition-opacity"
                >
                  <Sparkles size={16} />
                  Trích Xuất SOP 4 Phần
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Review & Approve SOP 4 Parts */
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Category & Title */}
              <div className="rounded-xl border border-hairline/50 bg-raised/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-ink-secondary">
                    Phân loại:{" "}
                    <strong className="text-ink">
                      {SOP_CATEGORY_LABELS[extractedSop.category]}
                    </strong>
                  </span>
                  <span className="rounded bg-control px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
                    {extractedSop.id}
                  </span>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-ink">Tiêu đề Quy trình</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-[14px] font-medium text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* 1. Trigger */}
              <div className="rounded-xl border border-hairline/50 bg-card p-4 space-y-1.5">
                <label className="text-[13px] font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent font-bold">
                    1
                  </span>
                  Bối cảnh & Điều kiện kích hoạt (Trigger)
                </label>
                <textarea
                  value={editTrigger}
                  onChange={(e) => setEditTrigger(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-hairline/40 bg-control p-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
                />
              </div>

              {/* 2. Steps */}
              <div className="rounded-xl border border-hairline/50 bg-card p-4 space-y-2">
                <label className="text-[13px] font-semibold text-ink flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent font-bold">
                    2
                  </span>
                  Các bước thực thi tuần tự (Execution Checklist)
                </label>
                <div className="space-y-2">
                  {editSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-ink-secondary w-5 shrink-0 text-center">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => {
                          const updated = [...editSteps];
                          updated[idx] = e.target.value;
                          setEditSteps(updated);
                        }}
                        className="flex-1 rounded-lg border border-hairline/40 bg-control px-3 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Guardrails */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                <label className="text-[13px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  3. Ranh giới cấm & Quy tắc an toàn (Guardrails & Limits)
                </label>
                <div className="space-y-2">
                  {editGuardrails.map((guard, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-amber-500 text-[12px]">⚠️</span>
                      <input
                        type="text"
                        value={guard}
                        onChange={(e) => {
                          const updated = [...editGuardrails];
                          updated[idx] = e.target.value;
                          setEditGuardrails(updated);
                        }}
                        className="flex-1 rounded-lg border border-amber-500/30 bg-card px-3 py-1.5 text-[13px] text-ink focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Definition of Done */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
                <label className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Check size={16} />
                  4. Tiêu chuẩn hoàn thành (Definition of Done)
                </label>
                <textarea
                  value={editDod}
                  onChange={(e) => setEditDod(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-emerald-500/30 bg-card p-2.5 text-[13px] text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Sync Options */}
              <div className="flex items-center gap-2 pt-1 text-[13px] text-ink">
                <input
                  type="checkbox"
                  id="syncBots"
                  checked={syncToAllBots}
                  onChange={(e) => setSyncToAllBots(e.target.checked)}
                  className="rounded border-hairline"
                />
                <label htmlFor="syncBots" className="cursor-pointer select-none">
                  Tự động đồng bộ vào bộ nhớ (<code>memory/sops.md</code>) của Đội nhân sự số
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-between border-t border-hairline/50 px-6 py-4 bg-card">
          {extractedSop ? (
            <>
              <button
                type="button"
                onClick={() => setExtractedSop(null)}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-secondary hover:bg-raised transition-colors"
              >
                Chỉnh Sửa Lại Độc Thoại
              </button>
              <div className="flex items-center gap-3">
                {saveSuccessMessage && (
                  <span className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check size={15} />
                    {saveSuccessMessage}
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-40 transition-opacity"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  Xác Nhận & Nạp Vào Hệ Thống
                </button>
              </div>
            </>
          ) : (
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-secondary hover:bg-raised transition-colors"
              >
                Đóng
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
