/**
 * Phân hệ 39 & 40: Autonomous 17:00 Business Pulse Scheduler & Zalo Proactive Dispatcher
 * Tự động chốt sổ Nhịp thở kinh doanh lúc 17:00 (UTC+7 Việt Nam) và đẩy báo cáo tới Web UI + Zalo Gateway.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  getBusinessPulseEngine,
  getVietnamDateString,
  type BusinessPulseEngine,
  type DailyPulseSummary,
} from "./business-pulse.ts";

export interface PulseSchedulerConfig {
  enabled: boolean;
  triggerHourVn: number;
  triggerMinuteVn: number;
  zaloToId?: string;
  zaloWorkspaceId?: string;
  gatewayUrl?: string;
  lastTriggeredDate?: string;
}

export interface PulseDispatchResult {
  workspaceId: string;
  date: string;
  snapshot: DailyPulseSummary;
  reportText: string;
  zaloSent: boolean;
  zaloError?: string;
}

export interface PulseSchedulerDeps {
  engine?: BusinessPulseEngine;
  configPath?: string;
  onPulseTriggered?: (snapshot: DailyPulseSummary, reportText: string) => void;
  sendZalo?: (payload: { gatewayUrl: string; workspaceId: string; toId: string; text: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function getVietnamClock(date: Date = new Date()): { dateStr: string; hour: number; minute: number } {
  const vnDate = new Date(date.getTime() + 7 * 3600 * 1000);
  return {
    dateStr: vnDate.toISOString().slice(0, 10),
    hour: vnDate.getUTCHours(),
    minute: vnDate.getUTCMinutes(),
  };
}

export function format17PmZaloReport(pulse: DailyPulseSummary): string {
  const profitLabel = pulse.grossProfit >= 0 ? "Lãi ròng" : "Lỗ ròng";
  const profitIcon = pulse.grossProfit >= 0 ? "🟢" : "🔴";
  const lines: string[] = [
    `📊 BÁO CÁO NHỊP THỞ KINH DOANH 17:00 (${pulse.date})`,
    `────────────────────────`,
    `🟢 Doanh thu: ${pulse.formattedWidget.revenueDisplay}`,
    `${profitIcon} ${profitLabel}: ${pulse.formattedWidget.profitDisplay} (Margin: ${pulse.formattedWidget.marginDisplay})`,
    `📦 Số đơn ghi nhận: ${pulse.transactionCount}`,
  ];

  if (pulse.bottlenecks.length === 0) {
    lines.push(`✅ Điểm nghẽn TOC: Không phát hiện tắc nghẽn.`);
  } else {
    lines.push(`────────────────────────`);
    lines.push(`⚠️ Điểm nghẽn TOC (${pulse.bottlenecks.length}):`);
    for (const bn of pulse.bottlenecks.slice(0, 5)) {
      lines.push(`• [${bn.severity.toUpperCase()}] ${bn.title}`);
      lines.push(`  ↳ ${bn.suggestedAction}`);
    }
  }

  return lines.join("\n");
}

async function defaultSendZalo(payload: {
  gatewayUrl: string;
  workspaceId: string;
  toId: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(`${payload.gatewayUrl.replace(/\/$/, "")}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: payload.workspaceId,
        toId: payload.toId,
        text: payload.text,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, error: `HTTP ${resp.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export class AutonomousPulseScheduler {
  private config: PulseSchedulerConfig;
  private configPath: string | null;
  private deps: PulseSchedulerDeps;
  private timer: NodeJS.Timeout | null = null;
  private runningTick = false;

  constructor(deps: PulseSchedulerDeps = {}) {
    this.deps = deps;
    const dataDir = process.env.OMB_DATA_DIR || process.env.RAI2_DATA_DIR || process.env.DATA_DIR;
    this.configPath =
      deps.configPath ??
      (process.env.RAI2_PULSE_SCHEDULER_FILE ??
        (dataDir ? join(dataDir, "pulse-scheduler-config.json") : null));

    const defaultTenantSlug =
      process.env.OMB_SIGNIN_TENANT_SLUG || (dataDir ? basename(dirname(dataDir)) : "default") || "default";

    this.config = {
      enabled: true,
      triggerHourVn: 17,
      triggerMinuteVn: 0,
      zaloToId: process.env.RAI2_PULSE_ZALO_TO_ID || undefined,
      zaloWorkspaceId: defaultTenantSlug,
      gatewayUrl: process.env.RAI2_ZALO_GATEWAY_URL || "http://127.0.0.1:18789",
    };

    this.loadConfig();
  }

  private loadConfig(): void {
    if (!this.configPath || !existsSync(this.configPath)) return;
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PulseSchedulerConfig>;
      if (typeof parsed === "object" && parsed !== null) {
        this.config = { ...this.config, ...parsed };
      }
    } catch {
      // Ignore corrupt config
    }
  }

  private saveConfig(): void {
    if (!this.configPath) return;
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const tmp = `${this.configPath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.config, null, 2), "utf-8");
      renameSync(tmp, this.configPath);
    } catch {
      // In-memory fallback
    }
  }

  public getConfig(): PulseSchedulerConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<PulseSchedulerConfig>): PulseSchedulerConfig {
    if (typeof patch.enabled === "boolean") this.config.enabled = patch.enabled;
    if (typeof patch.triggerHourVn === "number" && patch.triggerHourVn >= 0 && patch.triggerHourVn <= 23) {
      this.config.triggerHourVn = Math.floor(patch.triggerHourVn);
    }
    if (typeof patch.triggerMinuteVn === "number" && patch.triggerMinuteVn >= 0 && patch.triggerMinuteVn <= 59) {
      this.config.triggerMinuteVn = Math.floor(patch.triggerMinuteVn);
    }
    if (typeof patch.zaloToId === "string") {
      this.config.zaloToId = patch.zaloToId.trim() || undefined;
    }
    if (typeof patch.zaloWorkspaceId === "string" && patch.zaloWorkspaceId.trim()) {
      this.config.zaloWorkspaceId = patch.zaloWorkspaceId.trim();
    }
    if (typeof patch.gatewayUrl === "string" && patch.gatewayUrl.trim()) {
      this.config.gatewayUrl = patch.gatewayUrl.trim();
    }
    this.saveConfig();
    return this.getConfig();
  }

  public async dispatchNow(workspaceIds?: string[], dateString?: string): Promise<PulseDispatchResult[]> {
    const engine = this.deps.engine ?? getBusinessPulseEngine();
    const targetDate = dateString || getVietnamDateString();
    const targets = workspaceIds && workspaceIds.length > 0 ? workspaceIds : engine.listWorkspaces();
    const sender = this.deps.sendZalo ?? defaultSendZalo;
    const results: PulseDispatchResult[] = [];

    for (const ws of targets) {
      const snapshot = engine.trigger17PmPulse(ws, targetDate);
      const reportText = format17PmZaloReport(snapshot);

      if (this.deps.onPulseTriggered) {
        try {
          this.deps.onPulseTriggered(snapshot, reportText);
        } catch {
          // Non-fatal
        }
      }

      let zaloSent = false;
      let zaloError: string | undefined;

      if (this.config.zaloToId && (ws === "default" || targets.length === 1)) {
        const res = await sender({
          gatewayUrl: this.config.gatewayUrl || "http://127.0.0.1:18789",
          workspaceId: this.config.zaloWorkspaceId || ws,
          toId: this.config.zaloToId,
          text: reportText,
        });
        zaloSent = res.ok;
        zaloError = res.error;
      }

      results.push({
        workspaceId: ws,
        date: targetDate,
        snapshot,
        reportText,
        zaloSent,
        ...(zaloError ? { zaloError } : {}),
      });
    }

    this.config.lastTriggeredDate = targetDate;
    this.saveConfig();
    return results;
  }

  public async tick(now: Date = new Date()): Promise<PulseDispatchResult[] | null> {
    if (!this.config.enabled || this.runningTick) return null;
    const clock = getVietnamClock(now);
    const pastTriggerTime =
      clock.hour > this.config.triggerHourVn ||
      (clock.hour === this.config.triggerHourVn && clock.minute >= this.config.triggerMinuteVn);

    if (!pastTriggerTime) return null;
    if (this.config.lastTriggeredDate === clock.dateStr) return null;

    this.runningTick = true;
    try {
      const engine = this.deps.engine ?? getBusinessPulseEngine();
      // Only trigger workspaces that don't already have today's 17:00 snapshot
      const dueWorkspaces = engine.listWorkspaces().filter((ws) => !engine.get17PmSnapshot(ws, clock.dateStr));
      if (dueWorkspaces.length === 0) {
        this.config.lastTriggeredDate = clock.dateStr;
        this.saveConfig();
        return null;
      }
      return await this.dispatchNow(dueWorkspaces, clock.dateStr);
    } finally {
      this.runningTick = false;
    }
  }

  public start(intervalMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

let globalPulseScheduler: AutonomousPulseScheduler | null = null;
export function getPulseScheduler(deps?: PulseSchedulerDeps): AutonomousPulseScheduler {
  if (!globalPulseScheduler) {
    globalPulseScheduler = new AutonomousPulseScheduler(deps);
  }
  return globalPulseScheduler;
}
