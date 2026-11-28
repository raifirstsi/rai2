import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock, RefreshCw, Search, ShieldAlert, ShieldCheck, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/cn";

type DataTier = "public" | "internal" | "zone" | "confidential";
type EmployeeRole = "owner" | "admin" | "manager" | "member";

interface EmployeeProfile {
  email: string;
  name: string;
  role: EmployeeRole;
  zone?: string;
  maxDataTier: DataTier;
  personalBotName?: string;
  namespaces: { privatePersonal: string; workContext: string };
  status: "active" | "offboarded";
}

interface GovernanceState {
  constitution: {
    industry: string;
    toneOfVoice: string;
    languagePolicy: string;
    forbiddenTopics: string[];
    requireLocalLlmForConfidential: boolean;
    localLlmEngineHint: string;
    dlpEnabled: boolean;
    censorshipEnabled: boolean;
  };
  employees: Record<string, EmployeeProfile>;
}

interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
  hash: string;
}

const TIER_LABELS: Record<DataTier, string> = {
  public: "Công khai (Public)",
  internal: "Nội bộ (Internal)",
  zone: "Theo Vùng/Phòng ban",
  confidential: "Mật (P&L / HR / Hợp đồng)",
};

export function EnterpriseGovernancePanel() {
  const [subTab, setSubTab] = useState<"people" | "policy" | "audit">("people");
  const [gov, setGov] = useState<GovernanceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Provision employee form
  const [empEmail, setEmpEmail] = useState("");
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState<EmployeeRole>("member");
  const [empZone, setEmpZone] = useState("Zone 3 - Kinh doanh");
  const [empTier, setEmpTier] = useState<DataTier>("zone");

  // Constitution / DLP state
  const [industry, setIndustry] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [forbiddenText, setForbiddenText] = useState("");
  const [dlpEnabled, setDlpEnabled] = useState(true);
  const [censorshipEnabled, setCensorshipEnabled] = useState(true);
  const [requireLocalConfidential, setRequireLocalConfidential] = useState(false);
  const [localHint, setLocalHint] = useState("ollama");

  // DLP test state
  const [dlpSample, setDlpSample] = useState("");
  const [dlpResult, setDlpResult] = useState<{ sanitizedText: string; redactions: Array<{ type: string; count: number }>; blocked: boolean } | null>(null);

  // Audit trail state
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<{ valid: boolean; totalRecords: number } | null>(null);
  const [auditQuery, setAuditQuery] = useState("");

  const loadGovernance = useCallback(async () => {
    try {
      const resp = await fetch("/api/enterprise/governance");
      const data = (await resp.json()) as { governance?: GovernanceState; error?: string };
      if (!resp.ok || !data.governance) {
        setErr(data.error || "Không thể tải cấu hình Quản trị Enterprise.");
        return;
      }
      setGov(data.governance);
      const c = data.governance.constitution;
      setIndustry(c.industry);
      setToneOfVoice(c.toneOfVoice);
      setForbiddenText((c.forbiddenTopics ?? []).join(", "));
      setDlpEnabled(c.dlpEnabled);
      setCensorshipEnabled(c.censorshipEnabled);
      setRequireLocalConfidential(c.requireLocalLlmForConfidential);
      setLocalHint(c.localLlmEngineHint || "ollama");
    } catch {
      setErr("Lỗi kết nối máy chủ Governance.");
    }
  }, []);

  const loadAudit = useCallback(async (q = "") => {
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (q.trim()) params.set("q", q.trim());
      const resp = await fetch(`/api/enterprise/audit-trail?${params.toString()}`);
      const data = (await resp.json()) as { records?: AuditRecord[]; integrity?: { valid: boolean; totalRecords: number } };
      if (resp.ok && data.records) {
        setAuditRecords(data.records);
        setAuditIntegrity(data.integrity ?? null);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void loadGovernance();
    void loadAudit();
  }, [loadGovernance, loadAudit]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/employees/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: empEmail.trim(),
          name: empName.trim() || undefined,
          role: empRole,
          zone: empZone,
          maxDataTier: empTier,
        }),
      });
      const data = (await resp.json()) as { success?: boolean; governance?: GovernanceState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể cấp phát nhân sự (cần quyền Admin).");
        return;
      }
      if (data.governance) setGov(data.governance);
      setEmpEmail("");
      setEmpName("");
      setMsg("Đã cấp phát trợ lý AI riêng & tách namespace bộ nhớ cho nhân viên.");
      void loadAudit(auditQuery);
    } finally {
      setBusy(false);
    }
  };

  const handleOffboard = async (email: string) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/employees/offboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await resp.json()) as { success?: boolean; governance?: GovernanceState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể thu hồi quyền nhân viên.");
        return;
      }
      if (data.governance) setGov(data.governance);
      setMsg(`Đã thu hồi quyền ${email} & khóa bot riêng về chế độ Admin-only.`);
      void loadAudit(auditQuery);
    } finally {
      setBusy(false);
    }
  };

  const handleSavePolicy = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/governance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constitution: {
            industry,
            toneOfVoice,
            forbiddenTopics: forbiddenText.split(",").map((s) => s.trim()).filter(Boolean),
            dlpEnabled,
            censorshipEnabled,
            requireLocalLlmForConfidential: requireLocalConfidential,
            localLlmEngineHint: localHint,
          },
        }),
      });
      const data = (await resp.json()) as { success?: boolean; governance?: GovernanceState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể lưu Hiến pháp & Chính sách DLP.");
        return;
      }
      if (data.governance) setGov(data.governance);
      setMsg("Đã lưu Hiến pháp doanh nghiệp, DLP & chính sách Model Local.");
      void loadAudit(auditQuery);
    } finally {
      setBusy(false);
    }
  };

  const handleTestDlp = async () => {
    if (!dlpSample.trim()) return;
    setBusy(true);
    try {
      const resp = await fetch("/api/enterprise/dlp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dlpSample, blockOnForbiddenTopic: true }),
      });
      const data = (await resp.json()) as { result?: { sanitizedText: string; redactions: Array<{ type: string; count: number }>; blocked: boolean } };
      if (data.result) setDlpResult(data.result);
      void loadAudit(auditQuery);
    } finally {
      setBusy(false);
    }
  };

  const employees = Object.values(gov?.employees ?? {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "people", label: `Nhân sự & Trợ lý riêng (${employees.length})`, icon: Users },
          { id: "policy", label: "Văn hóa, DLP & Censorship", icon: ShieldCheck },
          { id: "audit", label: "Truy vết Merkle Audit", icon: Lock },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as "people" | "policy" | "audit")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                subTab === item.id ? "bg-accent text-white" : "bg-raised text-ink-secondary hover:text-ink",
              )}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
      </div>

      {msg && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</div>}
      {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</div>}

      {subTab === "people" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleProvision(e)} className="grid grid-cols-1 gap-2 rounded-xl border border-hairline/40 bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="email"
              required
              value={empEmail}
              onChange={(e) => setEmpEmail(e.target.value)}
              placeholder="Email nhân viên..."
              className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-xs text-ink"
            />
            <input
              type="text"
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              placeholder="Họ tên (tùy chọn)"
              className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-xs text-ink"
            />
            <select value={empRole} onChange={(e) => setEmpRole(e.target.value as EmployeeRole)} className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-xs text-ink">
              <option value="member">Nhân viên (Member)</option>
              <option value="manager">Trưởng nhóm (Manager)</option>
              <option value="admin">Quản trị (Admin)</option>
            </select>
            <select value={empTier} onChange={(e) => setEmpTier(e.target.value as DataTier)} className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-xs text-ink">
              {Object.entries(TIER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              <UserPlus size={13} /> Cấp trợ lý AI
            </button>
            <input
              type="text"
              value={empZone}
              onChange={(e) => setEmpZone(e.target.value)}
              placeholder="Phòng ban / Zone (VD: Zone 3 - Kinh doanh)"
              className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-xs text-ink sm:col-span-2 lg:col-span-5"
            />
          </form>

          <div className="space-y-2">
            {employees.length === 0 ? (
              <p className="text-xs text-ink-secondary">Chưa có nhân viên nào được cấp phát trong hồ sơ Governance. Hãy thêm nhân viên đầu tiên ở trên (hỗ trợ quy mô 5–20+ nhân viên, mỗi người 1 namespace riêng).</p>
            ) : (
              employees.map((emp) => (
                <div key={emp.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                  <div>
                    <div className="font-semibold text-ink">{emp.name} <span className="font-normal text-ink-secondary">({emp.email})</span></div>
                    <div className="mt-0.5 text-[11px] text-ink-secondary">
                      Vai trò: <strong>{emp.role}</strong> · {emp.zone || "Chung"} · Mức dữ liệu: <strong>{TIER_LABELS[emp.maxDataTier]}</strong>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-tertiary">
                      NS: {emp.namespaces.privatePersonal} | {emp.namespaces.workContext}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.personalBotName && (
                      <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11px] text-ink-secondary">
                        🤖 {emp.personalBotName}
                      </span>
                    )}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", emp.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-danger/15 text-danger")}>
                      {emp.status === "active" ? "Đang hoạt động" : "Đã nghỉ việc"}
                    </span>
                    {emp.status === "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleOffboard(emp.email)}
                        className="rounded-lg border border-danger/40 px-2 py-0.5 text-[11px] text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Thu hồi
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "policy" && (
        <div className="space-y-3 rounded-xl border border-hairline/40 bg-card p-4 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-ink-secondary">Ngành nghề doanh nghiệp</span>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </label>
            <label className="block space-y-1">
              <span className="text-ink-secondary">Từ khóa / Chủ đề CẤM (Censorship, cách nhau dấu phẩy)</span>
              <input value={forbiddenText} onChange={(e) => setForbiddenText(e.target.value)} placeholder="VD: bảng lương, mật khẩu root, giảm giá 50%" className="w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-ink-secondary">Hiến pháp & Văn phong chuẩn (áp dụng toàn công ty)</span>
            <textarea value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} rows={2} className="w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
          </label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={dlpEnabled} onChange={(e) => setDlpEnabled(e.target.checked)} />
              <span>Bật DLP (tự che API Key / Private Key / Số thẻ)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={censorshipEnabled} onChange={(e) => setCensorshipEnabled(e.target.checked)} />
              <span>Bật Censorship đầu ra</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requireLocalConfidential} onChange={(e) => setRequireLocalConfidential(e.target.checked)} />
              <span>Bắt buộc Local LLM ({localHint}) cho dữ liệu Mật</span>
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void handleSavePolicy()} className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
            Lưu Hiến pháp & Chính sách Bảo mật
          </button>

          <div className="mt-4 border-t border-hairline/40 pt-3">
            <div className="mb-1.5 font-medium text-ink">Kiểm thử nhanh bộ lọc DLP & Censorship</div>
            <div className="flex gap-2">
              <input value={dlpSample} onChange={(e) => setDlpSample(e.target.value)} placeholder="Dán thử văn bản chứa sk-123456... hoặc từ khóa cấm" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <button type="button" disabled={busy} onClick={() => void handleTestDlp()} className="rounded-lg bg-raised px-3 py-1.5 font-medium text-ink hover:bg-control">
                Kiểm tra
              </button>
            </div>
            {dlpResult && (
              <div className="mt-2 rounded-lg bg-inset p-2.5 font-mono text-[11px]">
                <div>Kết quả: {dlpResult.blocked ? <span className="text-danger">CHẶN</span> : <span className="text-emerald-600">ĐÃ LÀM SẠCH</span>}</div>
                <div className="mt-1 text-ink-secondary">Sau lọc: {dlpResult.sanitizedText}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "audit" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              {auditIntegrity?.valid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-600">
                  <CheckCircle2 size={13} /> Chuỗi Merkle hợp lệ ({auditIntegrity.totalRecords} bản ghi)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-1 font-medium text-danger">
                  <ShieldAlert size={13} /> Cần kiểm tra tính toàn vẹn sổ cái
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1">
                <Search size={12} className="text-ink-secondary" />
                <input
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadAudit(auditQuery)}
                  placeholder="Lọc actor / action..."
                  className="bg-transparent text-xs text-ink focus:outline-none"
                />
              </div>
              <button type="button" onClick={() => void loadAudit(auditQuery)} className="rounded-lg bg-raised p-1.5 text-ink-secondary hover:text-ink">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {auditRecords.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-hairline/30 bg-card px-3 py-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{rec.action}</span>
                  <span className="text-ink-tertiary">{new Date(rec.timestamp).toLocaleString("vi-VN")}</span>
                </div>
                <div className="mt-0.5 text-ink-secondary">Actor: <strong>{rec.actor}</strong> · Hash: <span className="font-mono">{rec.hash.slice(0, 14)}…</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
