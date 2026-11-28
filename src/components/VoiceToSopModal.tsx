import { loadSavedContextVault } from "@/lib/context-vault";
import { patchEnterpriseState, transcribeVoiceAudioOnServer } from "@/lib/enterprise-state-client";
import { api } from "@/state/store";
import { useState, useEffect, useRef } from "react";
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
  Upload,
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
import { isEnterpriseBot } from "@/lib/rai2-departments";

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
  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    if (isOpen && initialText && initialText.trim().length > 0) {
      setRawText(initialText);
      const compiled = compileMonologueToSop(initialText, {
        category: selectedCategory !== "general" ? selectedCategory : undefined,
      });
      setExtractedSop(compiled);
      setEditTitle(compiled.title);
      setEditTrigger(compiled.trigger);
      setEditSteps([...compiled.steps]);
      setEditGuardrails([...compiled.guardrails]);
      setEditDod(compiled.definitionOfDone);
    } else if (isOpen && (!initialText || initialText.trim().length === 0)) {
      setRawText("");
      setExtractedSop(null);
    }
  }, [isOpen, initialText]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasMedia = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
      const hasSpeech = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
      setRecordingSupported(hasMedia || hasSpeech);
    }
  }, []);

  if (!isOpen) return null;

  const transcribeBlob = async (blob: Blob, fileName?: string) => {
    setAudioError(null);
    if (blob.size > 12 * 1024 * 1024) {
      setAudioError("File ghi âm vượt quá giới hạn 12MB.");
      return;
    }
    setTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Không đọc được dữ liệu âm thanh"));
        reader.readAsDataURL(blob);
      });
      const res = await transcribeVoiceAudioOnServer({
        audioBase64: base64,
        mimeType: blob.type || "audio/webm",
        fileName,
        language: "vi",
      });
      if (res.ok && res.text) {
        setRawText((prev) => (prev ? `${prev}\n${res.text}` : res.text!));
      } else {
        setAudioError(res.error || "Không giải mã được âm thanh.");
      }
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Lỗi xử lý file âm thanh");
    } finally {
      setTranscribing(false);
    }
  };

  const handleStartRecording = async () => {
    if (typeof window === "undefined") return;
    setAudioError(null);

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    const hasMedia = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
    if (hasMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const preferredMime = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
        const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
        mediaChunksRef.current = [];
        recorder.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) mediaChunksRef.current.push(evt.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const outBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (outBlob.size > 0) {
            void transcribeBlob(outBlob, "mic-recording");
          }
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
        return;
      } catch {
        // Fall back to Web Speech API if available
      }
    }

    const SpeechRecognition =
      // @ts-expect-error browser compatibility
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAudioError("Trình duyệt chưa cấp quyền micro.");
      return;
    }
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

      // 1. Save into Context Vault (both local cache & server Enterprise state)
      saveSopToVault(finalizedSop);
      const savedVault = loadSavedContextVault();
      if (savedVault) {
        await patchEnterpriseState({ contextVault: { pillars: savedVault } });
      }
      if (/\d+/.test(rawText)) {
        void api("/api/voice/handoff", {
          method: "POST",
          body: JSON.stringify({ workspaceId: "default", transcript: rawText, sessionId: `sop_${Date.now()}` }),
        }).catch(() => {});
      }

      // 2. Optionally sync into relevant enterprise bots' memory/sops.md (skip free bots)
      const targetBots = (state.bots || []).filter(isEnterpriseBot);
      if (syncToAllBots && targetBots.length > 0) {
        const formattedMd = formatSopToMarkdown(finalizedSop);
        for (const bot of targetBots) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-3xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <FileCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Voice-to-SOP: Đóng Gói Quy Trình 1-Chạm
                </h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Record First
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Biến độc thoại hoặc kinh nghiệm xử lý sự cố của Founder thành quy trình chuẩn 4 phần.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {!extractedSop ? (
            /* Step 1: Input / Recording */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-[13px] font-medium text-ink flex items-center gap-2">
                  <span>Lời nói, Độc thoại hoặc Ghi chép của Người chủ</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {recordingSupported && (
                    <button
                      type="button"
                      disabled={transcribing}
                      onClick={() => void handleStartRecording()}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        isRecording
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-raised text-ink hover:bg-raised/80"
                      }`}
                    >
                      {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                      {isRecording ? "Dừng & Giải mã" : "Thu âm trực tiếp"}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void transcribeBlob(f, f.name);
                    }}
                  />
                  <button
                    type="button"
                    disabled={transcribing || isRecording}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline/60 bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-raised disabled:opacity-50"
                  >
                    {transcribing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <span>{transcribing ? "Đang giải mã Whisper..." : "Tải file ghi âm"}</span>
                  </button>
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

              {audioError && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-ink">
                  ⚠️ {audioError}
                </div>
              )}
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="Ví dụ độc thoại của Founder: 'Khi khách hàng phàn nàn về việc giao hàng trễ, bước 1 kế toán phải kiểm tra mã vận đơn ngay. Sau đó gọi điện xin lỗi khách trong 15 phút và hẹn lịch mới. Lưu ý tuyệt đối không đổ lỗi cho shipper trước mặt khách. Xong việc khi khách đồng ý lịch mới...'"
                className="w-full rounded-xl border border-hairline/60 bg-control p-3.5 sm:p-4 text-[13px] text-ink placeholder:text-ink-secondary/60 focus:border-accent focus:outline-none leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-[12px] text-ink-secondary">
                  💡 Mẹo: Nói tự nhiên như khi bạn đang chỉ việc cho một trợ lý mới.
                </span>
                <button
                  type="button"
                  disabled={!rawText.trim()}
                  onClick={handleExtract}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-40 transition-opacity w-full sm:w-auto"
                >
                  <Sparkles size={16} />
                  <span>Trích Xuất SOP 4 Phần</span>
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
        <footer className="flex flex-col-reverse sm:flex-row items-center justify-between border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 bg-card gap-2.5 shrink-0">
          {extractedSop ? (
            <>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setExtractedSop(null)}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-secondary hover:bg-raised transition-colors"
                >
                  Chỉnh Sửa Lại Độc Thoại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors"
                >
                  Đóng
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto justify-end">
                {saveSuccessMessage && (
                  <span className="text-[13px] font-medium text-accent flex items-center gap-1.5">
                    <Check size={15} />
                    {saveSuccessMessage}
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-40 transition-opacity w-full sm:w-auto"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                  <span>Xác Nhận & Nạp Vào Hệ Thống</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors"
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
