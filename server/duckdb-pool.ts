import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let cachedDuckDbModule: any = null;

export async function getDuckDbModule(): Promise<any> {
  if (!cachedDuckDbModule) {
    try {
      const req = createRequire(import.meta.url);
      const pkg = "@duckdb/node-api";
      cachedDuckDbModule = req(pkg);
    } catch {
      try {
        const pkg = "@duckdb/node-api";
        cachedDuckDbModule = await import(pkg);
      } catch (err: any) {
        throw new Error(`DuckDB native engine not available: ${err?.message || err}`);
      }
    }
  }
  return cachedDuckDbModule;
}

export interface DuckDbPoolOptions {
  baseDir?: string;
  maxIdleTimeMs?: number;
}

export interface DuckDbQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export interface IngestColumn {
  name: string;
  type: "VARCHAR" | "INTEGER" | "BIGINT" | "DOUBLE" | "BOOLEAN" | "DATE" | "TIMESTAMP";
}

/** Converts BigInt, DuckDB special objects, etc. to JSON-safe primitives */
function serializeDuckDbValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "object") {
    // Check DuckDB Date/Decimal/Timestamp objects
    const obj = val as Record<string, unknown>;
    if ("days" in obj && typeof obj.days === "number") {
      // Days since 1970-01-01
      const d = new Date(obj.days * 86_400_000);
      return d.toISOString().split("T")[0];
    }
    if ("micros" in obj && (typeof obj.micros === "bigint" || typeof obj.micros === "number")) {
      const ms = Number(obj.micros) / 1000;
      return new Date(ms).toISOString();
    }
    if ("value" in obj && typeof obj.value === "bigint" && "scale" in obj && typeof obj.scale === "number") {
      // DuckDBDecimalValue
      return Number(obj.value) / Math.pow(10, obj.scale);
    }
    return JSON.parse(JSON.stringify(val, (_, v) => typeof v === "bigint" ? Number(v) : v));
  }
  return val;
}

export class TenantDuckDbSession {
  private instance: any = null;
  private connection: any = null;
  public lastActiveAt: number = Date.now();
  public readonly workspaceId: string;
  public readonly dbPath: string;

  constructor(workspaceId: string, dbPath: string) {
    this.workspaceId = workspaceId;
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    if (!this.instance) {
      const { DuckDBInstance } = await getDuckDbModule();
      try {
        this.instance = await DuckDBInstance.create(this.dbPath);
      } catch (err: any) {
        // If file locking or disk error occurs, gracefully fallback to in-memory instance
        if (this.dbPath !== ":memory:") {
          console.warn(`[DuckDBPool] Failed to open ${this.dbPath}, falling back to in-memory: ${err?.message}`);
          this.instance = await DuckDBInstance.create(":memory:");
        } else {
          throw err;
        }
      }
      this.connection = await this.instance.connect();
    }
    this.lastActiveAt = Date.now();
  }

  async runQuery(sql: string, params?: unknown[]): Promise<DuckDbQueryResult> {
    await this.init();
    if (!this.connection) throw new Error("DuckDB connection not initialized");

    const start = performance.now();
    let res;
    if (params && params.length > 0) {
      const stmt = await this.connection.prepare(sql);
      stmt.bind(params as any);
      res = await stmt.run();
    } else {
      res = await this.connection.run(sql);
    }

    const duration = Math.round((performance.now() - start) * 100) / 100;
    const colNames = typeof res.columnNames === "function" ? res.columnNames() : (((res.columnNames as unknown) as string[]) || []);
    const rawRows = await res.getRows();

    const rows: Record<string, unknown>[] = rawRows.map((rawRow: unknown[]) => {
      const rowObj: Record<string, unknown> = {};
      for (let i = 0; i < colNames.length; i++) {
        rowObj[colNames[i]] = serializeDuckDbValue(rawRow[i]);
      }
      return rowObj;
    });

    this.lastActiveAt = Date.now();
    return {
      columns: colNames,
      rows,
      rowCount: rows.length,
      executionTimeMs: duration
    };
  }

  async ingest(tableName: string, columns: IngestColumn[], rows: Record<string, unknown>[]): Promise<{ inserted: number; tableName: string }> {
    await this.init();
    if (!this.connection) throw new Error("DuckDB connection not initialized");

    // Sanitize table and column names to prevent SQL injection
    const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    const colDefs = columns.map(c => `"${c.name.replace(/"/g, '""')}" ${c.type}`).join(", ");

    await this.connection.run(`CREATE TABLE IF NOT EXISTS "${safeTable}" (${colDefs})`);

    if (rows.length === 0) return { inserted: 0, tableName: safeTable };

    // Batch insert using parameterized inserts or VALUES chunks
    const colNames = columns.map(c => `"${c.name.replace(/"/g, '""')}"`).join(", ");
    const placeholders = `(${columns.map(() => "?").join(", ")})`;

    const batchSize = 250;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const valueTuples = chunk.map(() => placeholders).join(", ");
      const insertSql = `INSERT INTO "${safeTable}" (${colNames}) VALUES ${valueTuples}`;
      const flatParams: unknown[] = [];

      for (const row of chunk) {
        for (const col of columns) {
          flatParams.push(row[col.name] ?? null);
        }
      }

      const stmt = await this.connection.prepare(insertSql);
      stmt.bind(flatParams as any);
      await stmt.run();
      inserted += chunk.length;
    }

    this.lastActiveAt = Date.now();
    return { inserted, tableName: safeTable };
  }

  async close(): Promise<void> {
    if (this.connection) {
      try {
        await (this.connection as any).close?.();
      } catch {
        // Ignore close errors
      }
      this.connection = null;
    }
    this.instance = null;
  }
}

export class DuckDbPool {
  private sessions = new Map<string, TenantDuckDbSession>();
  private baseDir: string | null;
  private maxIdleTimeMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options?: DuckDbPoolOptions) {
    this.baseDir = options?.baseDir ?? process.env.RAI2_DUCKDB_DIR ?? (process.env.DATA_DIR ? join(process.env.DATA_DIR, "duckdb") : null);
    this.maxIdleTimeMs = options?.maxIdleTimeMs ?? 15 * 60_000; // 15 mins

    if (this.baseDir && !existsSync(this.baseDir)) {
      try {
        mkdirSync(this.baseDir, { recursive: true });
      } catch {
        // Fall back to memory if directory creation not permitted
        this.baseDir = null;
      }
    }

    // Background timer to clean up idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 60_000);
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();
    for (const [wsId, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > this.maxIdleTimeMs) {
        session.close().catch(() => {});
        this.sessions.delete(wsId);
      }
    }
  }

  async getSession(workspaceId: string): Promise<TenantDuckDbSession> {
    let session = this.sessions.get(workspaceId);
    if (!session) {
      const dbPath = this.baseDir ? join(this.baseDir, `tenant_${workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_")}.duckdb`) : ":memory:";
      session = new TenantDuckDbSession(workspaceId, dbPath);
      await session.init();
      this.sessions.set(workspaceId, session);
    }
    return session;
  }

  async query(workspaceId: string, sql: string, params?: unknown[]): Promise<DuckDbQueryResult> {
    const session = await this.getSession(workspaceId);
    return session.runQuery(sql, params);
  }

  async ingestTable(
    workspaceId: string,
    tableName: string,
    columns: IngestColumn[],
    rows: Record<string, unknown>[]
  ): Promise<{ inserted: number; tableName: string }> {
    const session = await this.getSession(workspaceId);
    return session.ingest(tableName, columns, rows);
  }

  async closeWorkspace(workspaceId: string): Promise<void> {
    const session = this.sessions.get(workspaceId);
    if (session) {
      await session.close();
      this.sessions.delete(workspaceId);
    }
  }

  async closeAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const session of this.sessions.values()) {
      await session.close();
    }
    this.sessions.clear();
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}

// Global Singleton for the server instance
let globalPool: DuckDbPool | null = null;

export function getDuckDbPool(options?: DuckDbPoolOptions): DuckDbPool {
  if (!globalPool) {
    globalPool = new DuckDbPool(options);
  }
  return globalPool;
}
