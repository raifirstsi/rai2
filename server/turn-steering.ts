/**
 * Module 32: Mid-Run Turn Steering for RAI2
 * Allows operators and users to dynamically inject steer directives or cancel/redirect
 * an ongoing bot turn without killing the process or corrupting the transcript.
 */

export type SteeringAction = "redirect" | "pause" | "cancel" | "inject_context";

export interface TurnSteerDirective {
  steerId: string;
  turnId: string;
  action: SteeringAction;
  instruction?: string;
  injectedAt: number;
}

export type SteerHandler = (directive: TurnSteerDirective) => void | Promise<void>;

export class TurnSteeringManager {
  private directives = new Map<string, TurnSteerDirective[]>();
  private handlers = new Set<SteerHandler>();

  public submitSteer(turnId: string, action: SteeringAction, instruction?: string): TurnSteerDirective {
    // Auto-prune stale directives if map is getting large
    if (this.directives.size > 50) {
      this.cleanupStale();
    }

    const steerId = `steer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const directive: TurnSteerDirective = {
      steerId,
      turnId,
      action,
      instruction,
      injectedAt: Date.now()
    };

    const existing = this.directives.get(turnId) ?? [];
    existing.push(directive);
    this.directives.set(turnId, existing);

    // Notify registered handlers asynchronously
    for (const handler of this.handlers) {
      try {
        void handler(directive);
      } catch (err) {
        console.warn(`[TurnSteering] handler failed:`, err);
      }
    }

    return directive;
  }

  public registerHandler(handler: SteerHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public consumeDirectives(turnId: string): TurnSteerDirective[] {
    const list = this.directives.get(turnId);
    if (!list || list.length === 0) return [];
    this.directives.delete(turnId);
    return list;
  }

  public hasPendingSteer(turnId: string): boolean {
    const list = this.directives.get(turnId);
    return Boolean(list && list.length > 0);
  }

  public getDirectivesCount(): number {
    let count = 0;
    for (const list of this.directives.values()) {
      count += list.length;
    }
    return count;
  }

  /**
   * Prunes directives older than maxAgeMs (default 5 minutes) to prevent memory leaks.
   */
  public cleanupStale(maxAgeMs = 300_000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [turnId, list] of this.directives.entries()) {
      const fresh = list.filter((d) => now - d.injectedAt <= maxAgeMs);
      cleaned += list.length - fresh.length;
      if (fresh.length === 0) {
        this.directives.delete(turnId);
      } else if (fresh.length !== list.length) {
        this.directives.set(turnId, fresh);
      }
    }
    return cleaned;
  }
}

let globalSteeringManager: TurnSteeringManager | null = null;
export function getTurnSteeringManager(): TurnSteeringManager {
  if (!globalSteeringManager) {
    globalSteeringManager = new TurnSteeringManager();
  }
  return globalSteeringManager;
}
