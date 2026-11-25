import { getDuckDbPool } from "../duckdb-pool.ts";
import { getVirtualTableManager } from "../virtual-tables/index.ts";
import { getBudgetGuard } from "../budget-guard.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createVirtualTablesRoutes(): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    // 1. POST /api/tables/query - Sub-20ms DuckDB SQL query
    if (method === "POST" && path === "/api/tables/query") {
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const parsed = body as { workspaceId?: unknown; sql?: unknown; params?: unknown };
      const workspaceId = typeof parsed?.workspaceId === "string" && parsed.workspaceId ? parsed.workspaceId : "default";
      if (typeof parsed?.sql !== "string" || !parsed.sql.trim()) {
        return json(res, 400, { error: "sql is required" });
      }

      try {
        const pool = getDuckDbPool();
        const result = await pool.query(
          workspaceId,
          parsed.sql,
          Array.isArray(parsed?.params) ? parsed.params : undefined
        );
        return json(res, 200, { success: true, ...result });
      } catch (err: any) {
        return json(res, 500, { error: err?.message || "DuckDB Query Failed" });
      }
    }

    // 2. POST /api/tables/virtual/create - Create or update a virtual table
    if (method === "POST" && path === "/api/tables/virtual/create") {
      let body: unknown;
      try {
        body = await readBody(req, 131_072);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        workspaceId?: unknown;
        id?: unknown;
        name?: unknown;
        description?: unknown;
        columns?: unknown;
        slaRules?: unknown;
        rows?: unknown;
      };

      const workspaceId = typeof p?.workspaceId === "string" && p.workspaceId ? p.workspaceId : "default";
      if (typeof p?.name !== "string" || !p.name.trim()) {
        return json(res, 400, { error: "name is required" });
      }
      if (!Array.isArray(p?.columns)) {
        return json(res, 400, { error: "columns must be an array" });
      }

      try {
        const manager = getVirtualTableManager();
        const table = manager.createTable({
          id: typeof p.id === "string" ? p.id : undefined,
          workspaceId,
          name: p.name,
          description: typeof p.description === "string" ? p.description : undefined,
          columns: p.columns as any,
          slaRules: Array.isArray(p.slaRules) ? (p.slaRules as any) : [],
        });

        if (Array.isArray(p.rows)) {
          table.setRows(p.rows as any);
        }

        return json(res, 200, {
          success: true,
          table: table.getSnapshot(),
          markdown: table.toMarkdown(),
        });
      } catch (err: any) {
        return json(res, 500, { error: err?.message || "Failed to create virtual table" });
      }
    }

    // 3. POST /api/tables/virtual/row - Insert or update row in virtual table
    if (method === "POST" && path === "/api/tables/virtual/row") {
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as { tableId?: unknown; rowId?: unknown; values?: unknown };
      if (typeof p?.tableId !== "string" || !p.tableId) {
        return json(res, 400, { error: "tableId is required" });
      }
      if (!p?.values || typeof p.values !== "object") {
        return json(res, 400, { error: "values object is required" });
      }

      const manager = getVirtualTableManager();
      const table = manager.getTable(p.tableId);
      if (!table) {
        return json(res, 404, { error: "Virtual table not found" });
      }

      const row = table.setRow(typeof p.rowId === "string" ? p.rowId : (p.values as any), p.values as any);
      return json(res, 200, {
        success: true,
        row,
        alerts: table.getAlerts().filter((a) => a.rowId === row.id),
      });
    }

    // 4. POST /api/tables/virtual/sync-duckdb - Sync virtual table into DuckDB
    if (method === "POST" && path === "/api/tables/virtual/sync-duckdb") {
      let body: unknown;
      try {
        body = await readBody(req, 16_384);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as { tableId?: unknown };
      if (typeof p?.tableId !== "string" || !p.tableId) {
        return json(res, 400, { error: "tableId is required" });
      }

      const manager = getVirtualTableManager();
      const table = manager.getTable(p.tableId);
      if (!table) {
        return json(res, 404, { error: "Virtual table not found" });
      }

      try {
        const pool = getDuckDbPool();
        const resSync = await table.syncToDuckDb(pool);
        return json(res, 200, { success: true, ...resSync });
      } catch (err: any) {
        return json(res, 500, { error: err?.message || "Failed to sync to DuckDB" });
      }
    }

    // 5. GET /api/tables/virtual/get?tableId=...
    if (method === "GET" && path === "/api/tables/virtual/get") {
      const url = new URL(req.url ?? "", "http://localhost");
      const tableId = url.searchParams.get("tableId");
      if (!tableId) {
        return json(res, 400, { error: "tableId query parameter is required" });
      }

      const manager = getVirtualTableManager();
      const table = manager.getTable(tableId);
      if (!table) {
        return json(res, 404, { error: "Virtual table not found" });
      }

      return json(res, 200, {
        success: true,
        table: table.getSnapshot(),
        markdown: table.toMarkdown(),
      });
    }

    // 6. POST /api/budget/preflight - Pre-flight Turn Budget & Token Arbitrage Guard
    if (method === "POST" && path === "/api/budget/preflight") {
      let body: unknown;
      try {
        body = await readBody(req, 16_384);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        workspaceId?: unknown;
        model?: unknown;
        estimatedPromptTokens?: unknown;
        maxOutputTokens?: unknown;
        taskComplexity?: unknown;
      };

      const workspaceId = typeof p?.workspaceId === "string" && p.workspaceId ? p.workspaceId : "default";
      const model = typeof p?.model === "string" && p.model ? p.model : "claude-3-5-sonnet";
      const promptTokens = typeof p?.estimatedPromptTokens === "number" ? p.estimatedPromptTokens : 1000;

      const guard = getBudgetGuard();
      const decision = guard.evaluatePreflight({
        workspaceId,
        model,
        estimatedPromptTokens: promptTokens,
        maxOutputTokens: typeof p?.maxOutputTokens === "number" ? p.maxOutputTokens : 1024,
        taskComplexity: typeof p?.taskComplexity === "string" ? (p.taskComplexity as any) : undefined,
      });

      return json(res, 200, { success: true, ...decision });
    }

    // 7. GET /api/budget/status?workspaceId=...
    if (method === "GET" && path === "/api/budget/status") {
      const url = new URL(req.url ?? "", "http://localhost");
      const workspaceId = url.searchParams.get("workspaceId") ?? "default";
      const guard = getBudgetGuard();
      const budget = guard.getWorkspaceBudget(workspaceId);
      const history = guard.getSpendHistory(workspaceId, 20);

      return json(res, 200, {
        success: true,
        budget,
        recentSpend: history,
      });
    }

    // 8. POST /api/budget/set-cap
    if (method === "POST" && path === "/api/budget/set-cap") {
      let body: unknown;
      try {
        body = await readBody(req, 16_384);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        workspaceId?: unknown;
        monthlyCapUsd?: unknown;
        softWarningRatio?: unknown;
        arbitrageEnabled?: unknown;
      };

      const workspaceId = typeof p?.workspaceId === "string" && p.workspaceId ? p.workspaceId : "default";
      const guard = getBudgetGuard();
      const updated = guard.setWorkspaceBudget(workspaceId, {
        monthlyCapUsd: typeof p?.monthlyCapUsd === "number" ? p.monthlyCapUsd : undefined,
        softWarningRatio: typeof p?.softWarningRatio === "number" ? p.softWarningRatio : undefined,
        arbitrageEnabled: typeof p?.arbitrageEnabled === "boolean" ? p.arbitrageEnabled : undefined,
      });

      return json(res, 200, { success: true, budget: updated });
    }

    return PASS;
  };
}
