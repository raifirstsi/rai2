export type ColumnType = "text" | "number" | "boolean" | "date" | "formula";

export interface ColumnDef {
  id: string;
  name: string;
  type: ColumnType;
  formula?: string; // e.g. "[Revenue] - [Cost]" or "IF([Revenue] > 1000, 0.1, 0.05)"
  defaultValue?: unknown;
  required?: boolean;
}

export interface TableRow {
  id: string;
  values: Record<string, unknown>; // raw values by column id
  computed?: Record<string, unknown>; // formula computed values by column id
  errors?: Record<string, string>; // evaluation errors by column id
  createdAt: number;
  updatedAt: number;
}

export type SlaSeverity = "info" | "warning" | "critical";

export interface SlaTriggerRule {
  id: string;
  name: string;
  severity: SlaSeverity;
  condition: string; // e.g. "[margin] < 20" or "[status] == 'delayed' && [days] > 3"
  alertMessage: string;
}

export interface SlaAlert {
  ruleId: string;
  ruleName: string;
  severity: SlaSeverity;
  rowId: string;
  message: string;
  triggeredAt: number;
  rowSnapshot: Record<string, unknown>;
}

export type AggregationFunction = "SUM" | "AVG" | "MIN" | "MAX" | "COUNT";

export interface AggregationConfig {
  [columnNameOrId: string]: AggregationFunction;
}

export interface VirtualTableSchema {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  columns: ColumnDef[];
  slaRules: SlaTriggerRule[];
  defaultAggregations?: AggregationConfig;
  createdAt: number;
  updatedAt: number;
}

export interface VirtualTableSnapshot {
  schema: VirtualTableSchema;
  rows: TableRow[];
  alerts: SlaAlert[];
  summary?: Record<string, number | string>;
  rowCount: number;
}
