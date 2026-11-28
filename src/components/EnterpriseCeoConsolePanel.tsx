import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, KeyRound, Lock, RefreshCw, ShieldCheck } from "lucide-react";

interface CeoConsoleSnap {
  tenantId: string;
  generatedAt: string;
  organization: {
    activeEmployees: number;
    offboardedEmployees: number;
    zones: Array<{
      zone: string;
      employees: number;
      openTasks: number;
      completedTasks: number;
      blockedTasks: number;
      decisions: number;
      knowledge: number;
    }>;
  };
  productivity: {
    totalTasks: number;
    completedTasks: number;
    reviewNeededTasks: number;
    blockedTasks: number;
    completionRatePct: number;
    totalDagWorkflows: number;
    totalDagRuns: number;
    completedDagRuns: number;
  };
  knowledge: {
    approvedDecisions: number;
    proposedDecisions: number;
    approvedKnowledge: number;
    proposedKnowledge: number;
    totalKnowledgeUsage: number;
    handoversCount: number;
  };
  security: {
    dlpEventsCount: number;
    confidentialReroutesCount: number;
    offboardBlocksCount: number;
    dekKeyVersion: number;
    dekRotatedAt: number;
    sealedSecretsCount: number;
    sealedSecretNames: string[];
    omnichannelCount: number;
    activeChannelBindings: number;
  };
  aiSpend: {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    byModel: Array<{ model: string; turns: number; costUsd: number }>;
  };
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EnterpriseCeoConsolePanel() {
  const [snap, setSnap] = useState<CeoConsoleSnap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");

  const loadConsole = useCallback(async () => {
    try {
      const resp = await fetch("/api/enterprise/ceo-console");
      const data = (await resp.json()) as { console?: CeoConsoleSnap; error?: string };
      if (!resp.ok || !data.console) {
        setErr(data.error || "Chỉ Admin/CEO mới xem được CEO Governance Console.");
        return;
      }
      setSnap(data.console);
    } catch {
      setErr("Lỗi kết nối máy chủ.");
    }
  }, []);

  useEffect(() => {
    void loadConsole();
  }, [loadConsole]);

  const handleSealSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretName.trim() || !secretValue.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/sovereignty/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretName, plaintext: secretValue }),
      });
      const data = (await resp.json()) as { success?: boolean; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể mã hóa secret.");
        return;
      }
      setSecretName("");
      setSecretValue("");
      setMsg("Đã mã hóa Envelope DEK (AES-256-GCM) và lưu an toàn.");
      void loadConsole();
    } finally {
      setBusy(false);
    }
  };

  const handleRotateDek = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/sovereignty/rotate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "default" }),
      });
      const data = (await resp.json()) as { success?: boolean; rotated?: { keyVersion: number; reencryptedSecrets: number }; error?: string };
      if (!resp.ok || !data.success || !data.rotated) {
        setErr(data.error || "Không thể xoay vòng DEK.");
        return;
      }
      setMsg(`Đã xoay vòng DEK lên phiên bản v${data.rotated.keyVersion} (tái mã hóa ${data.rotated.reencryptedSecrets} secrets).`);
      void loadConsole();
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: "json" | "markdown" | "encrypted") => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch(`/api/enterprise/sovereignty/export?format=${format}`);
      const data = (await resp.json()) as { content?: string; bundle?: unknown; package?: unknown; error?: string };
      if (!resp.ok) {
        setErr(data.error || "Không thể xuất dữ liệu.");
        return;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === "markdown" && data.content) {
        triggerDownload(`rai2-sovereign-export-${dateStr}.md`, data.content, "text/markdown");
      } else if (format === "encrypted" && data.package) {
        triggerDownload(`rai2-envelope-backup-${dateStr}.rai2enc.json`, JSON.stringify(data.package, null, 2), "application/json");
      } else {
        triggerDownload(`rai2-open-export-${dateStr}.json`, JSON.stringify(data.bundle ?? data, null, 2), "application/json");
      }
      setMsg(`Đã xuất gói dữ liệu chủ quyền (${format.toUpperCase()}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <BarChart3 size={15} /> CEO Governance & Sovereignty Console
        </div>
        <button type="button" disabled={busy} onClick={() => void loadConsole()} className="inline-flex items-center gap-1 rounded-lg bg-raised px-2.5 py-1 text-xs text-ink-secondary hover:text-ink">
          <RefreshCw size={12} /> Làm mới
        </button>
      </div>

      {msg && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</div>}
      {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</div>}

      {snap && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-hairline/40 bg-card p-3">
              <div className="text-[11px] text-ink-tertiary">Nhân sự hoạt động</div>
              <div className="mt-1 text-lg font-bold text-ink">{snap.organization.activeEmployees}</div>
              <div className="text-[10px] text-ink-tertiary">Đã offboard: {snap.organization.offboardedEmployees}</div>
            </div>
            <div className="rounded-xl border border-hairline/40 bg-card p-3">
              <div className="text-[11px] text-ink-tertiary">Hiệu suất Đội ngũ AI</div>
              <div className="mt-1 text-lg font-bold text-emerald-600">{snap.productivity.completionRatePct}%</div>
              <div className="text-[10px] text-ink-tertiary">{snap.productivity.completedTasks}/{snap.productivity.totalTasks} việc · {snap.productivity.totalDagWorkflows} DAG</div>
            </div>
            <div className="rounded-xl border border-hairline/40 bg-card p-3">
              <div className="text-[11px] text-ink-tertiary">Tri thức Tích lũy</div>
              <div className="mt-1 text-lg font-bold text-ink">{snap.knowledge.approvedDecisions + snap.knowledge.approvedKnowledge}</div>
              <div className="text-[10px] text-ink-tertiary">Dùng lại {snap.knowledge.totalKnowledgeUsage} lần · {snap.knowledge.handoversCount} bàn giao</div>
            </div>
            <div className="rounded-xl border border-hairline/40 bg-card p-3">
              <div className="text-[11px] text-ink-tertiary">Bảo mật & Chi phí LLM</div>
              <div className="mt-1 text-lg font-bold text-ink">${snap.aiSpend.totalCostUsd.toFixed(4)}</div>
              <div className="text-[10px] text-ink-tertiary">DLP: {snap.security.dlpEventsCount} · Local Reroute: {snap.security.confidentialReroutesCount}</div>
            </div>
          </div>

          {snap.organization.zones.length > 0 && (
            <div className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
              <div className="mb-2 font-medium text-ink">Hiệu suất theo Phòng ban / Zone</div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {snap.organization.zones.map((z) => (
                  <div key={z.zone} className="flex items-center justify-between rounded-lg bg-inset px-2.5 py-1.5 text-[11px]">
                    <span><strong>{z.zone}</strong> ({z.employees} NV)</span>
                    <span className="text-ink-secondary">Việc: {z.completedTasks} xong / {z.openTasks} mở · Tri thức: {z.decisions + z.knowledge}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="mb-1.5 font-medium text-ink">
              Chi phí &amp; Token LLM theo Model ({snap.aiSpend.totalInputTokens.toLocaleString("vi-VN")} in / {snap.aiSpend.totalOutputTokens.toLocaleString("vi-VN")} out)
            </div>
            {snap.aiSpend.byModel.length === 0 ? (
              <div className="text-[11px] text-ink-tertiary">Chưa phát sinh lượt chạy LLM tính phí trong sổ Merkle Audit.</div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {snap.aiSpend.byModel.map((m) => (
                  <div key={m.model} className="flex items-center justify-between rounded-lg bg-inset px-2.5 py-1.5 text-[11px]">
                    <span><code>{m.model}</code> ({m.turns} lượt)</span>
                    <strong>${m.costUsd.toFixed(4)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-hairline/40 bg-card p-3 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <KeyRound size={14} /> Envelope Encryption & Xoay vòng Khóa DEK (v{snap.security.dekKeyVersion})
              </div>
              <button type="button" disabled={busy} onClick={() => void handleRotateDek()} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1 font-medium text-amber-600 hover:bg-amber-500/25">
                <Lock size={12} /> Xoay vòng Khóa DEK
              </button>
            </div>
            <form onSubmit={(e) => void handleSealSecret(e)} className="flex flex-wrap gap-2">
              <input value={secretName} onChange={(e) => setSecretName(e.target.value)} placeholder="Tên Credential (VD: OPENAI_KEY)" className="w-44 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} placeholder="Giá trị bí mật (được bọc AES-256-GCM)" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <button type="submit" disabled={busy || !secretName.trim() || !secretValue.trim()} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
                Mã hóa & Lưu
              </button>
            </form>
            <div className="text-[11px] text-ink-tertiary">
              Đã mã hóa {snap.security.sealedSecretsCount} secrets: {snap.security.sealedSecretNames.join(", ") || "Chưa có"} · Kênh chat: {snap.security.omnichannelCount} ({snap.security.activeChannelBindings} nhân sự đã định danh).
            </div>
          </div>

          <div className="rounded-xl border border-hairline/40 bg-card p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck size={14} /> Xuất Dữ liệu Mở & Sao lưu Chủ quyền (Data Portability)
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void handleExport("markdown")} className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 font-medium text-ink hover:bg-control">
                <Download size={13} /> Xuất Open Markdown (.md)
              </button>
              <button type="button" disabled={busy} onClick={() => void handleExport("json")} className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 font-medium text-ink hover:bg-control">
                <Download size={13} /> Xuất Open JSON (.json)
              </button>
              <button type="button" disabled={busy} onClick={() => void handleExport("encrypted")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 font-medium text-emerald-600 hover:bg-emerald-500/25">
                <Lock size={13} /> Sao lưu Mã hóa DEK (.rai2enc.json)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
