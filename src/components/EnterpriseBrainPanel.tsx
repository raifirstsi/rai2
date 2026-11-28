import { useCallback, useEffect, useState } from "react";
import { Archive, BookOpenCheck, Brain, CheckCircle2, FileText, Plus, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type PromotionStatus = "proposed" | "approved" | "deprecated";
type KnowledgeKind = "sop" | "best_practice" | "project_brief" | "operational_pattern";

interface OrgDecision {
  id: string;
  title: string;
  summary: string;
  scopeZone: string;
  status: PromotionStatus;
  effectiveFrom: string;
  proposedBy: string;
  approvedBy?: string;
}

interface OrgKnowledge {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  scopeZone: string;
  authorEmail: string;
  status: PromotionStatus;
  approvedBy?: string;
}

interface HandoverPkg {
  id: string;
  departedEmail: string;
  departedName: string;
  zone: string;
  successorEmail?: string;
  preservedWorkNamespace: string;
  purgedPrivateNamespace: string;
  summary: string;
  createdAt: number;
}

interface BrainState {
  decisions: Record<string, OrgDecision>;
  knowledge: Record<string, OrgKnowledge>;
  handovers: Record<string, HandoverPkg>;
}

const STATUS_BADGE: Record<PromotionStatus, { label: string; cls: string }> = {
  proposed: { label: "Chờ duyệt", cls: "bg-amber-500/15 text-amber-600" },
  approved: { label: "Đang hiệu lực", cls: "bg-emerald-500/15 text-emerald-600" },
  deprecated: { label: "Đã ngừng (Rollback)", cls: "bg-raised text-ink-tertiary" },
};

const KIND_LABELS: Record<KnowledgeKind, string> = {
  best_practice: "Cách làm hay (Best Practice)",
  sop: "Quy trình chuẩn (SOP)",
  project_brief: "Bối cảnh Dự án",
  operational_pattern: "Mẫu vận hành thực tế",
};

export function EnterpriseBrainPanel() {
  const [subTab, setSubTab] = useState<"decisions" | "knowledge" | "onboarding">("decisions");
  const [brain, setBrain] = useState<BrainState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Decision form
  const [decTitle, setDecTitle] = useState("");
  const [decSummary, setDecSummary] = useState("");
  const [decZone, setDecZone] = useState("all");

  // Knowledge form
  const [knowKind, setKnowKind] = useState<KnowledgeKind>("best_practice");
  const [knowTitle, setKnowTitle] = useState("");
  const [knowContent, setKnowContent] = useState("");
  const [knowZone, setKnowZone] = useState("all");

  // Onboarding brief
  const [briefZone, setBriefZone] = useState("all");
  const [briefEmail, setBriefEmail] = useState("");
  const [briefMarkdown, setBriefMarkdown] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadBrain = useCallback(async () => {
    try {
      const resp = await fetch("/api/enterprise/brain");
      const data = (await resp.json()) as { brain?: BrainState; error?: string };
      if (!resp.ok || !data.brain) {
        setErr(data.error || "Không thể tải Bộ não Tri thức Enterprise.");
        return;
      }
      setBrain(data.brain);
    } catch {
      setErr("Lỗi kết nối máy chủ.");
    }
  }, []);

  useEffect(() => {
    void loadBrain();
  }, [loadBrain]);

  const handleProposeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decTitle.trim() || !decSummary.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/decisions/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: decTitle, summary: decSummary, scopeZone: decZone }),
      });
      const data = (await resp.json()) as { success?: boolean; brain?: BrainState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể đề xuất quyết định.");
        return;
      }
      if (data.brain) setBrain(data.brain);
      setDecTitle("");
      setDecSummary("");
      setMsg("Đã ghi nhận đề xuất quyết định vào Sổ cái (chờ Quản lý duyệt).");
    } finally {
      setBusy(false);
    }
  };

  const handleReviewDecision = async (id: string, status: PromotionStatus) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/decisions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await resp.json()) as { success?: boolean; brain?: BrainState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Cần quyền Admin để duyệt quyết định.");
        return;
      }
      if (data.brain) setBrain(data.brain);
      setMsg(status === "approved" ? "Đã duyệt quyết định — mọi bot liên quan sẽ tự động biết từ bây giờ." : "Đã cập nhật trạng thái quyết định.");
    } finally {
      setBusy(false);
    }
  };

  const handleProposeKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowTitle.trim() || !knowContent.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/knowledge/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: knowKind, title: knowTitle, content: knowContent, scopeZone: knowZone }),
      });
      const data = (await resp.json()) as { success?: boolean; brain?: BrainState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể gửi tri thức.");
        return;
      }
      if (data.brain) setBrain(data.brain);
      setKnowTitle("");
      setKnowContent("");
      setMsg("Đã đề xuất tri thức mới vào Knowledge Flywheel.");
    } finally {
      setBusy(false);
    }
  };

  const handleReviewKnowledge = async (id: string, status: PromotionStatus) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/knowledge/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await resp.json()) as { success?: boolean; brain?: BrainState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Cần quyền Admin để duyệt tri thức.");
        return;
      }
      if (data.brain) setBrain(data.brain);
      setMsg(status === "approved" ? "Đã phát hành tri thức cho toàn doanh nghiệp học hỏi." : "Đã cập nhật trạng thái tri thức.");
    } finally {
      setBusy(false);
    }
  };

  const handleBuildBrief = async () => {
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (briefZone.trim()) params.set("zone", briefZone.trim());
      if (briefEmail.trim()) params.set("email", briefEmail.trim());
      const resp = await fetch(`/api/enterprise/onboarding-brief?${params.toString()}`);
      const data = (await resp.json()) as { brief?: { markdown: string }; error?: string };
      if (data.brief?.markdown) setBriefMarkdown(data.brief.markdown);
      else setErr(data.error || "Không tạo được briefing.");
    } finally {
      setBusy(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const decisions = Object.values(brain?.decisions ?? {})
    .filter((d) => !q || `${d.title} ${d.summary} ${d.scopeZone}`.toLowerCase().includes(q))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const knowledge = Object.values(brain?.knowledge ?? {})
    .filter((k) => !q || `${k.title} ${k.content} ${k.scopeZone}`.toLowerCase().includes(q));
  const handovers = Object.values(brain?.handovers ?? {}).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "decisions", label: `Quyết định công ty (${decisions.length})`, icon: Brain },
          { id: "knowledge", label: `Kho Tri thức (${knowledge.length})`, icon: BookOpenCheck },
          { id: "onboarding", label: `Bàn giao & Onboarding (${handovers.length})`, icon: Sparkles },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as "decisions" | "knowledge" | "onboarding")}
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

      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm quyết định / tri thức / Zone..." className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-1.5 text-xs text-ink" />

      {msg && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</div>}
      {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</div>}

      {subTab === "decisions" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleProposeDecision(e)} className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="font-medium text-ink">Ghi nhận / Đề xuất Quyết định Doanh nghiệp</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={decTitle} onChange={(e) => setDecTitle(e.target.value)} required placeholder="VD: Ngừng chiết khấu quá 10% từ tháng 12" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink sm:col-span-2" />
              <input value={decZone} onChange={(e) => setDecZone(e.target.value)} placeholder="Phạm vi (all hoặc Zone 3)" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </div>
            <textarea value={decSummary} onChange={(e) => setDecSummary(e.target.value)} required rows={2} placeholder="Chi tiết quyết định & lý do..." className="w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
              <Plus size={13} /> Lưu vào Sổ cái Quyết định
            </button>
          </form>

          <div className="space-y-2">
            {decisions.length === 0 ? (
              <p className="text-xs text-ink-secondary">Chưa có quyết định nào. Mọi quyết định được duyệt sẽ tự động nạp vào bối cảnh của các AI liên quan.</p>
            ) : (
              decisions.map((d) => (
                <div key={d.id} className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-ink">[{d.effectiveFrom}] {d.title}</div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_BADGE[d.status].cls)}>{STATUS_BADGE[d.status].label}</span>
                  </div>
                  <p className="mt-1 text-ink-secondary">{d.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-tertiary">
                    <span>Phạm vi: <strong>{d.scopeZone}</strong> · Đề xuất: {d.proposedBy}</span>
                    <div className="flex gap-1.5">
                      {d.status !== "approved" && (
                        <button type="button" disabled={busy} onClick={() => void handleReviewDecision(d.id, "approved")} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 hover:bg-emerald-500/25">
                          <CheckCircle2 size={12} /> Duyệt
                        </button>
                      )}
                      {d.status !== "deprecated" && (
                        <button type="button" disabled={busy} onClick={() => void handleReviewDecision(d.id, "deprecated")} className="inline-flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-ink-secondary hover:text-ink">
                          <XCircle size={12} /> Ngừng hiệu lực
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "knowledge" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleProposeKnowledge(e)} className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="font-medium text-ink">Đóng gói Cách làm hay / SOP cho toàn công ty học</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select value={knowKind} onChange={(e) => setKnowKind(e.target.value as KnowledgeKind)} className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink">
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={knowTitle} onChange={(e) => setKnowTitle(e.target.value)} required placeholder="Tên quy trình / bài học..." className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={knowZone} onChange={(e) => setKnowZone(e.target.value)} placeholder="Phạm vi (all hoặc Zone)" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </div>
            <textarea value={knowContent} onChange={(e) => setKnowContent(e.target.value)} required rows={2} placeholder="Các bước thực hiện, lưu ý thực chiến..." className="w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
              <Plus size={13} /> Đề xuất lên Kho Tri thức
            </button>
          </form>

          <div className="space-y-2">
            {knowledge.map((k) => (
              <div key={k.id} className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-ink">{k.title} <span className="font-normal text-ink-tertiary">({KIND_LABELS[k.kind]})</span></div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_BADGE[k.status].cls)}>{STATUS_BADGE[k.status].label}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-ink-secondary">{k.content}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-ink-tertiary">
                  <span>Phạm vi: <strong>{k.scopeZone}</strong> · Tác giả: {k.authorEmail}</span>
                  <div className="flex gap-1.5">
                    {k.status !== "approved" && (
                      <button type="button" disabled={busy} onClick={() => void handleReviewKnowledge(k.id, "approved")} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 hover:bg-emerald-500/25">
                        <CheckCircle2 size={12} /> Duyệt phát hành
                      </button>
                    )}
                    {k.status !== "deprecated" && (
                      <button type="button" disabled={busy} onClick={() => void handleReviewKnowledge(k.id, "deprecated")} className="inline-flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-ink-secondary hover:text-ink">
                        <XCircle size={12} /> Ngừng hiệu lực
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "onboarding" && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-ink"><FileText size={14} /> Tạo Briefing Onboarding cho Nhân viên mới / Dự án</div>
            <div className="flex flex-wrap gap-2">
              <input value={briefZone} onChange={(e) => setBriefZone(e.target.value)} placeholder="Zone / Dự án (VD: all hoặc Zone 3)" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={briefEmail} onChange={(e) => setBriefEmail(e.target.value)} placeholder="Email nhân viên mới (tùy chọn)" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <button type="button" disabled={busy} onClick={() => void handleBuildBrief()} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
                Tổng hợp Bối cảnh
              </button>
            </div>
            {briefMarkdown && (
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(briefMarkdown);
                    setMsg("Đã sao chép Briefing Onboarding vào clipboard.");
                  }}
                  className="rounded-md bg-raised px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-control"
                >
                  Sao chép Briefing
                </button>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-inset p-3 font-mono text-[11px] text-ink-secondary">{briefMarkdown}</pre>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink"><Archive size={13} /> Hồ sơ Bàn giao Tri thức khi Nhân viên nghỉ việc</div>
            {handovers.length === 0 ? (
              <p className="text-xs text-ink-secondary">Chưa có hồ sơ bàn giao nào. Khi thu hồi quyền nhân viên ở tab Quản trị, tri thức công việc sẽ tự động lưu tại đây.</p>
            ) : (
              handovers.map((h) => (
                <div key={h.id} className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                  <div className="font-semibold text-ink">{h.departedName} ({h.departedEmail}) · {h.zone}</div>
                  <p className="mt-1 text-ink-secondary">{h.summary}</p>
                  <div className="mt-1 font-mono text-[10px] text-ink-tertiary">
                    Bảo toàn: {h.preservedWorkNamespace} | Đã khóa riêng tư: {h.purgedPrivateNamespace} {h.successorEmail ? `| Kế nhiệm: ${h.successorEmail}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
