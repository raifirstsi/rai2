import { useState, useEffect, useId } from "react";
import {
  Check,
  Sparkles,
  X,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  Users,
  Target,
  Briefcase,
  AlertCircle,
  BookOpen,
  Gauge,
  Crown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { RAI2_DEPARTMENTS, type RaiAgentDefinition } from "@/lib/rai2-departments";
import { api, type Bot, type InstanceInfo } from "@/state/store";
import { BotCreationDraft, EMPTY_BOT_DEFAULTS } from "@/lib/bot-creation-draft";
import { createConfiguredBot } from "@/lib/create-configured-bot";
import { buildBotMemoryBundle } from "@/lib/role-context-router";
import { loadSavedContextVault } from "@/lib/context-vault";
import { loadSavedTocDiagnosis } from "@/lib/toc-detector";

interface HireAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectAgent?: (agent: RaiAgentDefinition) => void;
  onHired?: (bot: Bot) => void | Promise<void>;
  initialZone?: number;
}

const SHORT_ZONE_NAMES: Record<number, string> = {
  1: "Z1 Điều Hành",
  2: "Z2 Marketing",
  3: "Z3 Bán Hàng",
  4: "Z4 Vận Hành",
  5: "Z5 CSKH",
  6: "Z6 Tài Chính",
  7: "Z7 Nhân Sự",
};

export function HireAgentDialog({ open, onClose, onSelectAgent, onHired, initialZone }: HireAgentDialogProps) {
  const dialogTitleId = useId();
  const [selectedZone, setSelectedZone] = useState<number>(initialZone && initialZone >= 1 && initialZone <= 7 ? initialZone : 2);
  const [activeAgent, setActiveAgent] = useState<RaiAgentDefinition | null>(() => {
    const startZone = initialZone && initialZone >= 1 && initialZone <= 7 ? initialZone : 2;
    const dept = RAI2_DEPARTMENTS.find((d) => d.zone === startZone);
    return dept?.agents[0] ?? RAI2_DEPARTMENTS[0]?.agents[0] ?? null;
  });
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [step, setStep] = useState<"browse" | "onboard">("browse");

  // Step 2: Dedicated Enterprise Onboarding state
  const [customName, setCustomName] = useState("");
  const [marginFloor, setMarginFloor] = useState(15);
  const [injectVault, setInjectVault] = useState(true);
  const [runEvalOnHire, setRunEvalOnHire] = useState(true);
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const targetZone = initialZone && initialZone >= 1 && initialZone <= 7 ? initialZone : 2;
      setSelectedZone(targetZone);
      const dept = RAI2_DEPARTMENTS.find((d) => d.zone === targetZone) ?? RAI2_DEPARTMENTS[0];
      if (dept && dept.agents.length > 0) {
        setActiveAgent(dept.agents[0]);
      }
      setMobileView("list");
      setStep("browse");
      setHireError(null);
      setHiring(false);
    }
  }, [open, initialZone]);

  useEffect(() => {
    if (!open || step !== "onboard" || instances.length > 0) return;
    let alive = true;
    void api<{ instances?: InstanceInfo[] }>("/api/instances")
      .then((res) => {
        if (alive && Array.isArray(res?.instances)) {
          setInstances(res.instances.filter((i) => i.snapshot?.state === "available"));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, step, instances.length]);

  if (!open) return null;

  const currentDepartment =
    RAI2_DEPARTMENTS.find((d) => d.zone === selectedZone) ?? RAI2_DEPARTMENTS[0];

  const handleSelectZone = (zone: number) => {
    setSelectedZone(zone);
    const dept = RAI2_DEPARTMENTS.find((d) => d.zone === zone);
    if (dept && dept.agents.length > 0) {
      setActiveAgent(dept.agents[0]);
    }
    setMobileView("list");
  };

  const handleAgentClick = (agent: RaiAgentDefinition) => {
    setActiveAgent(agent);
    setMobileView("detail");
  };

  const enterOnboarding = (agent: RaiAgentDefinition) => {
    if (!onHired && onSelectAgent) {
      onSelectAgent(agent);
      onClose();
      return;
    }
    setActiveAgent(agent);
    setCustomName(agent.name);
    setHireError(null);
    setStep("onboard");
  };

  const vault = step === "onboard" ? loadSavedContextVault() : null;
  const toc = step === "onboard" ? loadSavedTocDiagnosis() : null;
  const memoryBundle =
    step === "onboard" && activeAgent
      ? buildBotMemoryBundle(activeAgent.departmentName, vault, toc)
      : {};

  const handleConfirmHire = async () => {
    if (!activeAgent || hiring) return;
    setHiring(true);
    setHireError(null);
    try {
      const draft = new BotCreationDraft(EMPTY_BOT_DEFAULTS, () => {});
      const enterpriseSoul = [
        `Bạn là ${customName.trim() || activeAgent.name} — ${activeAgent.title}.`,
        `Thuộc ${activeAgent.departmentName} (Vùng ${activeAgent.zone} · RAI² Enterprise).`,
        `KPI Cam Kết: ${activeAgent.kpiCommitment}`,
        "DNA Vận Hành Cốt Lõi:",
        ...activeAgent.prebakedDna.map((d) => `- ${d}`),
        `Chốt chặn Margin Guard: Mọi báo giá có biên lợi nhuận < ${marginFloor}% bắt buộc bật thẻ phê duyệt HITL trình Giám đốc trước khi gửi khách.`,
        "Tuân thủ ranh giới đơn nhiệm dưới sự điều phối của CAIO & Sổ cái kiểm toán Merkle.",
      ].join("\n");

      const modelOption = instances.flatMap((inst) =>
        (inst.models?.options ?? []).map((opt) => ({
          key: `${inst.instanceId}::${opt.id}`,
          instanceId: inst.instanceId,
          model: opt.id,
        })),
      ).find((m) => m.key === selectedModel);

      draft.patch({
        name: customName.trim() || activeAgent.name,
        title: activeAgent.title,
        description: `${activeAgent.tagline} | KPI: ${activeAgent.kpiCommitment}`,
        soul: enterpriseSoul,
        section: activeAgent.departmentName,
        zone: activeAgent.zone,
        approvalMode: "ask",
        ...(modelOption
          ? { modelSelection: { instanceId: modelOption.instanceId, model: modelOption.model } }
          : {}),
      });

      if (injectVault) {
        for (const [filePath, content] of Object.entries(memoryBundle)) {
          draft.setMemory(filePath, content);
        }
      }
      draft.setMemory(
        "memory/enterprise-sla.md",
        [
          `# Hồ sơ Onboarding Nhân Sự Số: ${customName.trim() || activeAgent.name}`,
          `- Vùng Nghiệp Vụ: Zone ${activeAgent.zone} (${activeAgent.departmentName})`,
          `- Mã vị trí: ${activeAgent.key.toUpperCase()}`,
          `- KPI Cam Kết: ${activeAgent.kpiCommitment}`,
          `- Ngưỡng khóa Margin Guard: >= ${marginFloor}%`,
          `- Trạng thái Promotion Gate ban đầu: Tier 1 (Bắt buộc HITL, chờ sát hạch /21)`,
        ].join("\n"),
      );

      const { bot } = await createConfiguredBot(draft);

      if (runEvalOnHire) {
        await api("/api/bots/evals/run", {
          method: "POST",
          body: JSON.stringify({
            botId: bot.id,
            botName: bot.name,
            systemPrompt: enterpriseSoul,
            interactions: [
              {
                userPrompt: `Kiểm tra khả năng xử lý nghiệp vụ thuộc ${activeAgent.departmentName}`,
                botResponse: `Đã tiếp nhận KPI: ${activeAgent.kpiCommitment}. Luôn giữ Margin >= ${marginFloor}% và xin duyệt HITL khi vượt ngưỡng.`,
                toolsCalled: ["context_vault_lookup"],
                calculatedValues: { marginFloor },
              },
            ],
          }),
        }).catch(() => {});
      }

      onSelectAgent?.(activeAgent);
      await onHired?.(bot);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHireError(
        msg.includes("VIP") || msg.includes("403")
          ? "Chức năng Tuyển Nhân Sự Số Enterprise 7 Vùng chỉ dành cho gói Enterprise VIP (hoặc đang trong 14 ngày dùng thử)."
          : msg,
      );
    } finally {
      setHiring(false);
    }
  };

  return (
    <div
      className="ui-scrim fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onClick={onClose}
    >
      <div
        className="ui-modal relative flex h-[min(780px,94dvh)] w-full max-w-[1000px] flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline/40 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-500 shrink-0" />
              <h2 id={dialogTitleId} className="truncate text-[17px] font-semibold text-ink">
                {step === "browse"
                  ? "Bàn Tuyển Dụng Nhân Sự Số (Enterprise)"
                  : `Onboarding Phòng Ban · ${activeAgent?.departmentName}`}
              </h2>
            </div>
            <p className="mt-0.5 hidden truncate text-[13px] text-ink-secondary sm:block">
              {step === "browse"
                ? "Bước 1/2: Chọn vị trí chuẩn theo 7 Vùng Nghiệp Vụ & điểm nghẽn TOC doanh nghiệp."
                : "Bước 2/2: Bơm Két Sắt Ngữ Cảnh 8 trụ cột, khóa ngưỡng Margin Guard & kích hoạt Promotion Gate."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button shrink-0"
            aria-label="Đóng"
          >
            <X size={18} className="pointer-events-none" />
          </button>
        </div>

        {step === "onboard" && activeAgent ? (
          <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Vùng {activeAgent.zone} · {activeAgent.departmentName}
                  </span>
                  <h3 className="text-[16px] font-semibold text-ink mt-0.5">
                    {activeAgent.name} — {activeAgent.title}
                  </h3>
                </div>
                <span className="rounded-lg bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-secondary border border-hairline/50">
                  Khởi đầu Tier 1 (HITL Mandatory)
                </span>
              </div>
              <p className="mt-2 text-[12px] text-accent-text font-medium">
                KPI Mục Tiêu: {activeAgent.kpiCommitment}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-[13px] font-medium text-ink">
                Tên định danh trong công ty
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-hairline/60 bg-inset px-3 py-2 text-[13px] text-ink"
                  placeholder={activeAgent.name}
                />
              </label>

              <label className="block text-[13px] font-medium text-ink">
                Ngưỡng khóa Margin Guard tối thiểu (%)
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={marginFloor}
                  onChange={(e) => setMarginFloor(Number(e.target.value) || 15)}
                  className="mt-1.5 w-full rounded-lg border border-hairline/60 bg-inset px-3 py-2 text-[13px] text-ink"
                />
              </label>
            </div>

            <label className="block text-[13px] font-medium text-ink">
              Engine / Model AI điều phối vị trí này
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-hairline/60 bg-inset px-3 py-2 text-[13px] text-ink"
              >
                <option value="">Tự động theo cấu hình chuẩn của Workspace</option>
                {instances.map((inst) =>
                  (inst.models?.options ?? []).map((opt) => (
                    <option key={`${inst.instanceId}::${opt.id}`} value={`${inst.instanceId}::${opt.id}`}>
                      {inst.displayName} — {opt.label || opt.id}
                    </option>
                  )),
                )}
              </select>
            </label>

            <div className="rounded-xl border border-hairline/50 bg-card p-4 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={injectVault}
                  onChange={(e) => setInjectVault(e.target.checked)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <BookOpen size={14} className="text-emerald-500" />
                    <span>Đồng bộ Két Sắt Ngữ Cảnh 8 Trụ Cột &amp; Điểm Nghẽn TOC</span>
                  </div>
                  <p className="text-[12px] text-ink-secondary mt-0.5">
                    Tự động nạp {Object.keys(memoryBundle).length} tài liệu tri thức công ty đúng vai trò phòng ban ({Object.keys(memoryBundle).join(", ") || "DNA cơ bản"}).
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer border-t border-hairline/40 pt-3">
                <input
                  type="checkbox"
                  checked={runEvalOnHire}
                  onChange={(e) => setRunEvalOnHire(e.target.checked)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <Gauge size={14} className="text-accent" />
                    <span>Chạy bài sát hạch khởi tạo Promotion Gate (/21)</span>
                  </div>
                  <p className="text-[12px] text-ink-secondary mt-0.5">
                    Kiểm định ngay sự tuân thủ luật doanh nghiệp sau khi đưa nhân sự vào phòng ban.
                  </p>
                </div>
              </label>
            </div>

            {hireError && (
              <div role="alert" className="rounded-lg bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                {hireError}
              </div>
            )}

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-hairline/40 bg-panel pt-4">
              <button
                type="button"
                disabled={hiring}
                onClick={() => setStep("browse")}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink-secondary hover:bg-control hover:text-ink"
              >
                <ArrowLeft size={15} />
                <span>Chọn lại vị trí</span>
              </button>
              <button
                type="button"
                disabled={hiring || !customName.trim()}
                onClick={() => void handleConfirmHire()}
                className="ui-button ui-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              >
                {hiring && <Loader2 size={15} className="animate-spin" />}
                <span>Ký Quyết Định Tuyển &amp; Đưa Vào Phòng Ban</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Horizontal Zone Pills */}
            <div className="flex shrink-0 snap-x gap-1 overflow-x-auto border-b border-hairline/40 p-2 scrollbar-none md:hidden">
              {RAI2_DEPARTMENTS.map((dept) => {
                const isSelected = dept.zone === selectedZone;
                const label = SHORT_ZONE_NAMES[dept.zone] || `Z${dept.zone}`;
                return (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => handleSelectZone(dept.zone)}
                    className={cn(
                      "shrink-0 snap-start whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition-colors",
                      isSelected
                        ? "bg-control font-medium text-ink"
                        : "text-ink-secondary hover:bg-control/50 hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Back Bar */}
            {mobileView === "detail" && (
              <div className="flex shrink-0 items-center justify-between border-b border-hairline/40 px-4 py-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-text"
                >
                  <ArrowLeft size={14} />
                  <span>Quay lại {currentDepartment.name.replace(/^Phòng\s+/i, "")}</span>
                </button>
                <span className="text-[13px] text-ink-secondary">
                  {currentDepartment.agents.length} nhân sự
                </span>
              </div>
            )}

            {/* Main Content Layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Column: 7 Departments Navigation (Desktop only) */}
              <div className="hidden w-[200px] shrink-0 flex-col overflow-y-auto border-r border-hairline/40 p-3 md:flex">
                <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[12px] font-medium text-ink-tertiary">
                  <span>7 Vùng Nghiệp Vụ</span>
                  <Users size={13} className="text-ink-tertiary" />
                </div>
                <div className="space-y-0.5">
                  {RAI2_DEPARTMENTS.map((dept) => {
                    const isSelected = dept.zone === selectedZone;
                    return (
                      <button
                        key={dept.code}
                        type="button"
                        onClick={() => handleSelectZone(dept.zone)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                          isSelected
                            ? "bg-control font-medium text-ink"
                            : "text-ink-secondary hover:bg-control/60 hover:text-ink",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
                            isSelected
                              ? "bg-ink/10 text-ink"
                              : "bg-control text-ink-secondary",
                          )}
                        >
                          Z{dept.zone}
                        </div>
                        <div className="flex-1 min-w-0 truncate">
                          {dept.name}
                        </div>
                        {isSelected && (
                          <ChevronRight size={14} className="text-ink-tertiary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center Column: Department Agents List */}
              <div
                className={cn(
                  "space-y-2 overflow-y-auto p-3",
                  mobileView === "list" ? "flex-1 w-full" : "hidden md:block",
                  "border-hairline/40 md:w-72 md:shrink-0 md:border-r lg:w-80",
                )}
              >
                <div className="rounded-xl border border-hairline/40 bg-card p-3">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold text-accent-text uppercase tracking-wide">
                      Vùng {currentDepartment.zone}
                    </span>
                    <span className="text-[11px] text-ink-secondary">
                      {currentDepartment.agents.length} nhân sự
                    </span>
                  </div>
                  <h3 className="text-[13px] font-semibold text-ink">
                    {currentDepartment.name}
                  </h3>
                  <p className="text-[12px] text-ink-secondary leading-snug mt-0.5">
                    {currentDepartment.description}
                  </p>
                </div>

                <div className="space-y-1.5">
                  {currentDepartment.agents.map((agent) => {
                    const isActive = activeAgent?.key === agent.key;

                    return (
                      <div
                        key={agent.key}
                        onClick={() => handleAgentClick(agent)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-3 transition-colors",
                          isActive
                            ? "border-hairline/60 bg-raised"
                            : "border-hairline/40 bg-card hover:bg-raised/50",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="size-1.5 shrink-0 rounded-full bg-ink/35" />
                            <h4 className="text-[13px] font-semibold text-ink truncate">
                              {agent.name}
                            </h4>
                          </div>
                          {isActive && (
                            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                          )}
                        </div>

                        <p className="text-[12px] text-ink-secondary mb-1.5 line-clamp-2 leading-relaxed">
                          {agent.tagline}
                        </p>

                        <div className="mb-1.5">
                          <span className="inline-block rounded-md bg-inset px-2 py-0.5 text-[11px] text-ink-secondary">
                            KPI: {agent.kpiCommitment}
                          </span>
                        </div>

                        <div className="md:hidden pt-1.5 border-t border-hairline flex items-center justify-between text-[12px] text-accent-text font-medium">
                          <span>Xem chi tiết &amp; Tuyển dụng</span>
                          <ChevronRight size={13} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Deep Agent Profile */}
              <div
                className={cn(
                  "flex flex-1 flex-col overflow-y-auto",
                  mobileView === "detail" ? "w-full block" : "hidden md:flex",
                )}
              >
                {activeAgent ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="p-4 sm:p-5 space-y-3 max-w-2xl">
                      <div className="rounded-xl border border-hairline/40 bg-card p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-accent-text uppercase tracking-wide">
                            {activeAgent.departmentName}
                          </span>
                          <span className="text-ink-tertiary">·</span>
                          <span className="text-[11px] text-ink-tertiary font-mono">
                            {activeAgent.key.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="text-[17px] font-semibold text-ink tracking-tight">
                          {activeAgent.name}
                        </h3>
                        <p className="text-[13px] text-ink-secondary mt-0.5">
                          {activeAgent.title}
                        </p>
                        <p className="text-[13px] text-ink-secondary mt-1 leading-relaxed">
                          {activeAgent.tagline}
                        </p>
                      </div>

                      <div className="rounded-xl border border-hairline/40 bg-card p-3.5">
                        <div className="text-[13px] font-semibold text-ink mb-1 flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-accent-text shrink-0" />
                          <span>Vấn Đề Giải Quyết:</span>
                        </div>
                        <p className="text-[13px] text-ink-secondary leading-relaxed">
                          {activeAgent.painPoint}
                        </p>
                      </div>

                      <div className="rounded-xl border border-hairline/40 bg-card p-3.5">
                        <div className="text-[13px] font-semibold text-ink mb-1 flex items-center gap-1.5">
                          <Target size={14} className="text-accent shrink-0" />
                          <span>Cam Kết Đầu Ra (KPI):</span>
                        </div>
                        <p className="text-[13px] text-accent-text leading-relaxed font-medium">
                          {activeAgent.kpiCommitment}
                        </p>
                      </div>

                      <div className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3.5">
                        <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-accent shrink-0" />
                          <span>80% Nghiệp Vụ Nạp Sẵn:</span>
                        </div>
                        <div className="space-y-1.5">
                          {activeAgent.prebakedDna.map((dna, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-[13px] text-ink-secondary"
                            >
                              <Check size={13} className="text-accent shrink-0 mt-0.5" />
                              <span className="leading-snug">{dna}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-inset p-3 text-[13px] text-ink-secondary">
                        <Briefcase size={13} className="text-ink-tertiary shrink-0" />
                        <span>Đơn nhiệm chuyên sâu, log kiểm toán minh bạch dưới quyền CAIO.</span>
                      </div>
                    </div>

                    <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-hairline/40 bg-panel p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:p-4">
                      <div className="max-w-2xl mx-auto">
                        <button
                          type="button"
                          onClick={() => enterOnboarding(activeAgent)}
                          className="ui-button ui-button-primary ui-button-lg w-full"
                        >
                          <Sparkles size={14} />
                          <span>Tiếp tục: Thiết lập KPI &amp; Tuyển {activeAgent.name} →</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-ink-tertiary">
                    Chọn một nhân sự số để xem chi tiết
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

