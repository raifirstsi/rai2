/**
 * Phân hệ 59: Pre-flight Budget Guard & Token Arbitrage Engine
 * Protects P&L and arbitrates models based on cost and capability before each turn.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ModelPricing {
  inputPer1M: number; // in USD
  outputPer1M: number; // in USD
  tier: "premium" | "standard" | "economy";
  arbitrageTarget?: string;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // Anthropic
  "claude-3-5-sonnet": { inputPer1M: 3.0, outputPer1M: 15.0, tier: "premium", arbitrageTarget: "claude-3-5-haiku" },
  "claude-3-opus": { inputPer1M: 15.0, outputPer1M: 75.0, tier: "premium", arbitrageTarget: "claude-3-5-sonnet" },
  "claude-3-5-haiku": { inputPer1M: 0.8, outputPer1M: 4.0, tier: "economy" },
  "claude-3-haiku": { inputPer1M: 0.25, outputPer1M: 1.25, tier: "economy" },

  // OpenAI
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0, tier: "premium", arbitrageTarget: "gpt-4o-mini" },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, tier: "economy" },
  "o1-preview": { inputPer1M: 15.0, outputPer1M: 60.0, tier: "premium", arbitrageTarget: "gpt-4o" },
  "o1-mini": { inputPer1M: 3.0, outputPer1M: 12.0, tier: "standard", arbitrageTarget: "gpt-4o-mini" },

  // Google
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.0, tier: "standard", arbitrageTarget: "gemini-1.5-flash" },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3, tier: "economy" },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4, tier: "economy" },

  // Default fallback
  "default": { inputPer1M: 1.0, outputPer1M: 3.0, tier: "standard" },
};

export interface WorkspaceBudget {
  workspaceId: string;
  monthlyCapUsd: number;
  currentSpendUsd: number;
  billingPeriod?: string; // Format YYYY-MM
  softWarningRatio: number; // default 0.8 (80%)
  hardStopRatio: number; // default 1.0 (100%)
  arbitrageEnabled: boolean;
  totalTokensUsed: { prompt: number; output: number };
  turnCount: number;
  lastTurnAt: number;
}

export interface PreflightRequest {
  workspaceId: string;
  model: string;
  estimatedPromptTokens: number;
  maxOutputTokens?: number;
  taskComplexity?: "simple" | "medium" | "complex";
}

export interface TokenArbitrageSuggestion {
  suggestedModel: string;
  estimatedCostUsd: number;
  originalCostUsd: number;
  savingsUsd: number;
  savingsPercent: number;
  reason: string;
}

export interface PreflightDecision {
  allowed: boolean;
  estimatedCostUsd: number;
  projectedMonthlySpendUsd: number;
  monthlyCapUsd: number;
  currentSpendUsd: number;
  status: "ok" | "warning" | "blocked";
  warning?: string;
  rejectionReason?: string;
  arbitrage?: TokenArbitrageSuggestion;
}

export interface SpendLogEntry {
  id: string;
  workspaceId: string;
  turnId?: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

export interface BudgetGuardOptions {
  storageFile?: string;
  defaultMonthlyCap?: number;
}

export function getCurrentBillingPeriod(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export class BudgetGuard {
  private budgets = new Map<string, WorkspaceBudget>();
  private spendLogs: SpendLogEntry[] = [];
  private defaultMonthlyCap = 100.0; // $100 monthly default
  private storageFile: string | null = null;

  constructor(options?: BudgetGuardOptions) {
    if (typeof options?.defaultMonthlyCap === "number") {
      this.defaultMonthlyCap = options.defaultMonthlyCap;
    }

    this.storageFile = options?.storageFile ?? (
      process.env.RAI2_BUDGET_FILE ?? (process.env.DATA_DIR ? join(process.env.DATA_DIR, "budget-guard-state.json") : null)
    );

    this.loadState();
  }

  private loadState(): void {
    if (!this.storageFile || !existsSync(this.storageFile)) return;
    try {
      const raw = readFileSync(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.budgets)) {
        for (const b of parsed.budgets) {
          if (b && typeof b.workspaceId === "string") {
            this.budgets.set(b.workspaceId, b);
          }
        }
      }
      if (Array.isArray(parsed.spendLogs)) {
        this.spendLogs = parsed.spendLogs.slice(-1000); // keep last 1000 logs
      }
    } catch {
      // Ignore load error
    }
  }

  private saveState(): void {
    if (!this.storageFile) return;
    try {
      const dir = dirname(this.storageFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = {
        budgets: Array.from(this.budgets.values()),
        spendLogs: this.spendLogs.slice(-500),
      };
      writeFileSync(this.storageFile, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignore save error
    }
  }

  getPricing(model: string): ModelPricing {
    const key = Object.keys(MODEL_PRICING_TABLE).find(
      (k) => model.toLowerCase().includes(k.toLowerCase())
    );
    return key ? MODEL_PRICING_TABLE[key] : MODEL_PRICING_TABLE["default"];
  }

  getWorkspaceBudget(workspaceId: string, asOfDate?: Date): WorkspaceBudget {
    const currentPeriod = getCurrentBillingPeriod(asOfDate);
    let b = this.budgets.get(workspaceId);
    if (!b) {
      b = {
        workspaceId,
        monthlyCapUsd: this.defaultMonthlyCap,
        currentSpendUsd: 0,
        billingPeriod: currentPeriod,
        softWarningRatio: 0.8,
        hardStopRatio: 1.0,
        arbitrageEnabled: true,
        totalTokensUsed: { prompt: 0, output: 0 },
        turnCount: 0,
        lastTurnAt: Date.now(),
      };
      this.budgets.set(workspaceId, b);
    } else {
      if (b.billingPeriod && b.billingPeriod !== currentPeriod) {
        // Auto-rollover to new monthly period!
        b.billingPeriod = currentPeriod;
        b.currentSpendUsd = 0;
        b.turnCount = 0;
        b.totalTokensUsed = { prompt: 0, output: 0 };
        this.saveState();
      } else if (!b.billingPeriod) {
        b.billingPeriod = currentPeriod;
      }
    }
    return b;
  }

  setWorkspaceBudget(
    workspaceId: string,
    updates: Partial<Omit<WorkspaceBudget, "workspaceId">>
  ): WorkspaceBudget {
    const existing = this.getWorkspaceBudget(workspaceId);
    const updated: WorkspaceBudget = {
      ...existing,
      ...updates,
    };
    this.budgets.set(workspaceId, updated);
    this.saveState();
    return updated;
  }

  calculateTurnCost(model: string, promptTokens: number, outputTokens: number): number {
    const pricing = this.getPricing(model);
    const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  evaluatePreflight(req: PreflightRequest): PreflightDecision {
    const budget = this.getWorkspaceBudget(req.workspaceId);
    const maxOutput = req.maxOutputTokens ?? 1024;
    const estimatedCost = this.calculateTurnCost(req.model, req.estimatedPromptTokens, maxOutput);
    const projectedSpend = Math.round((budget.currentSpendUsd + estimatedCost) * 1000) / 1000;

    let arbitrage: TokenArbitrageSuggestion | undefined;
    if (budget.arbitrageEnabled) {
      const pricing = this.getPricing(req.model);
      const isSimpleOrMedium = req.taskComplexity !== "complex";

      if (pricing.tier === "premium" && pricing.arbitrageTarget && isSimpleOrMedium) {
        const altCost = this.calculateTurnCost(pricing.arbitrageTarget, req.estimatedPromptTokens, maxOutput);
        const savingsUsd = Math.round((estimatedCost - altCost) * 10000) / 10000;
        const savingsPct = Math.round((savingsUsd / estimatedCost) * 100);

        if (savingsPct >= 30) {
          arbitrage = {
            suggestedModel: pricing.arbitrageTarget,
            estimatedCostUsd: altCost,
            originalCostUsd: estimatedCost,
            savingsUsd,
            savingsPercent: savingsPct,
            reason: `Token Arbitrage: Routing this turn to ${pricing.arbitrageTarget} saves ${savingsPct}% cost ($${savingsUsd}) while maintaining required SLA.`,
          };
        }
      }
    }

    const hardLimit = budget.monthlyCapUsd * budget.hardStopRatio;
    const softLimit = budget.monthlyCapUsd * budget.softWarningRatio;

    if (projectedSpend > hardLimit) {
      return {
        allowed: false,
        estimatedCostUsd: estimatedCost,
        projectedMonthlySpendUsd: projectedSpend,
        monthlyCapUsd: budget.monthlyCapUsd,
        currentSpendUsd: budget.currentSpendUsd,
        status: "blocked",
        rejectionReason: `Pre-flight Budget Guard: Turn projected spend ($${projectedSpend}) exceeds monthly cap ($${budget.monthlyCapUsd}). Turn halted to protect tenant P&L.`,
        arbitrage,
      };
    }

    if (projectedSpend > softLimit) {
      return {
        allowed: true,
        estimatedCostUsd: estimatedCost,
        projectedMonthlySpendUsd: projectedSpend,
        monthlyCapUsd: budget.monthlyCapUsd,
        currentSpendUsd: budget.currentSpendUsd,
        status: "warning",
        warning: `Pre-flight Budget Guard Warning: Workspace has reached ${Math.round((projectedSpend / budget.monthlyCapUsd) * 100)}% of monthly budget limit ($${budget.monthlyCapUsd}).`,
        arbitrage,
      };
    }

    return {
      allowed: true,
      estimatedCostUsd: estimatedCost,
      projectedMonthlySpendUsd: projectedSpend,
      monthlyCapUsd: budget.monthlyCapUsd,
      currentSpendUsd: budget.currentSpendUsd,
      status: "ok",
      arbitrage,
    };
  }

  recordSpend(entry: Omit<SpendLogEntry, "id" | "timestamp" | "costUsd">): SpendLogEntry {
    const cost = this.calculateTurnCost(entry.model, entry.promptTokens, entry.outputTokens);
    const log: SpendLogEntry = {
      id: `spend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      costUsd: cost,
      ...entry,
    };

    this.spendLogs.push(log);

    const b = this.getWorkspaceBudget(entry.workspaceId);
    b.currentSpendUsd = Math.round((b.currentSpendUsd + cost) * 10000) / 10000;
    b.totalTokensUsed.prompt += entry.promptTokens;
    b.totalTokensUsed.output += entry.outputTokens;
    b.turnCount += 1;
    b.lastTurnAt = Date.now();

    this.saveState();
    return log;
  }

  getSpendHistory(workspaceId: string, limit = 50): SpendLogEntry[] {
    return this.spendLogs
      .filter((s) => s.workspaceId === workspaceId)
      .slice(-limit)
      .reverse();
  }

  resetWorkspaceSpend(workspaceId: string): void {
    const b = this.getWorkspaceBudget(workspaceId);
    b.currentSpendUsd = 0;
    b.totalTokensUsed = { prompt: 0, output: 0 };
    b.turnCount = 0;
    b.lastTurnAt = Date.now();
    this.saveState();
  }
}

let globalBudgetGuard: BudgetGuard | null = null;

export function getBudgetGuard(options?: BudgetGuardOptions): BudgetGuard {
  if (!globalBudgetGuard) {
    globalBudgetGuard = new BudgetGuard(options);
  }
  return globalBudgetGuard;
}
