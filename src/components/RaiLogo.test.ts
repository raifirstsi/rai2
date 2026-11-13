// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applySkin, type SkinId } from "@/lib/skins";
import { RaiLogo } from "./RaiLogo";

let host: HTMLDivElement;
let root: Root;
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("rai-default-white-v2", "1");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  document.documentElement.removeAttribute("data-skin");
});

function renderSkin(skin: SkinId) {
  applySkin(skin);
  flushSync(() => root.render(createElement(RaiLogo)));
  const white = host.querySelector<HTMLImageElement>('img[src*="rai-core-white.png"]');
  const black = host.querySelector<HTMLImageElement>('img[src*="rai-core-black.png"]');
  expect(white).not.toBeNull();
  expect(black).not.toBeNull();
  return { white: white!, black: black! };
}

describe("RaiLogo", () => {
  it("does not let the class fallback override an explicit skin", () => {
    expect(css).not.toContain("html:not(.dark) .rai-logo-light");
    expect(css).not.toContain("html:not(.dark) .rai-logo-dark");
    expect(css).toContain(':root:not(.dark):not([data-theme]):not([data-skin]) .rai-logo-light');
    expect(css).toContain(':root:not(.dark):not([data-theme]):not([data-skin]) .rai-logo-dark');
  });

  it.each(["midnight", "foundry", "graphite", "dusk", "aurora"] as const)(
    "uses the white artwork in the %s skin",
    (skin) => {
      const { white, black } = renderSkin(skin);
      expect(white.classList).toContain("block");
      expect(white.classList).not.toContain("hidden");
      expect(black.classList).toContain("hidden");
    },
  );

  it.each(["daylight", "atelier", "lagoon", "linen", "meadow", "pop"] as const)(
    "uses the black artwork in the %s skin",
    (skin) => {
      const { white, black } = renderSkin(skin);
      expect(white.classList).toContain("hidden");
      expect(black.classList).toContain("block");
      expect(black.classList).not.toContain("hidden");
    },
  );
});
