import { randomUUID } from "node:crypto";
import type {
  AggregationConfig,
  ColumnDef,
  SlaAlert,
  SlaTriggerRule,
  TableRow,
  VirtualTableSchema,
  VirtualTableSnapshot,
} from "./types.ts";
import { evaluateFormula, sortColumnsByDependency } from "./formula.ts";
import { getDuckDbPool, type IngestColumn } from "../duckdb-pool.ts";

export class VirtualTable {
  private rows: Map<string, TableRow> = new Map();
  private alerts: SlaAlert[] = [];
  public schema: VirtualTableSchema;

  constructor(schema: VirtualTableSchema) {
    this.schema = schema;
  }

  /** Updates the schema or columns, re-evaluates all rows */
  updateSchema(updates: Partial<VirtualTableSchema>): void {
    this.schema = {
      ...this.schema,
      ...updates,
      updatedAt: Date.now(),
    };
    this.recalculateAll();
  }

  /** Adds or updates an SLA rule */
  setSlaRule(rule: SlaTriggerRule): void {
    const existingIndex = this.schema.slaRules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.schema.slaRules[existingIndex] = rule;
    } else {
      this.schema.slaRules.push(rule);
    }
    this.schema.updatedAt = Date.now();
    this.evaluateSlaRules();
  }

  /** Insert or update a row, computing formulas and checking SLA triggers */
  setRow(idOrValues: string | Record<string, unknown>, rawValues?: Record<string, unknown>): TableRow {
    const id = typeof idOrValues === "string" ? idOrValues : randomUUID();
    const values = typeof idOrValues === "string" ? (rawValues ?? {}) : idOrValues;

    const existing = this.rows.get(id);
    const row: TableRow = {
      id,
      values: { ...existing?.values, ...values },
      computed: {},
      errors: {},
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    this.computeRowFormulas(row);
    this.rows.set(id, row);
    this.evaluateRowSla(row);

    return row;
  }

  /** Batch insert rows */
  setRows(rows: Record<string, unknown>[]): TableRow[] {
    return rows.map((r) => {
      const rowId = typeof r.id === "string" ? r.id : randomUUID();
      return this.setRow(rowId, r);
    });
  }

  getRow(id: string): TableRow | undefined {
    return this.rows.get(id);
  }

  deleteRow(id: string): boolean {
    const deleted = this.rows.delete(id);
    if (deleted) {
      this.alerts = this.alerts.filter((a) => a.rowId !== id);
    }
    return deleted;
  }

  getRows(): TableRow[] {
    return Array.from(this.rows.values());
  }

  getAlerts(): SlaAlert[] {
    return this.alerts;
  }

  /** Computes all formula columns for a specific row */
  private computeRowFormulas(row: TableRow): void {
    const { sorted, circularError } = sortColumnsByDependency(this.schema.columns);
    row.computed = {};
    row.errors = {};

    if (circularError) {
      row.errors._schema = circularError;
      return;
    }

    // Build context with raw values and name-to-value aliases
    const context: Record<string, unknown> = {};
    for (const col of this.schema.columns) {
      const raw = row.values[col.id] ?? row.values[col.name] ?? col.defaultValue ?? null;
      context[col.id] = raw;
      context[col.name] = raw;
    }

    // Evaluate formula columns in topological order
    for (const col of sorted) {
      if (col.type === "formula" && col.formula) {
        const result = evaluateFormula(col.formula, context);
        if (result && typeof result === "object" && "error" in result) {
          row.errors[col.id] = (result as { error: string }).error;
          row.computed[col.id] = null;
        } else {
          row.computed[col.id] = result;
          context[col.id] = result;
          context[col.name] = result;
        }
      }
    }
  }

  /** Recalculates all rows when formulas or columns change */
  recalculateAll(): void {
    for (const row of this.rows.values()) {
      this.computeRowFormulas(row);
    }
    this.evaluateSlaRules();
  }

  /** Evaluates SLA rules against all rows */
  private evaluateSlaRules(): void {
    this.alerts = [];
    for (const row of this.rows.values()) {
      this.evaluateRowSla(row);
    }
  }

  /** Evaluates SLA rules for a single row */
  private evaluateRowSla(row: TableRow): void {
    this.alerts = this.alerts.filter((a) => a.rowId !== row.id);

    const context: Record<string, unknown> = {
      ...row.values,
      ...row.computed,
    };
    for (const col of this.schema.columns) {
      const val = row.computed?.[col.id] ?? row.values[col.id] ?? row.values[col.name];
      context[col.id] = val;
      context[col.name] = val;
    }

    for (const rule of this.schema.slaRules) {
      try {
        const result = evaluateFormula(rule.condition, context);
        if (result === true || (typeof result === "number" && result > 0)) {
          this.alerts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            rowId: row.id,
            message: rule.alertMessage,
            triggeredAt: Date.now(),
            rowSnapshot: context,
          });
        }
      } catch {
        // Skip malformed SLA condition
      }
    }
  }

  /** Computes table-wide summary row (aggregations: SUM, AVG, MIN, MAX, COUNT) */
  computeSummary(aggregations?: AggregationConfig): Record<string, number | string> {
    const config = aggregations ?? this.schema.defaultAggregations ?? {};
    const rows = this.getRows();
    const summary: Record<string, number | string> = {};

    for (const col of this.schema.columns) {
      const fn = config[col.name] ?? config[col.id];
      if (!fn) {
        summary[col.name] = "-";
        continue;
      }

      if (fn === "COUNT") {
        summary[col.name] = rows.length;
        continue;
      }

      const numbers: number[] = [];
      for (const row of rows) {
        const val = row.computed?.[col.id] ?? row.values[col.id] ?? row.values[col.name];
        if (typeof val === "number" && Number.isFinite(val)) {
          numbers.push(val);
        }
      }

      if (numbers.length === 0) {
        summary[col.name] = 0;
        continue;
      }

      if (fn === "SUM") {
        const sum = numbers.reduce((a, b) => a + b, 0);
        summary[col.name] = Math.round(sum * 1_000_000) / 1_000_000;
      } else if (fn === "AVG") {
        const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        summary[col.name] = Math.round(avg * 1_000_000) / 1_000_000;
      } else if (fn === "MIN") {
        summary[col.name] = Math.min(...numbers);
      } else if (fn === "MAX") {
        summary[col.name] = Math.max(...numbers);
      }
    }

    return summary;
  }

  /** Exports table data as Markdown table string, including optional summary footer */
  toMarkdown(aggregations?: AggregationConfig): string {
    const cols = this.schema.columns;
    if (cols.length === 0) return "*(Empty table schema)*";

    const header = `| ${cols.map((c) => c.name).join(" | ")} |`;
    const separator = `| ${cols.map(() => "---").join(" | ")} |`;

    const rowLines = this.getRows().map((row) => {
      const cells = cols.map((c) => {
        const val = row.computed?.[c.id] ?? row.values[c.id] ?? row.values[c.name] ?? "-";
        return String(val);
      });
      return `| ${cells.join(" | ")} |`;
    });

    const summary = this.computeSummary(aggregations);
    const hasSummary = Object.values(summary).some((v) => v !== "-");
    if (hasSummary) {
      const summaryLine = `| ${cols.map((c) => `**${summary[c.name] ?? "-"}**`).join(" | ")} |`;
      return [header, separator, ...rowLines, separator, summaryLine].join("\n");
    }

    return [header, separator, ...rowLines].join("\n");
  }

  /** Syncs virtual table to workspace DuckDB */
  async syncToDuckDb(duckDbPool = getDuckDbPool()): Promise<{ inserted: number; tableName: string }> {
    const cols: IngestColumn[] = this.schema.columns.map((c) => {
      let duckType: IngestColumn["type"] = "VARCHAR";
      if (c.type === "number" || c.type === "formula") duckType = "DOUBLE";
      else if (c.type === "boolean") duckType = "BOOLEAN";
      else if (c.type === "date") duckType = "DATE";
      return {
        name: c.name,
        type: duckType,
      };
    });

    const rowsToInsert = this.getRows().map((row) => {
      const obj: Record<string, unknown> = {};
      for (const col of this.schema.columns) {
        const val = row.computed?.[col.id] ?? row.values[col.id] ?? row.values[col.name] ?? null;
        obj[col.name] = val;
      }
      return obj;
    });

    const res = await duckDbPool.ingestTable(
      this.schema.workspaceId,
      this.schema.name,
      cols,
      rowsToInsert
    );

    return {
      inserted: res.inserted,
      tableName: this.schema.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
    };
  }

  getSnapshot(aggregations?: AggregationConfig): VirtualTableSnapshot {
    return {
      schema: this.schema,
      rows: this.getRows(),
      alerts: this.getAlerts(),
      summary: this.computeSummary(aggregations),
      rowCount: this.rows.size,
    };
  }
}

/** Global Multi-Tenant Virtual Table Manager */
export class VirtualTableManager {
  private tables: Map<string, VirtualTable> = new Map();

  createTable(input: {
    id?: string;
    workspaceId: string;
    name: string;
    description?: string;
    columns: ColumnDef[];
    slaRules?: SlaTriggerRule[];
    defaultAggregations?: AggregationConfig;
  }): VirtualTable {
    const id = input.id ?? randomUUID();
    const schema: VirtualTableSchema = {
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      columns: input.columns,
      slaRules: input.slaRules ?? [],
      defaultAggregations: input.defaultAggregations,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const table = new VirtualTable(schema);
    this.tables.set(id, table);
    return table;
  }

  getTable(id: string): VirtualTable | undefined {
    return this.tables.get(id);
  }

  getWorkspaceTables(workspaceId: string): VirtualTable[] {
    return Array.from(this.tables.values()).filter((t) => t.schema.workspaceId === workspaceId);
  }

  deleteTable(id: string): boolean {
    return this.tables.delete(id);
  }

  clear(): void {
    this.tables.clear();
  }
}

let globalTableManager: VirtualTableManager | null = null;

export function getVirtualTableManager(): VirtualTableManager {
  if (!globalTableManager) {
    globalTableManager = new VirtualTableManager();
  }
  return globalTableManager;
}
