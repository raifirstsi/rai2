import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { distinctNewBotAvatarUrl, isRaiMascotUrl, pickUnusedRaiMascotUrl, RAI_MASCOT_LIBRARY } from "./mascot-library.ts";

describe("RAI mascot library", () => {
  it("contains fifteen unique app-owned images", () => {
    expect(RAI_MASCOT_LIBRARY).toHaveLength(15);
    expect(new Set(RAI_MASCOT_LIBRARY.map((mascot) => mascot.id)).size).toBe(15);
    expect(new Set(RAI_MASCOT_LIBRARY.map((mascot) => mascot.url)).size).toBe(15);
    expect(RAI_MASCOT_LIBRARY.every((mascot) => isRaiMascotUrl(mascot.url))).toBe(true);
    expect(RAI_MASCOT_LIBRARY.every((mascot) => existsSync(join(process.cwd(), "public", mascot.url.slice(1))))).toBe(true);
  });

  it("uses every unused mascot before reusing one", () => {
    const bots: Array<{ avatarUrl?: string }> = [];
    for (let index = 0; index < RAI_MASCOT_LIBRARY.length; index += 1) {
      const avatarUrl = pickUnusedRaiMascotUrl(bots, () => 0.999);
      expect(bots.some((bot) => bot.avatarUrl === avatarUrl)).toBe(false);
      bots.push({ avatarUrl });
    }
    expect(new Set(bots.map((bot) => bot.avatarUrl)).size).toBe(15);
    expect(isRaiMascotUrl(pickUnusedRaiMascotUrl(bots, () => 0))).toBe(true);
  });

  it("keeps a unique request and replaces only a duplicate mascot", () => {
    const first = RAI_MASCOT_LIBRARY[0].url;
    const second = RAI_MASCOT_LIBRARY[1].url;
    expect(distinctNewBotAvatarUrl(second, [{ avatarUrl: first }], () => 0)).toBe(second);
    expect(distinctNewBotAvatarUrl(first, [{ avatarUrl: first }], () => 0)).toBe(second);
    expect(distinctNewBotAvatarUrl("/api/attachments/custom.png", [{ avatarUrl: first }], () => 0))
      .toBe("/api/attachments/custom.png");
  });
});
