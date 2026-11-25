import { describe, it, expect, beforeEach } from "vitest";
import { getDuckDbPool } from "./duckdb-pool.ts";
import {
  evaluateFormula,
  extractDependencies,
  sortColumnsByDependency,
  VirtualTableManager,
} from "./virtual-tables/index.ts";
import { BudgetGuard } from "./budget-guard.ts";

describe("Sprint 3 Enterprise Infrastructure", () => {
  describe("Phân hệ 21: DuckDB Analytics Pool", () => {
    it("executes analytical query within sub-20ms SLA", async () => {
      const pool = getDuckDbPool();
      const res = await pool.query("test-ws", "SELECT 42 as answer, 'DuckDB OLAP' as engine");
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].answer).toBe(42);
      expect(res.rows[0].engine).toBe("DuckDB OLAP");
      expect(res.executionTimeMs).toBeLessThan(100);
    });

    it("supports parameterized queries and multi-tenant isolation", async () => {
      const pool = getDuckDbPool();
      await pool.query("tenant-a", "CREATE TABLE items (id INT, name VARCHAR)");
      await pool.query("tenant-a", "INSERT INTO items VALUES (1, 'Item A')");

      const resA = await pool.query("tenant-a", "SELECT * FROM items WHERE id = ?", [1]);
      expect(resA.rowCount).toBe(1);
      expect(resA.rows[0].name).toBe("Item A");

      // tenant-b must not see tenant-a's table
      await expect(pool.query("tenant-b", "SELECT * FROM items")).rejects.toThrow();
    });

    it("ingests virtual table rows into DuckDB seamlessly", async () => {
      const pool = getDuckDbPool();
      const res = await pool.ingestTable(
        "tenant-ingest",
        "orders_daily",
        [
          { name: "order_id", type: "VARCHAR" },
          { name: "revenue", type: "DOUBLE" },
          { name: "profit", type: "DOUBLE" },
        ],
        [
          { order_id: "ORD-001", revenue: 500.0, profit: 125.0 },
          { order_id: "ORD-002", revenue: 1000.0, profit: 300.0 },
        ]
      );
      expect(res.inserted).toBe(2);

      const q = await pool.query("tenant-ingest", "SELECT SUM(profit) as total_profit FROM orders_daily");
      expect(q.rows[0].total_profit).toBe(425.0);
    });
  });

  describe("Phân hệ 20: Virtual Tables Engine & Formulas", () => {
    it("extracts bracketed and natural unbracketed column dependencies", () => {
      const deps1 = extractDependencies("MARGIN([revenue], [cost])");
      expect(deps1).toEqual(["revenue", "cost"]);

      const deps2 = extractDependencies("MARGIN(revenue, cost) + [bonus]", ["revenue", "cost", "margin"]);
      expect(deps2).toContain("revenue");
      expect(deps2).toContain("cost");
      expect(deps2).toContain("bonus");
    });

    it("evaluates business formulas accurately with both bracketed and natural identifiers", () => {
      const ctx = { revenue: 1000, cost: 700 };
      const m1 = evaluateFormula("MARGIN([revenue], [cost])", ctx);
      expect(m1).toBe(30);

      const m2 = evaluateFormula("MARGIN(revenue, cost)", ctx);
      expect(m2).toBe(30);

      const markup = evaluateFormula("MARKUP([cost], 30)", ctx);
      expect(markup).toBe(1000);

      const rounded = evaluateFormula("ROUND([revenue] / 3, 2)", ctx);
      expect(rounded).toBe(333.33);

      const conditional = evaluateFormula("IF([revenue] > 500, 'Tier 1', 'Tier 2')", ctx);
      expect(conditional).toBe("Tier 1");
    });

    it("detects circular references in formula DAG", () => {
      const cols = [
        { id: "c1", name: "A", type: "formula", formula: "[B] + 10" },
        { id: "c2", name: "B", type: "formula", formula: "[A] * 2" },
      ];
      const { circularError } = sortColumnsByDependency(cols as any);
      expect(circularError).toBeDefined();
      expect(circularError).toContain("Circular dependency detected");
    });

    it("triggers real-time SLA alerts on margin violations", () => {
      const manager = new VirtualTableManager();
      const table = manager.createTable({
        workspaceId: "ws-pnl",
        name: "Pricing Guard",
        columns: [
          { id: "c1", name: "deal", type: "text" },
          { id: "c2", name: "revenue", type: "number" },
          { id: "c3", name: "cost", type: "number" },
          { id: "c4", name: "margin", type: "formula", formula: "MARGIN([revenue], [cost])" },
        ],
        slaRules: [
          {
            id: "rule-margin-floor",
            name: "Margin Floor Alert",
            severity: "critical",
            condition: "[margin] < 20",
            alertMessage: "Deal margin below minimum threshold of 20%!",
          },
        ],
      });

      // Deal 1: 30% margin -> OK
      table.setRow("r1", { deal: "Deal Good", revenue: 1000, cost: 700 });
      expect(table.getAlerts()).toHaveLength(0);

      // Deal 2: 10% margin -> Trigger Alert
      table.setRow("r2", { deal: "Deal Bad", revenue: 1000, cost: 900 });
      expect(table.getAlerts()).toHaveLength(1);
      expect(table.getAlerts()[0].ruleName).toBe("Margin Floor Alert");
      expect(table.getAlerts()[0].severity).toBe("critical");
    });

    it("computes table summary aggregations (SUM, AVG, COUNT)", () => {
      const manager = new VirtualTableManager();
      const table = manager.createTable({
        workspaceId: "ws-agg",
        name: "Sales",
        columns: [
          { id: "c1", name: "product", type: "text" },
          { id: "c2", name: "revenue", type: "number" },
          { id: "c3", name: "cost", type: "number" },
          { id: "c4", name: "margin", type: "formula", formula: "MARGIN(revenue, cost)" },
        ],
        defaultAggregations: {
          product: "COUNT",
          revenue: "SUM",
          cost: "SUM",
          margin: "AVG",
        },
      });

      table.setRow("r1", { product: "Prod 1", revenue: 1000, cost: 600 });
      table.setRow("r2", { product: "Prod 2", revenue: 2000, cost: 1600 });

      const summary = table.computeSummary();
      expect(summary.product).toBe(2);
      expect(summary.revenue).toBe(3000);
      expect(summary.cost).toBe(2200);
      expect(summary.margin).toBe(30); // (40% + 20%) / 2 = 30%

      const md = table.toMarkdown();
      expect(md).toContain("**3000**");
      expect(md).toContain("**2200**");
    });
  });

  describe("Phân hệ 59: Pre-flight Budget Guard & Token Arbitrage", () => {
    let guard: BudgetGuard;

    beforeEach(() => {
      guard = new BudgetGuard({ defaultMonthlyCap: 10.0 });
    });

    it("approves turns well within monthly budget", () => {
      const dec = guard.evaluatePreflight({
        workspaceId: "ws-test",
        model: "claude-3-5-sonnet",
        estimatedPromptTokens: 1000,
        maxOutputTokens: 500,
      });

      expect(dec.allowed).toBe(true);
      expect(dec.status).toBe("ok");
      expect(dec.estimatedCostUsd).toBeGreaterThan(0);
    });

    it("triggers soft warning at 80% threshold", () => {
      guard.setWorkspaceBudget("ws-test", {
        monthlyCapUsd: 1.0,
        currentSpendUsd: 0.85,
      });

      const dec = guard.evaluatePreflight({
        workspaceId: "ws-test",
        model: "gpt-4o",
        estimatedPromptTokens: 2000,
      });

      expect(dec.allowed).toBe(true);
      expect(dec.status).toBe("warning");
      expect(dec.warning).toContain("budget limit");
    });

    it("strictly blocks turns that exceed hard limit (100%)", () => {
      guard.setWorkspaceBudget("ws-test", {
        monthlyCapUsd: 0.05,
        currentSpendUsd: 0.045,
      });

      const dec = guard.evaluatePreflight({
        workspaceId: "ws-test",
        model: "o1-preview",
        estimatedPromptTokens: 5000,
        maxOutputTokens: 2000,
      });

      expect(dec.allowed).toBe(false);
      expect(dec.status).toBe("blocked");
      expect(dec.rejectionReason).toContain("exceeds monthly cap");
    });

    it("recommends token arbitrage savings when appropriate", () => {
      const dec = guard.evaluatePreflight({
        workspaceId: "ws-test",
        model: "claude-3-5-sonnet",
        estimatedPromptTokens: 3000,
        maxOutputTokens: 1000,
        taskComplexity: "simple",
      });

      expect(dec.arbitrage).toBeDefined();
      expect(dec.arbitrage?.suggestedModel).toBe("claude-3-5-haiku");
      expect(dec.arbitrage?.savingsPercent).toBeGreaterThanOrEqual(50);
    });

    it("records actual turn spend and updates budget usage", () => {
      const log = guard.recordSpend({
        workspaceId: "ws-record",
        turnId: "turn-123",
        model: "claude-3-5-sonnet",
        promptTokens: 1000,
        outputTokens: 500,
      });

      expect(log.costUsd).toBeGreaterThan(0);
      const b = guard.getWorkspaceBudget("ws-record");
      expect(b.currentSpendUsd).toBe(log.costUsd);
      expect(b.turnCount).toBe(1);
      expect(b.totalTokensUsed.prompt).toBe(1000);
      expect(b.totalTokensUsed.output).toBe(500);

      const history = guard.getSpendHistory("ws-record");
      expect(history).toHaveLength(1);
      expect(history[0].turnId).toBe("turn-123");
    });
  });
});
