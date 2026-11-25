/**
 * Phân hệ 26: Exporting Engine (Xuất báo cáo tài chính P&L & Sổ cái đối soát kế toán)
 * Hỗ trợ xuất định dạng bảng biểu CSV/Excel và gói hồ sơ kiểm toán Merkle Audit Bundle.
 */

import * as crypto from "node:crypto";
import type { DailyPulseSummary, TransactionRecord } from "./business-pulse.ts";

export interface PnlExportOptions {
  workspaceId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeHeaders?: boolean;
}

export interface AuditBundleFile {
  filename: string;
  content: string;
  sizeBytes: number;
  sha256: string;
}

export interface AuditBundleResult {
  bundleId: string;
  workspaceId: string;
  exportedAt: string;
  merkleRootHash: string;
  files: AuditBundleFile[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    transactionCount: number;
  };
}

export class ExportingEngine {
  public generatePnlCsv(transactions: TransactionRecord[], options?: PnlExportOptions): string {
    const includeHeaders = options?.includeHeaders !== false;
    const lines: string[] = [];

    if (includeHeaders) {
      lines.push("STT,Mã đơn hàng,Khách hàng,Thời gian,Doanh thu (VND),Giá vốn (VND),Lợi nhuận (VND),Tỷ suất margin (%),Trạng thái");
    }

    transactions.forEach((tx, idx) => {
      const profit = tx.revenue - tx.cost;
      const margin = tx.revenue > 0 ? ((profit / tx.revenue) * 100).toFixed(1) : "0.0";
      const cleanCustomer = (tx.customerName || "").replace(/"/g, '""');
      lines.push(
        `${idx + 1},"${tx.orderCode}","${cleanCustomer}","${tx.timestamp}",${tx.revenue},${tx.cost},${profit},${margin}%,"${tx.status}"`
      );
    });

    return lines.join("\n");
  }

  public createAuditBundle(
    workspaceId: string,
    transactions: TransactionRecord[],
    pulse: DailyPulseSummary,
    consents: Array<{ consentId: string; consentHash: string; title: string; approverId: string; timestamp: string }> = []
  ): AuditBundleResult {
    const bundleId = `bundle_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const exportedAt = new Date().toISOString();

    // 1. File P&L CSV
    const pnlCsvContent = this.generatePnlCsv(transactions);
    const pnlCsvSha = crypto.createHash("sha256").update(pnlCsvContent, "utf-8").digest("hex");

    // 2. File Business Pulse JSON
    const pulseJsonContent = JSON.stringify(pulse, null, 2);
    const pulseJsonSha = crypto.createHash("sha256").update(pulseJsonContent, "utf-8").digest("hex");

    // 3. File Merkle Consents Ledger
    const consentsJsonContent = JSON.stringify({
      workspaceId,
      exportedAt,
      consentCount: consents.length,
      consents,
    }, null, 2);
    const consentsJsonSha = crypto.createHash("sha256").update(consentsJsonContent, "utf-8").digest("hex");

    // 4. File Manifest
    const files: AuditBundleFile[] = [
      {
        filename: "pnl_financial_report.csv",
        content: pnlCsvContent,
        sizeBytes: Buffer.byteLength(pnlCsvContent, "utf-8"),
        sha256: pnlCsvSha,
      },
      {
        filename: "daily_business_pulse.json",
        content: pulseJsonContent,
        sizeBytes: Buffer.byteLength(pulseJsonContent, "utf-8"),
        sha256: pulseJsonSha,
      },
      {
        filename: "merkle_consents_ledger.json",
        content: consentsJsonContent,
        sizeBytes: Buffer.byteLength(consentsJsonContent, "utf-8"),
        sha256: consentsJsonSha,
      },
    ];

    // Tính Merkle Root Hash đại diện cho toàn bộ gói
    const concatenatedHashes = files.map(f => f.sha256).sort().join(":");
    const merkleRootHash = crypto.createHash("sha256").update(concatenatedHashes, "utf-8").digest("hex");

    let totalRevenue = 0;
    let totalCost = 0;
    for (const tx of transactions) {
      totalRevenue += tx.revenue;
      totalCost += tx.cost;
    }

    return {
      bundleId,
      workspaceId,
      exportedAt,
      merkleRootHash,
      files,
      summary: {
        totalRevenue,
        totalCost,
        grossProfit: totalRevenue - totalCost,
        transactionCount: transactions.length,
      },
    };
  }

  public verifyAuditBundle(bundle: AuditBundleResult): { valid: boolean; reason?: string } {
    if (!bundle.files || !Array.isArray(bundle.files) || bundle.files.length === 0) {
      return { valid: false, reason: "Tập tin trong hồ sơ kiểm toán rỗng." };
    }

    // Xác thực từng file sha256
    for (const f of bundle.files) {
      const computed = crypto.createHash("sha256").update(f.content, "utf-8").digest("hex");
      if (computed !== f.sha256) {
        return { valid: false, reason: `Sai lệch mã băm SHA-256 tại tập tin ${f.filename}` };
      }
    }

    // Xác thực Merkle root hash
    const concatenated = bundle.files.map(f => f.sha256).sort().join(":");
    const computedRoot = crypto.createHash("sha256").update(concatenated, "utf-8").digest("hex");
    if (computedRoot !== bundle.merkleRootHash) {
      return { valid: false, reason: "Sai lệch Merkle Root Hash của toàn bộ gói kiểm toán." };
    }

    return { valid: true };
  }
}

let exportingEngineInstance: ExportingEngine | null = null;
export function getExportingEngine(): ExportingEngine {
  if (!exportingEngineInstance) {
    exportingEngineInstance = new ExportingEngine();
  }
  return exportingEngineInstance;
}
