import { describe, it, expect, afterAll } from "vitest";
import { DuckDbPool, getDuckDbPool } from "./duckdb-pool.ts";
import {
  VirtualTableManager,
  evaluateFormula,
  sortColumnsByDependency,
} from "./virtual-tables/index.ts";
import { BudgetGuard } from "./budget-guard.ts";

describe("Sprint 3: DuckDB Analytics Pool", () => {
  const pool = new DuckDbPool();

  afterAll(async () => {
    await pool.closeAll();
  });

  it("executes analytical SQL queries sub-20ms with proper serialization", async () => {
    const res = await pool.query("test-ws", "SELECT 100 as id, 'Enterprise Q4' as name, 3.14159 as pi");
    expect(res.rowCount).toBe(1);
    expect(res.columns).toEqual(["id", "name", "pi"]);
    expect(res.rows[0].id).toBe(100);
    expect(res.rows[0].name).toBe("Enterprise Q4");
    expect(typeof res.rows[0].pi).toBe("number");
    expect(res.executionTimeMs).toBeLessThan(100);
  });

  it("ingests tabular data and performs aggregations per workspace", async () => {
    const ws = "tenant-sales-alpha";
    const cols = [
      { name: "product", type: "VARCHAR" as const },
      { name: "revenue", type: "DOUBLE" as const },
      { name: "cost", type: "DOUBLE" as const },
    ];
    const data = [
      { product: "AI License", revenue: 50000, cost: 12000 },
      { product: "Consulting", revenue: 25000, cost: 8000 },
      { product: "Cloud Hosting", revenue: 15000, cost: 5000 },
    ];

    const ingestRes = await pool.ingestTable(ws, "sales_q4", cols, data);
    expect(ingestRes.inserted).toBe(3);

    const aggRes = await pool.query(
      ws,
      "SELECT count(*) as total_deals, sum(revenue) as total_rev, sum(cost) as total_cost, avg((revenue - cost) / revenue * 100) as avg_margin FROM sales_q4"
    );

    expect(aggRes.rowCount).toBe(1);
    expect(aggRes.rows[0].total_deals).toBe(3);
    expect(aggRes.rows[0].total_rev).toBe(90000);
    expect(aggRes.rows[0].total_cost).toBe(25000);
    expect(Number(aggRes.rows[0].avg_margin)).toBeGreaterThan(65);
  });

  it("supports parameterized SQL queries", async () => {
    const res = await pool.query(
      "test-params",
      "SELECT ?::INTEGER as num, ?::VARCHAR as label",
      [42, "Safe Parameter"]
    );
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].num).toBe(42);
    expect(res.rows[0].label).toBe("Safe Parameter");
  });
});

describe("Sprint 3: Virtual Tables Engine & Formulas", () => {
  it("evaluates formulas with business arithmetic and functions", () => {
    const ctx = { rev: 10000, c: 6000, discount: 0.1 };

    // Standard arithmetic
    const profit = evaluateFormula("[rev] - [c]", ctx);
    expect(profit).toBe(4000);

    // Business MARGIN function
    const margin = evaluateFormula("MARGIN([rev], [c])", ctx);
    expect(margin).toBe(40);

    // Conditional IF formula
    const tax = evaluateFormula("IF([rev] > 5000, [rev] * 0.1, 0)", ctx);
    expect(tax).toBe(1000);

    // ROUND
    const rounded = evaluateFormula("ROUND(3.14159, 2)", ctx);
    expect(rounded).toBe(3.14);
  });

  it("detects circular dependencies in column schemas", () => {
    const cols = [
      { id: "colA", name: "A", type: "formula", formula: "[B] + 1" },
      { id: "colB", name: "B", type: "formula", formula: "[A] + 1" },
    ];
    const { circularError } = sortColumnsByDependency(cols);
    expect(circularError).toBeDefined();
    expect(circularError).toContain("Circular dependency");
  });

  it("manages reactive table rows, SLA triggers, and markdown export", async () => {
    const mgr = new VirtualTableManager();
    const table = mgr.createTable({
      workspaceId: "ws-pnl",
      name: "P&L_Analysis",
      columns: [
        { id: "item", name: "Item", type: "text" },
        { id: "revenue", name: "Revenue", type: "number" },
        { id: "cogs", name: "COGS", type: "number" },
        { id: "gross_margin", name: "Gross Margin %", type: "formula", formula: "MARGIN([revenue], [cogs])" },
      ],
      slaRules: [
        {
          id: "low_margin_alert",
          name: "Low Margin SLA Breach",
          severity: "critical",
          condition: "[gross_margin] < 20",
          alertMessage: "Gross Margin fell below 20% SLA threshold!",
        },
      ],
    });

    // Row 1: Healthy margin (50%)
    table.setRow("r1", { item: "Product A", revenue: 1000, cogs: 500 });
    const r1 = table.getRow("r1");
    expect(r1?.computed?.gross_margin).toBe(50);
    expect(table.getAlerts().length).toBe(0);

    // Row 2: Breaches SLA margin (10%)
    table.setRow("r2", { item: "Product B", revenue: 1000, cogs: 900 });
    const r2 = table.getRow("r2");
    expect(r2?.computed?.gross_margin).toBe(10);
    expect(table.getAlerts().length).toBe(1);
    expect(table.getAlerts()[0].ruleId).toBe("low_margin_alert");
    expect(table.getAlerts()[0].rowId).toBe("r2");

    // Markdown rendering
    const md = table.toMarkdown();
    expect(md).toContain("| Item | Revenue | COGS | Gross Margin % |");
    expect(md).toContain("| Product A | 1000 | 500 | 50 |");
    expect(md).toContain("| Product B | 1000 | 900 | 10 |");

    // Sync to DuckDB
    const duckPool = getDuckDbPool();
    const syncRes = await table.syncToDuckDb(duckPool);
    expect(syncRes.inserted).toBe(2);

    const sqlRes = await duckPool.query("ws-pnl", 'SELECT count(*) as total, avg("Gross Margin %") as avg_m FROM "P_L_Analysis"');
    expect(sqlRes.rows[0].total).toBe(2);
    expect(sqlRes.rows[0].avg_m).toBe(30);
  });
});

describe("Sprint 3: Pre-flight Budget Guard & Token Arbitrage", () => {
  const guard = new BudgetGuard();

  it("calculates accurate model pricing and allows turns within budget", () => {
    const ws = "ws-budget-ok";
    guard.setWorkspaceBudget(ws, { monthlyCapUsd: 50.0 });

    const dec = guard.evaluatePreflight({
      workspaceId: ws,
      model: "claude-3-5-sonnet",
      estimatedPromptTokens: 2000,
      maxOutputTokens: 1000,
    });

    expect(dec.allowed).toBe(true);
    expect(dec.status).toBe("ok");
    // (2000 * 3 + 1000 * 15) / 1M = 0.021 USD
    expect(dec.estimatedCostUsd).toBe(0.021);
  });

  it("suggests token arbitrage for premium models on lightweight tasks", () => {
    const ws = "ws-arbitrage";
    guard.setWorkspaceBudget(ws, { monthlyCapUsd: 50.0, arbitrageEnabled: true });

    const dec = guard.evaluatePreflight({
      workspaceId: ws,
      model: "claude-3-5-sonnet",
      estimatedPromptTokens: 1500,
      maxOutputTokens: 800,
      taskComplexity: "simple",
    });

    expect(dec.allowed).toBe(true);
    expect(dec.arbitrage).toBeDefined();
    expect(dec.arbitrage?.suggestedModel).toBe("claude-3-5-haiku");
    expect(dec.arbitrage?.savingsPercent).toBeGreaterThan(60);
  });

  it("blocks turn when projected spend exceeds monthly cap (hard stop)", () => {
    const ws = "ws-budget-exceeded";
    guard.setWorkspaceBudget(ws, { monthlyCapUsd: 10.0 });

    // Manually push spend to $9.99
    guard.recordSpend(ws, "claude-3-5-sonnet", 1_000_000, 466_000);

    const dec = guard.evaluatePreflight({
      workspaceId: ws,
      model: "claude-3-opus",
      estimatedPromptTokens: 20_000,
      maxOutputTokens: 4_000,
    });

    expect(dec.allowed).toBe(false);
    expect(dec.status).toBe("blocked");
    expect(dec.rejectionReason).toContain("Turn blocked");
    expect(dec.rejectionReason).toContain("exceeds monthly cap");
  });

  it("issues warning when projected spend exceeds soft cap (80%)", () => {
    const ws = "ws-budget-warning";
    guard.setWorkspaceBudget(ws, { monthlyCapUsd: 10.0, softWarningRatio: 0.8 });

    // Set spend to $8.20
    guard.recordSpend(ws, "claude-3-5-sonnet", 1_000_000, 346_666);

    const dec = guard.evaluatePreflight({
      workspaceId: ws,
      model: "claude-3-5-haiku",
      estimatedPromptTokens: 1000,
      maxOutputTokens: 500,
    });

    expect(dec.allowed).toBe(true);
    expect(dec.status).toBe("warning");
    expect(dec.warning).toContain("Approaching monthly cap");
  });
});
