import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Rai2ModeSwitcher } from "./Rai2ModeSwitcher";
import { setRai2Mode } from "@/lib/rai2-mode";

describe("Rai2ModeSwitcher - Component Rendering", () => {
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

  it("renders dual mode options for creator and enterprise", () => {
    setRai2Mode("enterprise");
    const html = renderToString(React.createElement(Rai2ModeSwitcher, {}));

    expect(html).toContain("data-rai2-mode-switcher");
    expect(html).toContain("Tạo Bot Tự Do");
    expect(html).toContain("Enterprise OS");
  });

  it("renders compact mode for icon rail", () => {
    setRai2Mode("creator");
    const html = renderToString(React.createElement(Rai2ModeSwitcher, { compact: true }));

    expect(html).toContain("data-rai2-mode-switcher");
    expect(html).toContain("Chế độ Tạo Bot Tự Do");
    expect(html).toContain("Chế độ Doanh Nghiệp");
  });
});
