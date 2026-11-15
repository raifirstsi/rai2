import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AutonomyTierBadge } from "./BotRole";
import { botTooltip } from "./BotModelBadge";
import { getBotAutonomyTier, saveAutonomyProfiles, createDefaultBotProfile } from "@/lib/autonomy-graduation";
import type { Bot, InstanceInfo } from "@/state/store";

describe("AutonomyTierBadge & Sidebar Integration", () => {
  let memoryStore: Record<string, string> = {};

  beforeEach(() => {
    memoryStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, value: string) => {
        memoryStore[key] = value;
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
      clear: () => {
        memoryStore = {};
      },
    };

    (globalThis as unknown as { window: { localStorage: typeof mockLocalStorage } }).window = {
      localStorage: mockLocalStorage,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("defaults to T1 · 50% for bots without saved profile", () => {
    const tierMeta = getBotAutonomyTier("unknown-bot");
    expect(tierMeta.code).toBe("T1");
    expect(tierMeta.autonomyPct).toBe(50);

    const markup = renderToStaticMarkup(createElement(AutonomyTierBadge, { botId: "unknown-bot" }));
    expect(markup).toContain("T1 · 50%");
    expect(markup).toContain('data-testid="autonomy-tier-badge"');
  });

  it("renders T3 · 95% when bot has graduated to autonomous tier", () => {
    const profile = createDefaultBotProfile("bot-autonomous", "Bot C-Suite", 1);
    profile.currentTier = "TIER_3_AUTONOMOUS";
    saveAutonomyProfiles({ "bot-autonomous": profile });

    const tierMeta = getBotAutonomyTier("bot-autonomous");
    expect(tierMeta.code).toBe("T3");
    expect(tierMeta.autonomyPct).toBe(95);

    const markup = renderToStaticMarkup(createElement(AutonomyTierBadge, { botId: "bot-autonomous" }));
    expect(markup).toContain("T3 · 95%");
    expect(markup).toContain("Tự Hành Hoàn Toàn");
  });

  it("includes autonomy tier in botTooltip for compact and rail views", () => {
    const profile = createDefaultBotProfile("bot-copilot", "Rai Copilot", 2);
    profile.currentTier = "TIER_2_COPILOT";
    saveAutonomyProfiles({ "bot-copilot": profile });

    const mockBot: Pick<Bot, "id" | "name" | "title" | "chiefOfStaff" | "modelSelection"> = {
      id: "bot-copilot",
      name: "Rai Copilot",
      title: "Chuyên viên Tác vụ",
      chiefOfStaff: false,
      modelSelection: { instanceId: "claude", model: "sonnet" },
    };

    const mockInstances: InstanceInfo[] = [{
      instanceId: "claude",
      driverKind: "claudeAgent",
      displayName: "Claude",
      snapshot: { state: "available" },
      models: { default: "sonnet", options: [{ id: "sonnet", label: "Sonnet 3.5" }] },
    }];

    const tooltip = botTooltip(mockBot, mockInstances);
    expect(tooltip).toContain("Rai Copilot");
    expect(tooltip).toContain("T2 (80% Tự trị)");
  });
});
