import { EnterpriseBrainPanel } from "./EnterpriseBrainPanel";
import { EnterpriseTeamPanel } from "./EnterpriseTeamPanel";
import { EnterpriseOmnichannelPanel } from "./EnterpriseOmnichannelPanel";
import { EnterpriseCeoConsolePanel } from "./EnterpriseCeoConsolePanel";
import { EnterpriseGovernancePanel } from "./EnterpriseGovernancePanel";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Download,
  FileSpreadsheet,
  Mic,
  RefreshCw,
  ShieldCheck,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";

interface TocBottleneck {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  impactValueVnd: number;
  description: string;
  suggestedAction: string;
}

interface DailyPulse {
  workspaceId: string;
  date: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  netMarginPercent: number;
  transactionCount: number;
  healthStatus: "healthy" | "attention_needed" | "critical_risk";
  bottlenecks: TocBottleneck[];
  formattedWidget: {
    revenueDisplay: string;
    profitDisplay: string;
    marginDisplay: string;
    bottleneckCount: number;
    headline: string;
  };
}

interface RoiResult {
  paybackPeriodDays: number;
  achieves90DayPayback: boolean;
  financialHealthTier: string;
  isCashflowNegative: boolean;
  dailyMetrics: {
    netCashflowBenefitVnd: number;
  };
  ninetyDayProjection: {
    netProfitAfterPaybackVnd: number;
    roiPercent: number;
  };
  recommendations: string[];
}

interface BudgetStatus {
  workspaceId: string;
  monthlyCapUsd: number;
  currentSpendUsd: number;
  arbitrageEnabled: boolean;
}

type ActiveTab = "pulse" | "roi" | "evals" | "tables" | "governance" | "brain" | "team" | "omnichannel" | "ceo";

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AgenticOsPanel({ botId, botName }: { botId?: string; botName?: string }) {
  const [pulse, setPulse] = useState<DailyPulse | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ActiveTab>("pulse");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Record Tx state
  const [txOrder, setTxOrder] = useState("ORD-NEW-01");
  const [txCustomer, setTxCustomer] = useState("Khách hàng mới");
  const [txRevenue, setTxRevenue] = useState(50000000);
  const [txCost, setTxCost] = useState(35000000);

  // ROI Calculator state
  const [roiInvestment, setRoiInvestment] = useState(50000000);
  const [roiOpex, setRoiOpex] = useState(2000000);
  const [roiHours, setRoiHours] = useState(4);
  const [roiIncRev, setRoiIncRev] = useState(30000000);
  const [roiResult, setRoiResult] = useState<RoiResult | null>(null);

  // Evals / Voice / Consent state
  const [evalSummary, setEvalSummary] = useState<string | null>(null);
  const [voiceInput, setVoiceInput] = useState("Doanh thu hợp đồng đạt 120 triệu, chi phí triển khai 84 triệu");
  const [voiceOutput, setVoiceOutput] = useState<string | null>(null);
  const [consentInfo, setConsentInfo] = useState<string | null>(null);

  // Budget & Virtual Table state
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [tableMarkdown, setTableMarkdown] = useState<string | null>(null);

  // 17:00 Scheduler & Zalo Alert state
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [zaloToId, setZaloToId] = useState("");

  const loadPulse = useCallback(async () => {
    try {
      const resp = await fetch("/api/pulse/today?workspaceId=default");
      if (!resp.ok) return;
      const data = (await resp.json()) as { success?: boolean; pulse?: DailyPulse };
      if (data.success && data.pulse) {
        setPulse(data.pulse);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const loadBudget = useCallback(async () => {
    try {
      const resp = await fetch("/api/budget/status?workspaceId=default");
      if (!resp.ok) return;
      const data = (await resp.json()) as { success?: boolean; budget?: BudgetStatus };
      if (data.success && data.budget) {
        setBudget(data.budget);
      }
    } catch {
      // Ignore transient errors
    }
  }, []);

  useEffect(() => {
    void loadPulse();
    const timer = setInterval(() => {
      void loadPulse();
    }, 60_000);
    return () => clearInterval(timer);
  }, [loadPulse]);

  useEffect(() => {
    if (open && tab === "tables") {
      void loadBudget();
    }
    if (open && tab === "pulse") {
      void fetch("/api/pulse/scheduler/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { success?: boolean; config?: { enabled?: boolean; zaloToId?: string } } | null) => {
          if (d?.success && d.config) {
            if (typeof d.config.enabled === "boolean") setSchedEnabled(d.config.enabled);
            if (typeof d.config.zaloToId === "string") setZaloToId(d.config.zaloToId);
          }
        })
        .catch(() => {});
    }
  }, [open, tab, loadBudget]);

  const handleExportCsv = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/export/pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "default" }),
      });
      const data = (await resp.json()) as { success?: boolean; csv?: string };
      if (data.success && data.csv) {
        triggerDownload(`pnl-report-${new Date().toISOString().slice(0, 10)}.csv`, "\uFEFF" + data.csv, "text/csv;charset=utf-8");
        setStatusMsg("Đã tải xuống báo cáo tài chính P&L (.csv)");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportAuditBundle = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/export/audit-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "default" }),
      });
      const data = (await resp.json()) as { success?: boolean; bundle?: { bundleId?: string } };
      if (data.success && data.bundle) {
        triggerDownload(
          `${data.bundle.bundleId || "merkle-audit-bundle"}.json`,
          JSON.stringify(data.bundle, null, 2),
          "application/json"
        );
        setStatusMsg("Đã xuất Hồ Sơ Kiểm Toán Merkle (.json)");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRecordTx = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/pulse/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "default",
          orderCode: txOrder,
          customerName: txCustomer,
          revenue: Number(txRevenue) || 0,
          cost: Number(txCost) || 0,
          status: "approved",
        }),
      });
      const data = (await resp.json()) as { success?: boolean; currentPulse?: DailyPulse };
      if (data.success && data.currentPulse) {
        setPulse(data.currentPulse);
        setStatusMsg(`Đã ghi nhận đơn ${txOrder} vào Nhịp thở hôm nay.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveScheduler = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const resp = await fetch("/api/pulse/scheduler/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: schedEnabled, zaloToId }),
      });
      const data = (await resp.json()) as { success?: boolean; error?: string };
      if (!resp.ok || !data.success) {
        setErrorMsg(data.error || "Không thể lưu cấu hình lịch 17:00 (cần quyền Admin).");
        return;
      }
      setStatusMsg("Đã lưu cấu hình Lịch tự hành 17:00 & Cảnh báo Zalo.");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Lỗi kết nối máy chủ.");
    } finally {
      setBusy(false);
    }
  };

  const handleTrigger17Pm = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/pulse/trigger-17pm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "default" }),
      });
      const data = (await resp.json()) as { success?: boolean; snapshot?: DailyPulse };
      if (data.success && data.snapshot) {
        setPulse(data.snapshot);
        setStatusMsg("Đã chốt sổ Snapshot 17:00 chiều lên đĩa an toàn.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCalcRoi = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/roi/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalInvestmentVnd: Number(roiInvestment),
          monthlyAIOpexVnd: Number(roiOpex),
          hoursSavedPerDay: Number(roiHours),
          hourlyLaborCostVnd: 65000,
          incrementalMonthlyRevenueVnd: Number(roiIncRev),
          averageGrossMarginPercent: 25,
          leakagePreventionMonthlyVnd: 6000000,
        }),
      });
      const data = (await resp.json()) as { success?: boolean; result?: RoiResult };
      if (data.success && data.result) {
        setRoiResult(data.result);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunEvalAndPromote = async () => {
    setBusy(true);
    try {
      const id = botId || "default-bot";
      const name = botName || "Trợ lý AI";
      const interactions = [
        {
          userPrompt: "Báo giá 50 sản phẩm SP-88 giúp anh",
          botResponse: "Dạ tổng doanh thu 42.500.000 đ, giá vốn 31.800.000 đ, tỷ suất lãi 25.2%.",
          toolsCalled: ["lookup_pricing", "create_draft_quote"],
          calculatedValues: { revenue: 42.5, cost: 31.8, margin: 25.2 },
        },
      ];
      const evalResp = await fetch("/api/bots/evals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: id, botName: name, interactions }),
      });
      const evalData = (await evalResp.json()) as {
        success?: boolean;
        evalResult?: { totalScore: number; passed: boolean };
      };
      const promoResp = await fetch("/api/bots/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: id, botName: name, workspaceId: "default", interactions }),
      });
      const promoData = (await promoResp.json()) as {
        success?: boolean;
        promoted?: boolean;
        error?: string;
        record?: { status: string };
      };
      if (!promoResp.ok) {
        setErrorMsg(promoData.error || "Không thể cấp quyền bot (cần quyền Admin).");
      }
      if (evalData.evalResult) {
        setEvalSummary(
          `Điểm sát hạch: ${evalData.evalResult.totalScore}/21 | Trạng thái Promotion Gate: ${promoData.record?.status || (promoData.promoted ? "promoted" : "quarantined")}`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVoicePnl = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/voice/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "default",
          transcript: voiceInput,
          sessionId: `ui_voice_${Date.now()}`,
        }),
      });
      const data = (await resp.json()) as {
        success?: boolean;
        handoffDurationMs?: number;
        financialIntent?: { revenue?: number; cost?: number; marginPercent?: number; intent?: string };
      };
      if (data.success && data.financialIntent) {
        const f = data.financialIntent;
        setVoiceOutput(
          `Xử lý ${data.handoffDurationMs}ms │ Doanh thu: ${(f.revenue || 0).toLocaleString("vi-VN")} đ │ Chi phí: ${(f.cost || 0).toLocaleString("vi-VN")} đ │ Margin: ${f.marginPercent || 0}%`
        );
        void loadPulse();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignMerkleConsent = async () => {
    setBusy(true);
    try {
      const diffResp = await fetch("/api/artifacts/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Chính sách báo giá chuẩn",
          originalText: "Chiết khấu tối đa: 10%",
          modifiedText: "Chiết khấu tối đa: 15% (Margin Guard >= 15%)",
        }),
      });
      const diffData = (await diffResp.json()) as { diff?: { diffId: string } };
      const diffId = diffData.diff?.diffId || `diff_${Date.now()}`;
      const signResp = await fetch("/api/artifacts/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffId,
          title: "Chính sách báo giá chuẩn",
          approverId: "owner",
          approverRole: "Director",
          status: "signed",
        }),
      });
      const signData = (await signResp.json()) as { record?: { consentHash: string }; error?: string };
      if (!signResp.ok) {
        setErrorMsg(signData.error || "Chỉ Quản trị viên / Giám đốc mới có quyền ký duyệt Merkle.");
        return;
      }
      const chainResp = await fetch("/api/artifacts/consent/chain");
      const chainData = (await chainResp.json()) as { valid?: boolean; length?: number };
      setConsentInfo(
        `Chữ ký Merkle: ${signData.record?.consentHash?.slice(0, 16)}... │ Chuỗi hợp lệ: ${chainData.valid ? "CÓ" : "KHÔNG"} (${chainData.length || 0} chữ ký)`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDemoVirtualTable = async () => {
    setBusy(true);
    try {
      const resp = await fetch("/api/tables/virtual/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: "default",
          name: "Bảng tính Margin Tức Thì",
          columns: [
            { id: "c1", name: "Sản phẩm", type: "text" },
            { id: "c2", name: "revenue", type: "number" },
            { id: "c3", name: "cost", type: "number" },
            { id: "c4", name: "margin", type: "formula", formula: "MARGIN(revenue, cost)" },
          ],
          rows: [
            { c1: "Gói Doanh Nghiệp RAI²", revenue: 120000000, cost: 84000000 },
            { c1: "Gói Tự Động Hóa POS", revenue: 65000000, cost: 42000000 },
          ],
        }),
      });
      const data = (await resp.json()) as { success?: boolean; markdown?: string };
      if (data.success && data.markdown) {
        setTableMarkdown(data.markdown);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mx-3 sm:mx-5 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline/50 bg-card/95 px-3 py-1.5 text-[12px] text-ink-secondary shadow-xs">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-ink"
          title="Mở Bảng điều khiển AgenticOS (Nhịp thở 17:00, TOC, ROI 90 ngày, Sát hạch Bot)"
        >
          <Activity size={14} className="shrink-0 text-accent" />
          <span className="truncate font-medium">
            {pulse?.formattedWidget?.headline || "Đang tải Nhịp thở kinh doanh 17:00..."}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExportCsv()}
            className="flex items-center gap-1 rounded-md border border-hairline/40 bg-raised/70 px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-raised"
            title="Xuất báo cáo tài chính P&L dạng CSV chuẩn kế toán"
          >
            <Download size={12} />
            <span>Xuất P&amp;L</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/25"
          >
            <ShieldCheck size={12} />
            <span>AgenticOS</span>
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trung tâm Điều hành AgenticOS"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline/70 bg-card text-ink shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-hairline/60 bg-card px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <Activity size={18} className="shrink-0 text-accent" />
                <h2 className="truncate text-sm sm:text-base font-semibold text-ink">Trung tâm Điều hành AgenticOS · rai2.si</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="ui-icon-button shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-hairline/60 bg-raised/60 px-3.5 py-2 sm:px-5 text-xs font-medium">
              {(
                [
                  { id: "pulse", label: "Nhịp thở 17:00 & TOC", icon: Activity },
                  { id: "roi", label: "Hoàn vốn 90 ngày", icon: TrendingUp },
                  { id: "evals", label: "Sát hạch & Chữ ký", icon: ShieldCheck },
                  { id: "tables", label: "Bảng tính & Ngân sách", icon: Table2 },
                  { id: "governance", label: "Quản trị & Bảo mật", icon: ShieldCheck },
                  { id: "brain", label: "Bộ não & Tri thức", icon: Activity },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    setStatusMsg(null);
                    setErrorMsg(null);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
                    tab === id ? "bg-accent text-white" : "text-ink-secondary hover:bg-raised hover:text-ink"
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-card p-3.5 sm:p-5 text-sm">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
              {statusMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
                  <CheckCircle2 size={14} />
                  <span>{statusMsg}</span>
                </div>
              )}

              {tab === "pulse" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    <div className="rounded-xl border border-hairline bg-raised/60 p-3">
                      <div className="text-xs text-ink-secondary">Doanh thu hôm nay</div>
                      <div className="mt-1 text-lg font-bold">{pulse?.formattedWidget.revenueDisplay ?? "0 đ"}</div>
                    </div>
                    <div className="rounded-xl border border-hairline bg-raised/60 p-3">
                      <div className="text-xs text-ink-secondary">Lãi / Lỗ ròng</div>
                      <div className="mt-1 text-lg font-bold">{pulse?.formattedWidget.profitDisplay ?? "0 đ"}</div>
                    </div>
                    <div className="rounded-xl border border-hairline bg-raised/60 p-3">
                      <div className="text-xs text-ink-secondary">Biên lợi nhuận</div>
                      <div className="mt-1 text-lg font-bold">{pulse?.formattedWidget.marginDisplay ?? "0.0%"}</div>
                    </div>
                    <div className="rounded-xl border border-hairline bg-raised/60 p-3">
                      <div className="text-xs text-ink-secondary">Điểm nghẽn TOC</div>
                      <div className="mt-1 text-lg font-bold">{pulse?.bottlenecks.length ?? 0}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleTrigger17Pm()}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      <CheckCircle2 size={14} />
                      <span>Chốt sổ Snapshot 17:00</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleExportCsv()}
                      className="flex items-center gap-1.5 rounded-lg border border-hairline bg-raised px-3 py-1.5 text-xs font-medium hover:bg-raised/60"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Xuất P&amp;L (.csv)</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleExportAuditBundle()}
                      className="flex items-center gap-1.5 rounded-lg border border-hairline bg-raised px-3 py-1.5 text-xs font-medium hover:bg-raised/60"
                    >
                      <Download size={14} />
                      <span>Tải Hồ sơ Kiểm toán Merkle</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadPulse()}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-hairline/70 bg-raised/70 px-3 py-1.5 text-xs font-medium text-ink hover:bg-raised"
                    >
                      <RefreshCw size={13} />
                      <span>Làm mới</span>
                    </button>
                  </div>

                  {pulse && pulse.bottlenecks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                        Cảnh báo Điểm nghẽn TOC cần xử lý
                      </div>
                      {pulse.bottlenecks.map((b) => (
                        <div key={b.id} className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-warning">
                            <AlertTriangle size={14} />
                            <span>{b.title}</span>
                          </div>
                          <div className="mt-1 text-ink-secondary">{b.description}</div>
                          <div className="mt-1 font-medium text-ink">Khuyến nghị: {b.suggestedAction}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5">
                    <div className="mb-2 text-xs font-semibold">Ghi nhận nhanh giao dịch trong ngày</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <input
                        value={txOrder}
                        onChange={(e) => setTxOrder(e.target.value)}
                        placeholder="Mã đơn"
                        className="rounded-lg border border-hairline bg-card text-ink px-2.5 py-1.5 text-xs"
                      />
                      <input
                        value={txCustomer}
                        onChange={(e) => setTxCustomer(e.target.value)}
                        placeholder="Khách hàng"
                        className="rounded-lg border border-hairline bg-card text-ink px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        value={txRevenue}
                        onChange={(e) => setTxRevenue(Number(e.target.value))}
                        placeholder="Doanh thu"
                        className="rounded-lg border border-hairline bg-card text-ink px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        value={txCost}
                        onChange={(e) => setTxCost(Number(e.target.value))}
                        placeholder="Giá vốn"
                        className="rounded-lg border border-hairline bg-card text-ink px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRecordTx()}
                      className="mt-2.5 w-full sm:w-auto rounded-lg bg-raised px-3 py-2 sm:py-1.5 text-xs font-medium text-ink border border-hairline/70 hover:bg-control"
                    >
                      + Ghi nhận vào Sổ Nhịp thở
                    </button>
                  </div>

                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">Lịch Tự Hành 17:00 (UTC+7) &amp; Đẩy Báo Cáo Zalo</span>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={schedEnabled}
                          onChange={(e) => setSchedEnabled(e.target.checked)}
                        />
                        <span>Bật tự động</span>
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={zaloToId}
                        onChange={(e) => setZaloToId(e.target.value)}
                        placeholder="Zalo UID nhận báo cáo 17:00 (tuỳ chọn)"
                        className="flex-1 rounded-lg border border-hairline/70 bg-card px-2.5 py-2 sm:py-1.5 text-xs text-ink"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveScheduler()}
                        className="rounded-lg border border-hairline/70 bg-raised px-3 py-2 sm:py-1.5 text-xs font-medium text-ink hover:bg-control"
                      >
                        Lưu lịch 17:00
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "roi" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-ink-secondary">Tổng đầu tư ban đầu (VND)</span>
                      <input
                        type="number"
                        value={roiInvestment}
                        onChange={(e) => setRoiInvestment(Number(e.target.value))}
                        className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-1.5"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-ink-secondary">Chi phí vận hành AI/tháng (VND)</span>
                      <input
                        type="number"
                        value={roiOpex}
                        onChange={(e) => setRoiOpex(Number(e.target.value))}
                        className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-1.5"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-ink-secondary">Số giờ tiết kiệm/ngày</span>
                      <input
                        type="number"
                        value={roiHours}
                        onChange={(e) => setRoiHours(Number(e.target.value))}
                        className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-1.5"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-ink-secondary">Doanh thu tăng thêm/tháng (VND)</span>
                      <input
                        type="number"
                        value={roiIncRev}
                        onChange={(e) => setRoiIncRev(Number(e.target.value))}
                        className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-1.5"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCalcRoi()}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
                  >
                    <DollarSign size={14} />
                    <span>Tính Thời Gian Hoàn Vốn 90 Ngày</span>
                  </button>
                  {roiResult && (
                    <div className="space-y-2 rounded-xl border border-hairline bg-raised/60 p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          Thời gian hoàn vốn: {roiResult.isCashflowNegative ? "Không thể hoàn vốn (Âm dòng tiền)" : `${roiResult.paybackPeriodDays} ngày`}
                        </span>
                        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-medium text-accent">
                          {roiResult.achieves90DayPayback ? "Đạt chuẩn <= 90 ngày" : "Vượt ngưỡng / Rủi ro"}
                        </span>
                      </div>
                      <div>Lợi ích dòng tiền thuần mỗi ngày: {roiResult.dailyMetrics.netCashflowBenefitVnd.toLocaleString("vi-VN")} đ/ngày</div>
                      <div>Lợi nhuận ròng sau 90 ngày: {roiResult.ninetyDayProjection.netProfitAfterPaybackVnd.toLocaleString("vi-VN")} đ ({roiResult.ninetyDayProjection.roiPercent}% ROI)</div>
                      <ul className="list-disc space-y-1 pl-4 text-ink-secondary">
                        {roiResult.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === "evals" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5 space-y-2">
                    <div className="text-xs font-semibold">1. Cổng Sát Hạch Bot 21 Tiêu Chí (Promotion Gate)</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRunEvalAndPromote()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Chạy Sát Hạch &amp; Cấp Quyền Tiếp Khách
                    </button>
                    {evalSummary && <div className="text-xs text-success font-medium">{evalSummary}</div>}
                  </div>

                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Mic size={14} />
                      <span>2. Voice-Text P&amp;L Hand-off (&lt; 15ms)</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={voiceInput}
                        onChange={(e) => setVoiceInput(e.target.value)}
                        className="flex-1 rounded-lg border border-hairline/70 bg-card px-3 py-2 sm:py-1.5 text-xs text-ink"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleVoicePnl()}
                        className="rounded-lg border border-hairline/70 bg-raised px-3 py-2 sm:py-1.5 text-xs font-medium text-ink hover:bg-control"
                      >
                        Bóc P&amp;L &amp; Nạp Sổ
                      </button>
                    </div>
                    {voiceOutput && <div className="text-xs text-ink">{voiceOutput}</div>}
                  </div>

                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5 space-y-2">
                    <div className="text-xs font-semibold">3. Artifact Diff &amp; Ký Duyệt Chuỗi Băm Merkle</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSignMerkleConsent()}
                      className="rounded-lg border border-hairline bg-raised px-3 py-1.5 text-xs font-medium"
                    >
                      So sánh Diff &amp; Ký Duyệt Giám Đốc
                    </button>
                    {consentInfo && <div className="text-xs text-success font-medium">{consentInfo}</div>}
                  </div>
                </div>
              )}

              {tab === "governance" && <EnterpriseGovernancePanel />}
              {tab === "brain" && <EnterpriseBrainPanel />}
              {tab === "team" && <EnterpriseTeamPanel />}
              {tab === "omnichannel" && <EnterpriseOmnichannelPanel />}
              {tab === "ceo" && <EnterpriseCeoConsolePanel />}

              {tab === "tables" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5 space-y-2">
                    <div className="text-xs font-semibold">Ngân sách Token &amp; Token Arbitrage (Budget Guard)</div>
                    {budget ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                        <div>Trần tháng: ${budget.monthlyCapUsd.toFixed(2)}</div>
                        <div>Đã dùng: ${budget.currentSpendUsd.toFixed(4)}</div>
                        <div>Arbitrage: {budget.arbitrageEnabled ? "Đang bật" : "Tắt"}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-ink-secondary">Đang tải trạng thái ngân sách...</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-hairline bg-raised/60 p-3.5 space-y-2">
                    <div className="text-xs font-semibold">Bảng tính phản ứng Virtual Tables &amp; DuckDB Sandbox</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDemoVirtualTable()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Tạo &amp; Tính Bảng Giá Margin Tức Thì
                    </button>
                    {tableMarkdown && (
                      <pre className="overflow-x-auto rounded-lg border border-hairline bg-card text-ink p-3 text-xs">{tableMarkdown}</pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
