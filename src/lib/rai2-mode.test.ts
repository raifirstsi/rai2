import { describe, it, expect, beforeEach } from "vitest";
import {
  readRai2Mode,
  setRai2Mode,
  syncRai2PlanSnapshot,
  isEnterpriseVipEntitled,
  RAI2_OPERATING_MODE_KEY,
} from "./rai2-mode";

describe("rai2-mode - Dual Operating Mode Manager", () => {
  beforeEach(() => {
    syncRai2PlanSnapshot(null);
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
    (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
    if (typeof globalThis.window === "undefined") {
      (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
        localStorage: mockStorage,
      };
    } else {
      Object.defineProperty(globalThis.window, "localStorage", {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it("defaults to enterprise mode when no choice is stored", () => {
    setRai2Mode("enterprise");
    expect(readRai2Mode()).toBe("enterprise");
  });

  it("switches to creator mode and persists in storage", () => {
    setRai2Mode("creator");
    expect(readRai2Mode()).toBe("creator");
    expect(globalThis.localStorage.getItem(RAI2_OPERATING_MODE_KEY)).toBe("creator");
  });

  it("switches back to enterprise mode when allowed", () => {
    setRai2Mode("creator");
    expect(readRai2Mode()).toBe("creator");

    setRai2Mode("enterprise");
    expect(readRai2Mode()).toBe("enterprise");
    expect(globalThis.localStorage.getItem(RAI2_OPERATING_MODE_KEY)).toBe("enterprise");
  });

  it("locks managed starter accounts to creator mode and unlocks on VIP or trial", () => {
    syncRai2PlanSnapshot({
      managed: true,
      planId: "starter",
      planName: "RAI² Starter (Cá Nhân)",
      entitlement: "paid",
      enterpriseAccess: false,
      paidThrough: Date.now() + 86_400_000,
      trialThrough: 0,
      checkedAt: Date.now(),
    });
    expect(isEnterpriseVipEntitled()).toBe(false);
    expect(readRai2Mode()).toBe("creator");

    // Attempt to bypass to enterprise is blocked
    setRai2Mode("enterprise");
    expect(readRai2Mode()).toBe("creator");

    // Upgrade to VIP unlocks enterprise switching
    syncRai2PlanSnapshot({
      managed: true,
      planId: "vip",
      planName: "RAI² Enterprise VIP",
      entitlement: "paid",
      enterpriseAccess: true,
      paidThrough: Date.now() + 30 * 86_400_000,
      trialThrough: 0,
      checkedAt: Date.now(),
    });
    expect(isEnterpriseVipEntitled()).toBe(true);
    setRai2Mode("enterprise");
    expect(readRai2Mode()).toBe("enterprise");
  });
});

