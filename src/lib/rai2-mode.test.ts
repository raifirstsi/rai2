import { describe, it, expect, beforeEach } from "vitest";
import {
  readRai2Mode,
  setRai2Mode,
  RAI2_OPERATING_MODE_KEY,
} from "./rai2-mode";

describe("rai2-mode - Dual Operating Mode Manager", () => {
  beforeEach(() => {
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

  it("switches back to enterprise mode", () => {
    setRai2Mode("creator");
    expect(readRai2Mode()).toBe("creator");

    setRai2Mode("enterprise");
    expect(readRai2Mode()).toBe("enterprise");
    expect(globalThis.localStorage.getItem(RAI2_OPERATING_MODE_KEY)).toBe("enterprise");
  });
});
