import { createHash } from 'node:crypto';

export interface ToolCallSignature {
  name: string;
  args: Record<string, unknown> | string;
}

export interface LoopGuardDecision {
  allowed: boolean;
  repeatCount: number;
  action: 'proceed' | 'warn' | 'block';
  reason?: string;
}

export class ToolLoopGuard {
  private history: string[] = [];
  private readonly softLimit: number;
  private readonly hardLimit: number;
  private readonly maxHistorySize: number;

  constructor(softLimit = 3, hardLimit = 5, maxHistorySize = 500) {
    this.softLimit = softLimit;
    this.hardLimit = hardLimit;
    this.maxHistorySize = maxHistorySize;
  }

  private hashCall(call: ToolCallSignature): string {
    const serializedArgs = typeof call.args === 'string' ? call.args : JSON.stringify(call.args, Object.keys(call.args).sort());
    return createHash('sha256')
      .update(call.name + ':' + serializedArgs)
      .digest('hex');
  }

  public recordAndCheck(call: ToolCallSignature): LoopGuardDecision {
    const hash = this.hashCall(call);
    this.history.push(hash);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const count = this.history.filter((h) => h === hash).length;

    if (count >= this.hardLimit) {
      return {
        allowed: false,
        repeatCount: count,
        action: 'block',
        reason: '[LoopGuard Hard-Stop] Lệnh ' + call.name + ' đã bị gọi lặp lại ' + count + ' lần liên tiếp với cùng tham số. Turn đã bị dừng để bảo vệ token.',
      };
    }

    if (count >= this.softLimit) {
      return {
        allowed: true,
        repeatCount: count,
        action: 'warn',
        reason: '[LoopGuard Soft-Warning] Cảnh báo: Lệnh ' + call.name + ' đang bị gọi lặp lại lần thứ ' + count + '. Hãy đổi chiến lược giải quyết.',
      };
    }

    return {
      allowed: true,
      repeatCount: count,
      action: 'proceed',
    };
  }

  public reset(): void {
    this.history = [];
  }
}
