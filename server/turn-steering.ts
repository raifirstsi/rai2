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

export class TurnSteeringManager {
  private directives = new Map<string, TurnSteerDirective[]>();

  public submitSteer(turnId: string, action: SteeringAction, instruction?: string): TurnSteerDirective {
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
    return directive;
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
}

let globalSteeringManager: TurnSteeringManager | null = null;
export function getTurnSteeringManager(): TurnSteeringManager {
  if (!globalSteeringManager) {
    globalSteeringManager = new TurnSteeringManager();
  }
  return globalSteeringManager;
}
