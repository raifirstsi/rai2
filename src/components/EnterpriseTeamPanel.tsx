import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, GitBranch, Play, Plus, RefreshCw, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type WorkStatus = "pending" | "in_progress" | "review_needed" | "approved" | "rejected" | "blocked" | "completed";

interface WorkItem {
  id: string;
  title: string;
  description: string;
  zone: string;
  priority: "normal" | "high" | "urgent";
  assignedBotId: string;
  assignedBotName: string;
  leadBotId?: string;
  status: WorkStatus;
  progressPct: number;
  blockerReason?: string;
  deliverable?: string;
  reviewedBy?: string;
}

interface DagStep {
  id: string;
  title: string;
  kind: "agent_task" | "condition" | "human_approval" | "notify";
}

interface DagWorkflow {
  id: string;
  name: string;
  description: string;
  scopeZone: string;
  maxHops: number;
  budgetCapUsd: number;
  steps: DagStep[];
}

interface DagRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "running" | "waiting_approval" | "completed" | "failed" | "budget_exceeded";
  currentStepId: string | null;
  hopCount: number;
  spentUsd: number;
}

interface EscalationCard {
  id: string;
  kind: string;
  title: string;
  summaryLines: string[];
  zone: string;
  status: "open" | "approved" | "reassigned" | "dismissed";
}

interface ReminderRule {
  id: string;
  title: string;
  schedule: string;
  targetZone: string;
}

interface TeamState {
  workItems: Record<string, WorkItem>;
  workflows: Record<string, DagWorkflow>;
  dagRuns: Record<string, DagRun>;
  escalations: Record<string, EscalationCard>;
  reminders: Record<string, ReminderRule>;
}

const STATUS_STYLE: Record<WorkStatus, { label: string; cls: string }> = {
  pending: { label: "Chá» nháº­n", cls: "bg-raised text-ink-secondary" },
  in_progress: { label: "Äang cháº¡y", cls: "bg-sky-500/15 text-sky-600" },
  review_needed: { label: "Chá» duyá»‡t", cls: "bg-amber-500/15 text-amber-600" },
  approved: { label: "ÄÃ£ duyá»‡t", cls: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "LÃ m láº¡i", cls: "bg-danger/15 text-danger" },
  blocked: { label: "Bá»‹ káº¹t", cls: "bg-danger/15 text-danger" },
  completed: { label: "HoÃ n táº¥t", cls: "bg-emerald-500/15 text-emerald-600" },
};

export function EnterpriseTeamPanel() {
  const [subTab, setSubTab] = useState<"tasks" | "dag" | "escalations" | "reminders">("tasks");
  const [team, setTeam] = useState<TeamState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskZone, setTaskZone] = useState("Zone 3");
  const [taskAssignee, setTaskAssignee] = useState("Trá»£ lÃ½ Sales");
  const [taskLead, setTaskLead] = useState("TrÆ°á»Ÿng nhÃ³m Kinh doanh");

  const [dagName, setDagName] = useState("");
  const [dagZone, setDagZone] = useState("Zone 3");

  const [remTitle, setRemTitle] = useState("");
  const [remZone, setRemZone] = useState("all");
  const [digestMd, setDigestMd] = useState("");

  const loadTeam = useCallback(async () => {
    try {
      const resp = await fetch("/api/enterprise/team");
      const data = (await resp.json()) as { team?: TeamState; error?: string };
      if (!resp.ok || !data.team) {
        setErr(data.error || "KhÃ´ng thá»ƒ táº£i tráº¡ng thÃ¡i Äá»™i ngÅ© AI & DAG.");
        return;
      }
      setTeam(data.team);
    } catch {
      setErr("Lá»—i káº¿t ná»‘i mÃ¡y chá»§.");
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          zone: taskZone,
          assignedBotId: taskAssignee.toLowerCase().replace(/\s+/g, "-"),
          assignedBotName: taskAssignee,
          leadBotId: taskLead,
        }),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ giao viá»‡c.");
        return;
      }
      if (data.team) setTeam(data.team);
      setTaskTitle("");
      setMsg("ÄÃ£ giao viá»‡c cho Äá»™i ngÅ© AI & Ä‘á»“ng bá»™ lÃªn Cross-Bot Awareness Bus.");
    } finally {
      setBusy(false);
    }
  };

  const handleTaskAction = async (
    taskId: string,
    payload: { action?: "progress" | "approved" | "rejected"; status?: WorkStatus; progressPct?: number; deliverable?: string; notes?: string },
  ) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/tasks/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, ...payload }),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ cáº­p nháº­t cÃ´ng viá»‡c.");
        return;
      }
      if (data.team) setTeam(data.team);
      setMsg("ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i cÃ´ng viá»‡c.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dagName.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dagName,
          scopeZone: dagZone,
          steps: [
            { id: "step-1", title: "AI ThÃ nh viÃªn thu tháº­p & xá»­ lÃ½ dá»¯ liá»‡u", kind: "agent_task" },
            { id: "step-2", title: "Cá»•ng phÃª duyá»‡t cá»§a TrÆ°á»Ÿng phÃ²ng / CEO", kind: "human_approval" },
            { id: "step-3", title: "PhÃ¡t hÃ nh káº¿t quáº£ & cáº­p nháº­t Kho Tri thá»©c", kind: "notify" },
          ],
          publish: true,
        }),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ táº¡o gÃ³i DAG.");
        return;
      }
      if (data.team) setTeam(data.team);
      setDagName("");
      setMsg("ÄÃ£ Ä‘Ã³ng gÃ³i & phÃ¡t hÃ nh DAG Workflow vÃ o Org Library.");
    } finally {
      setBusy(false);
    }
  };

  const handleRunDag = async (opts: { workflowId?: string; runId?: string; action?: "continue" | "approve" | "reject" }) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ cháº¡y DAG.");
        return;
      }
      if (data.team) setTeam(data.team);
      setMsg("ÄÃ£ cáº­p nháº­t tiáº¿n trÃ¬nh cháº¡y DAG Workflow.");
    } finally {
      setBusy(false);
    }
  };

  const handleResolveEsc = async (id: string, decision: "approved" | "reassigned" | "dismissed") => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/escalations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ xá»­ lÃ½ cáº£nh bÃ¡o.");
        return;
      }
      if (data.team) setTeam(data.team);
      setMsg(`ÄÃ£ xá»­ lÃ½ tháº» cáº£nh bÃ¡o (${decision}).`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: remTitle, targetZone: remZone, schedule: "daily_1700" }),
      });
      const data = (await resp.json()) as { success?: boolean; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ táº¡o nháº¯c viá»‡c.");
        return;
      }
      if (data.team) setTeam(data.team);
      setRemTitle("");
      setMsg("ÄÃ£ táº¡o lá»‹ch nháº¯c viá»‡c & bÃ¡o cÃ¡o Ä‘á»‹nh ká»³.");
    } finally {
      setBusy(false);
    }
  };

  const handleSweep = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/team/sweep", { method: "POST" });
      const data = (await resp.json()) as { success?: boolean; sweep?: { digestMarkdown: string }; team?: TeamState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "KhÃ´ng thá»ƒ quÃ©t nháº¯c viá»‡c.");
        return;
      }
      if (data.team) setTeam(data.team);
      if (data.sweep?.digestMarkdown) setDigestMd(data.sweep.digestMarkdown);
      setMsg("ÄÃ£ quÃ©t toÃ n bá»™ Ä‘áº§u viá»‡c quÃ¡ háº¡n / bá»‹ káº¹t & tá»•ng há»£p bÃ¡o cÃ¡o.");
    } finally {
      setBusy(false);
    }
  };

  const tasks = Object.values(team?.workItems ?? {});
  const workflows = Object.values(team?.workflows ?? {});
  const runs = Object.values(team?.dagRuns ?? {});
  const escalations = Object.values(team?.escalations ?? {}).sort((a) => (a.status === "open" ? -1 : 1));
  const openEscCount = escalations.filter((e) => e.status === "open").length;
  const reminders = Object.values(team?.reminders ?? {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "tasks", label: `Äá»™i ngÅ© & Báº£ng viá»‡c (${tasks.length})`, icon: Users },
          { id: "dag", label: `Quy trÃ¬nh DAG (${workflows.length})`, icon: GitBranch },
          { id: "escalations", label: `Cáº£nh bÃ¡o cáº§n xá»­ lÃ½${openEscCount > 0 ? ` (${openEscCount})` : ""}`, icon: AlertTriangle },
          { id: "reminders", label: `Nháº¯c viá»‡c & BÃ¡o cÃ¡o (${reminders.length})`, icon: BellRing },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as "tasks" | "dag" | "escalations" | "reminders")}
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

      {subTab === "tasks" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleCreateTask(e)} className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="font-medium text-ink">Giao viá»‡c cho Äá»™i ngÅ© AI (TrÆ°á»Ÿng nhÃ³m â†’ ThÃ nh viÃªn)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="TÃªn Ä‘áº§u viá»‡c..." className="sm:col-span-2 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} placeholder="AI Thá»±c hiá»‡n" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={taskZone} onChange={(e) => setTaskZone(e.target.value)} placeholder="Zone (VD: Zone 3)" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <input value={taskLead} onChange={(e) => setTaskLead(e.target.value)} placeholder="TrÆ°á»Ÿng nhÃ³m AI duyá»‡t bÃ i" className="w-60 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1 text-ink" />
              <button type="submit" disabled={busy || !taskTitle.trim()} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
                <Plus size={13} /> Giao viá»‡c
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {tasks.map((t) => {
              const badge = STATUS_STYLE[t.status];
              return (
                <div key={t.id} className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{t.title}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badge.cls)}>{badge.label} ({t.progressPct}%)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-tertiary">
                    <span>Zone: <strong>{t.zone}</strong> Â· Thá»±c hiá»‡n: {t.assignedBotName}{t.leadBotId ? ` Â· Duyá»‡t: ${t.leadBotId}` : ""}</span>
                    <div className="flex gap-1.5">
                      {t.status === "in_progress" && (
                        <button type="button" disabled={busy} onClick={() => void handleTaskAction(t.id, { status: "review_needed", progressPct: 95, deliverable: "HoÃ n táº¥t theo SOP" })} className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600">
                          Ná»™p duyá»‡t
                        </button>
                      )}
                      {t.status === "review_needed" && (
                        <>
                          <button type="button" disabled={busy} onClick={() => void handleTaskAction(t.id, { action: "approved", notes: "Äáº¡t chuáº©n" })} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600">
                            <CheckCircle2 size={12} /> Duyá»‡t
                          </button>
                          <button type="button" disabled={busy} onClick={() => void handleTaskAction(t.id, { action: "rejected", notes: "Cáº§n bá»• sung sá»‘ liá»‡u" })} className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-2 py-0.5 font-medium text-danger">
                            <XCircle size={12} /> LÃ m láº¡i
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === "dag" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleCreateDag(e)} className="flex flex-wrap gap-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <input value={dagName} onChange={(e) => setDagName(e.target.value)} placeholder="TÃªn gÃ³i quy trÃ¬nh DAG (VD: Chá»‘t Ä‘Æ¡n & Duyá»‡t Margin)..." className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <input value={dagZone} onChange={(e) => setDagZone(e.target.value)} placeholder="Zone" className="w-28 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <button type="submit" disabled={busy || !dagName.trim()} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
              <Plus size={13} /> ÄÃ³ng gÃ³i DAG
            </button>
          </form>

          <div className="space-y-2">
            {workflows.map((wf) => (
              <div key={wf.id} className="flex items-center justify-between rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                <div>
                  <div className="font-semibold text-ink">{wf.name} ({wf.scopeZone})</div>
                  <div className="text-[11px] text-ink-tertiary">{wf.steps.length} bÆ°á»›c Â· Max Hops: {wf.maxHops} Â· Budget Cap: ${wf.budgetCapUsd}</div>
                </div>
                <button type="button" disabled={busy} onClick={() => void handleRunDag({ workflowId: wf.id })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-600 hover:bg-emerald-500/25">
                  <Play size={12} /> Cháº¡y DAG
                </button>
              </div>
            ))}
          </div>

          {runs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-ink">Lá»‹ch sá»­ cháº¡y DAG (Checkpoints)</div>
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-hairline/40 bg-inset p-2.5 text-xs">
                  <span><strong>{r.workflowName}</strong> Â· Tráº¡ng thÃ¡i: <code>{r.status}</code> Â· Hops: {r.hopCount}</span>
                  {r.status === "waiting_approval" && (
                    <div className="flex gap-1.5">
                      <button type="button" disabled={busy} onClick={() => void handleRunDag({ runId: r.id, action: "approve" })} className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-600">Duyá»‡t cháº¡y tiáº¿p</button>
                      <button type="button" disabled={busy} onClick={() => void handleRunDag({ runId: r.id, action: "reject" })} className="rounded-md bg-danger/15 px-2 py-0.5 text-danger">Dá»«ng</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "escalations" && (
        <div className="space-y-2">
          {escalations.length === 0 ? (
            <p className="text-xs text-ink-secondary">KhÃ´ng cÃ³ cáº£nh bÃ¡o nÃ o cáº§n con ngÆ°á»i xá»­ lÃ½.</p>
          ) : (
            escalations.map((e) => (
              <div key={e.id} className="rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{e.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", e.status === "open" ? "bg-danger/15 text-danger" : "bg-raised text-ink-tertiary")}>{e.status}</span>
                </div>
                <ul className="mt-1 list-disc pl-4 text-ink-secondary">
                  {e.summaryLines.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
                {e.status === "open" && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void handleResolveEsc(e.id, "approved")} className="rounded-md bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-600">Duyá»‡t</button>
                    <button type="button" disabled={busy} onClick={() => void handleResolveEsc(e.id, "reassigned")} className="rounded-md bg-amber-500/15 px-2.5 py-1 font-medium text-amber-600">Giao láº¡i</button>
                    <button type="button" disabled={busy} onClick={() => void handleResolveEsc(e.id, "dismissed")} className="rounded-md bg-raised px-2.5 py-1 text-ink-secondary">ÄÃ³ng</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {subTab === "reminders" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleCreateReminder(e)} className="flex flex-wrap gap-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <input value={remTitle} onChange={(e) => setRemTitle(e.target.value)} placeholder="Ná»™i dung nháº¯c viá»‡c / bÃ¡o cÃ¡o Ä‘á»‹nh ká»³..." className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <input value={remZone} onChange={(e) => setRemZone(e.target.value)} placeholder="Zone" className="w-24 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <button type="submit" disabled={busy || !remTitle.trim()} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">Táº¡o lá»‹ch</button>
            <button type="button" disabled={busy} onClick={() => void handleSweep()} className="inline-flex items-center gap-1 rounded-lg bg-raised px-3 py-1.5 font-medium text-ink hover:bg-control">
              <RefreshCw size={12} /> QuÃ©t & Tá»•ng há»£p
            </button>
          </form>
          {digestMd && (
            <pre className="whitespace-pre-wrap rounded-xl border border-hairline/40 bg-inset p-3 font-mono text-[11px] text-ink-secondary">{digestMd}</pre>
          )}
          <div className="space-y-1.5">
            {reminders.map((r) => (
              <div key={r.id} className="rounded-lg border border-hairline/40 bg-card px-3 py-2 text-xs text-ink-secondary">
                <strong className="text-ink">{r.title}</strong> Â· Lá»‹ch: <code>{r.schedule}</code> Â· Zone: {r.targetZone}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
