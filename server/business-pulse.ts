/**
 * Phân hệ 39, 50, 56: Business Pulse & TOC Bottlenecks Engine (Nhịp thở kinh doanh 17:00)
 * Tổng kết doanh thu, giá vốn, lãi ròng và phát hiện điểm nghẽn vận hành theo TOC.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface TransactionRecord {
  id: string;
  workspaceId: string;
  orderCode: string;
  revenue: number;
  cost: number;
  customerName?: string;
  timestamp: string; // ISO string
  status: "pending_approval" | "approved" | "delivering" | "completed" | "delayed";
  createdHoursAgo?: number;
}

export interface TocBottleneck {
  id: string;
  type: "unapproved_quote" | "margin_leakage" | "delayed_fulfillment" | "capacity_strain";
  severity: "critical" | "warning" | "info";
  title: string;
  impactValueVnd: number;
  description: string;
  suggestedAction: string;
  orderCode?: string;
}

export interface DailyPulseSummary {
  workspaceId: string;
  date: string; // YYYY-MM-DD
  pulseAt: string; // ISO string
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  netMarginPercent: number;
  transactionCount: number;
  bottlenecks: TocBottleneck[];
  healthStatus: "healthy" | "attention_needed" | "critical_risk";
  formattedWidget: {
    revenueDisplay: string;
    profitDisplay: string;
    marginDisplay: string;
    bottleneckCount: number;
    headline: string;
  };
}

export class BusinessPulseEngine {
  private transactions: Map<string, TransactionRecord[]> = new Map();
  private storagePath: string;

  constructor(customStoragePath?: string) {
    this.storagePath = customStoragePath || (
      process.platform === "win32"
        ? path.join(process.env.LOCALAPPDATA || "C:\\temp", "openmausbot", "business-pulse-state.json")
        : "/var/lib/openmausbot/business-pulse-state.json"
    );
    this.loadState();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          for (const [ws, list] of Object.entries(parsed)) {
            if (Array.isArray(list)) {
              this.transactions.set(ws, list);
            }
          }
        }
      }
    } catch {
      // Sử dụng in-memory fallback nếu không đọc được tệp
    }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj: Record<string, TransactionRecord[]> = {};
      for (const [ws, list] of this.transactions.entries()) {
        obj[ws] = list;
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(obj, null, 2), "utf-8");
    } catch {
      // In-memory fallback
    }
  }

  public recordTransaction(record: Omit<TransactionRecord, "id" | "timestamp"> & { id?: string; timestamp?: string }): TransactionRecord {
    const ws = record.workspaceId || "default";
    const newTx: TransactionRecord = {
      id: record.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: ws,
      orderCode: record.orderCode || `ORD-${Date.now().toString().slice(-4)}`,
      revenue: Math.max(0, record.revenue || 0),
      cost: Math.max(0, record.cost || 0),
      customerName: record.customerName || "Khách hàng vãng lai",
      timestamp: record.timestamp || new Date().toISOString(),
      status: record.status || "approved",
      createdHoursAgo: record.createdHoursAgo,
    };

    const list = this.transactions.get(ws) || [];
    list.push(newTx);
    this.transactions.set(ws, list);
    this.saveState();
    return newTx;
  }

  public detectBottlenecks(workspaceId = "default", targetDate?: string): TocBottleneck[] {
    const list = this.transactions.get(workspaceId) || [];
    const bottlenecks: TocBottleneck[] = [];

    // Lọc theo ngày nếu có
    const filtered = targetDate
      ? list.filter(t => t.timestamp.startsWith(targetDate))
      : list;

    for (const tx of filtered) {
      // 1. Điểm nghẽn: Báo giá chờ duyệt > 2h
      if (tx.status === "pending_approval" && (tx.createdHoursAgo && tx.createdHoursAgo >= 2)) {
        bottlenecks.push({
          id: `bn_quote_${tx.id}`,
          type: "unapproved_quote",
          severity: "critical",
          title: `Báo giá ${tx.orderCode} chờ duyệt quá 2 giờ`,
          impactValueVnd: tx.revenue,
          description: `Đơn hàng giá trị ${tx.revenue.toLocaleString("vi-VN")} đ của ${tx.customerName} đang bị nghẽn ở khâu phê duyệt giá.`,
          suggestedAction: `Kích hoạt phê duyệt 1-chạm hoặc liên hệ Giám đốc kinh doanh.`,
          orderCode: tx.orderCode,
        });
      }

      // 2. Điểm nghẽn: Biên lợi nhuận quá thấp (< 15%) gây xói mòn dòng tiền
      if (tx.revenue > 0) {
        const margin = ((tx.revenue - tx.cost) / tx.revenue) * 100;
        if (margin < 15 && tx.status !== "pending_approval") {
          bottlenecks.push({
            id: `bn_margin_${tx.id}`,
            type: "margin_leakage",
            severity: "warning",
            title: `Đơn ${tx.orderCode} biên lợi nhuận thấp (${margin.toFixed(1)}%)`,
            impactValueVnd: tx.cost - (tx.revenue * 0.85),
            description: `Tỷ suất lợi nhuận đạt ${margin.toFixed(1)}%, dưới ngưỡng chuẩn mực 15% của doanh nghiệp.`,
            suggestedAction: `Xem lại chính sách chiết khấu đại lý hoặc giảm chi phí bốc xếp.`,
            orderCode: tx.orderCode,
          });
        }
      }

      // 3. Điểm nghẽn: Chậm giao hàng (delayed)
      if (tx.status === "delayed") {
        bottlenecks.push({
          id: `bn_delay_${tx.id}`,
          type: "delayed_fulfillment",
          severity: "critical",
          title: `Đơn ${tx.orderCode} giao trễ cho ${tx.customerName}`,
          impactValueVnd: tx.revenue,
          description: `Đơn hàng bị trễ lịch vận chuyển, nguy cơ mất khách hàng và phạt hợp đồng.`,
          suggestedAction: `Điều phối kho dự phòng hoặc liên hệ đơn vị chuyển phát hỏa tốc.`,
          orderCode: tx.orderCode,
        });
      }
    }

    return bottlenecks;
  }

  public getDailyPulse(workspaceId = "default", dateString?: string): DailyPulseSummary {
    const todayStr = dateString || new Date().toISOString().slice(0, 10);
    const list = this.transactions.get(workspaceId) || [];
    const dailyTx = list.filter(t => t.timestamp.startsWith(todayStr));

    let totalRevenue = 0;
    let totalCost = 0;

    for (const tx of dailyTx) {
      totalRevenue += tx.revenue;
      totalCost += tx.cost;
    }

    const grossProfit = totalRevenue - totalCost;
    const netMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const bottlenecks = this.detectBottlenecks(workspaceId, todayStr);

    let healthStatus: "healthy" | "attention_needed" | "critical_risk" = "healthy";
    if (bottlenecks.some(b => b.severity === "critical")) {
      healthStatus = "critical_risk";
    } else if (bottlenecks.length > 0 || netMarginPercent < 20) {
      healthStatus = "attention_needed";
    }

    const formatVndShort = (val: number): string => {
      if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} tỷ`;
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} tr`;
      return `${val.toLocaleString("vi-VN")} đ`;
    };

    return {
      workspaceId,
      date: todayStr,
      pulseAt: new Date().toISOString(),
      totalRevenue,
      totalCost,
      grossProfit,
      netMarginPercent: Number(netMarginPercent.toFixed(1)),
      transactionCount: dailyTx.length,
      bottlenecks,
      healthStatus,
      formattedWidget: {
        revenueDisplay: formatVndShort(totalRevenue),
        profitDisplay: formatVndShort(grossProfit),
        marginDisplay: `${netMarginPercent.toFixed(1)}%`,
        bottleneckCount: bottlenecks.length,
        headline: bottlenecks.length === 0
          ? `🟢 Doanh thu: ${formatVndShort(totalRevenue)} │ 🟢 Lãi ròng: ${formatVndShort(grossProfit)} │ ✅ 0 Điểm nghẽn`
          : `🟢 Doanh thu: ${formatVndShort(totalRevenue)} │ 🟢 Lãi ròng: ${formatVndShort(grossProfit)} │ 🟡 ${bottlenecks.length} Điểm nghẽn`,
      },
    };
  }

  public clearWorkspaceData(workspaceId = "default"): void {
    this.transactions.delete(workspaceId);
    this.saveState();
  }
}

let pulseEngineInstance: BusinessPulseEngine | null = null;
export function getBusinessPulseEngine(storagePath?: string): BusinessPulseEngine {
  if (!pulseEngineInstance || storagePath) {
    pulseEngineInstance = new BusinessPulseEngine(storagePath);
  }
  return pulseEngineInstance;
}
