export interface TrackedTask {
  id: string;
  tenantId: string;
  createdAt: number;
  lastActiveAt: number;
  timeoutMs: number;
  abortController?: AbortController;
}

export class RunReaper {
  private tasks = new Map<string, TrackedTask>();
  private reapInterval: NodeJS.Timeout | null = null;
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = 120_000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  public register(id: string, tenantId: string, abortController?: AbortController, timeoutMs?: number): void {
    const now = Date.now();
    this.tasks.set(id, {
      id,
      tenantId,
      createdAt: now,
      lastActiveAt: now,
      timeoutMs: timeoutMs || this.defaultTimeoutMs,
      abortController,
    });
  }

  public touch(id: string): void {
    const task = this.tasks.get(id);
    if (task) task.lastActiveAt = Date.now();
  }

  public finish(id: string): void {
    this.tasks.delete(id);
  }

  public reapStale(): string[] {
    const now = Date.now();
    const reapedIds: string[] = [];
    for (const [id, task] of this.tasks.entries()) {
      if (now - task.lastActiveAt > task.timeoutMs) {
        if (task.abortController) {
          try { task.abortController.abort(new Error('Task reaped due to inactivity')); } catch {}
        }
        this.tasks.delete(id);
        reapedIds.push(id);
      }
    }
    return reapedIds;
  }

  public startPeriodic(intervalMs = 15_000): void {
    if (this.reapInterval) return;
    this.reapInterval = setInterval(() => { this.reapStale(); }, intervalMs);
    this.reapInterval.unref();
  }

  public stopPeriodic(): void {
    if (this.reapInterval) {
      clearInterval(this.reapInterval);
      this.reapInterval = null;
    }
  }
}
