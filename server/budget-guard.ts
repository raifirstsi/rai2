/**
 * Phân hệ 59: Pre-flight Budget Guard & Token Arbitrage Engine
 * Protects P&L and arbitrates models based on cost and capability before each turn.
 */

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

export class BudgetGuard {
  private budgets = new Map<string, WorkspaceBudget>();
  private spendLogs: SpendLogEntry[] = [];
  private defaultMonthlyCap = 100.0; // $100 monthly default

  getPricing(model: string): ModelPricing {
    const key = Object.keys(MODEL_PRICING_TABLE).find(
      (k) => model.toLowerCase().includes(k.toLowerCase())
    );
    return key ? MODEL_PRICING_TABLE[key] : MODEL_PRICING_TABLE["default"];
  }

  getWorkspaceBudget(workspaceId: string): WorkspaceBudget {
    let b = this.budgets.get(workspaceId);
    if (!b) {
      b = {
        workspaceId,
        monthlyCapUsd: this.defaultMonthlyCap,
        currentSpendUsd: 0,
        softWarningRatio: 0.8,
        hardStopRatio: 1.0,
        arbitrageEnabled: true,
        totalTokensUsed: { prompt: 0, output: 0 },
        turnCount: 0,
        lastTurnAt: Date.now(),
      };
      this.budgets.set(workspaceId, b);
    }
    return b;
  }

  setWorkspaceBudget(workspaceId: string, updates: Partial<WorkspaceBudget>): WorkspaceBudget {
    const b = this.getWorkspaceBudget(workspaceId);
    Object.assign(b, updates);
    return b;
  }

  calculateTurnCost(model: string, promptTokens: number, outputTokens: number): number {
    const pricing = this.getPricing(model);
    const cost = (promptTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  evaluatePreflight(req: PreflightRequest): PreflightDecision {
    const budget = this.getWorkspaceBudget(req.workspaceId);
    const expectedOutput = req.maxOutputTokens ?? 1024;
    const estCost = this.calculateTurnCost(req.model, req.estimatedPromptTokens, expectedOutput);
    const projectedSpend = Math.round((budget.currentSpendUsd + estCost) * 1_000_000) / 1_000_000;

    const softCap = budget.monthlyCapUsd * budget.softWarningRatio;
    const hardCap = budget.monthlyCapUsd * budget.hardStopRatio;

    // Hard Stop: exceeds cap
    if (projectedSpend > hardCap) {
      return {
        allowed: false,
        status: "blocked",
        estimatedCostUsd: estCost,
        projectedMonthlySpendUsd: projectedSpend,
        monthlyCapUsd: budget.monthlyCapUsd,
        currentSpendUsd: budget.currentSpendUsd,
        rejectionReason: `Pre-flight Budget Guard: Turn blocked. Projected spend $${projectedSpend.toFixed(2)} exceeds monthly cap $${budget.monthlyCapUsd.toFixed(2)}.`,
      };
    }

    // Model Arbitrage Analysis
    let arbitrage: TokenArbitrageSuggestion | undefined;
    const pricing = this.getPricing(req.model);

    if (
      budget.arbitrageEnabled &&
      pricing.arbitrageTarget &&
      (req.taskComplexity === "simple" || req.estimatedPromptTokens < 4000 || projectedSpend >= softCap)
    ) {
      const targetModel = pricing.arbitrageTarget;
      const targetPricing = this.getPricing(targetModel);
      const targetEstCost = (req.estimatedPromptTokens * targetPricing.inputPer1M + expectedOutput * targetPricing.outputPer1M) / 1_000_000;
      const savings = Math.max(0, estCost - targetEstCost);
      const savingsPct = estCost > 0 ? Math.round((savings / estCost) * 100) : 0;

      if (savingsPct >= 40) {
        arbitrage = {
          suggestedModel: targetModel,
          estimatedCostUsd: Math.round(targetEstCost * 1_000_000) / 1_000_000,
          originalCostUsd: estCost,
          savingsUsd: Math.round(savings * 1_000_000) / 1_000_000,
          savingsPercent: savingsPct,
          reason: `Token Arbitrage: Routing this turn to ${targetModel} saves ${savingsPct}% cost ($${savings.toFixed(4)}) while maintaining required SLA.`,
        };
      }
    }

    // Soft Warning: approaching cap (>= 80%)
    if (projectedSpend >= softCap) {
      const pct = Math.round((projectedSpend / budget.monthlyCapUsd) * 100);
      return {
        allowed: true,
        status: "warning",
        estimatedCostUsd: estCost,
        projectedMonthlySpendUsd: projectedSpend,
        monthlyCapUsd: budget.monthlyCapUsd,
        currentSpendUsd: budget.currentSpendUsd,
        warning: `Pre-flight Budget Warning: Approaching monthly cap (${pct}% used: $${projectedSpend.toFixed(2)} / $${budget.monthlyCapUsd.toFixed(2)}).`,
        arbitrage,
      };
    }

    // Standard OK
    return {
      allowed: true,
      status: "ok",
      estimatedCostUsd: estCost,
      projectedMonthlySpendUsd: projectedSpend,
      monthlyCapUsd: budget.monthlyCapUsd,
      currentSpendUsd: budget.currentSpendUsd,
      arbitrage,
    };
  }

  recordSpend(
    workspaceId: string,
    model: string,
    promptTokens: number,
    outputTokens: number,
    turnId?: string
  ): SpendLogEntry {
    const budget = this.getWorkspaceBudget(workspaceId);
    const cost = this.calculateTurnCost(model, promptTokens, outputTokens);

    budget.currentSpendUsd = Math.round((budget.currentSpendUsd + cost) * 1_000_000) / 1_000_000;
    budget.totalTokensUsed.prompt += promptTokens;
    budget.totalTokensUsed.output += outputTokens;
    budget.turnCount += 1;
    budget.lastTurnAt = Date.now();

    const entry: SpendLogEntry = {
      id: `spend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId,
      turnId,
      model,
      promptTokens,
      outputTokens,
      costUsd: cost,
      timestamp: Date.now(),
    };

    this.spendLogs.push(entry);
    if (this.spendLogs.length > 2000) {
      this.spendLogs.splice(0, this.spendLogs.length - 2000);
    }

    return entry;
  }

  getSpendHistory(workspaceId: string, limit = 50): SpendLogEntry[] {
    return this.spendLogs
      .filter((s) => s.workspaceId === workspaceId)
      .slice(-limit)
      .reverse();
  }

  resetBudget(workspaceId: string): void {
    const budget = this.getWorkspaceBudget(workspaceId);
    budget.currentSpendUsd = 0;
    budget.totalTokensUsed = { prompt: 0, output: 0 };
    budget.turnCount = 0;
  }
}

let globalBudgetGuard: BudgetGuard | null = null;

export function getBudgetGuard(): BudgetGuard {
  if (!globalBudgetGuard) {
    globalBudgetGuard = new BudgetGuard();
  }
  return globalBudgetGuard;
}
