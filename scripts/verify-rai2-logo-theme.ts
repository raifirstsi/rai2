import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import { openHeadlessChrome } from "./testing/headless-chrome.ts";

const root = join(import.meta.dirname, "..");
const output = process.argv[2];
if (!output || !isAbsolute(output)) throw new Error("Pass an absolute screenshot path");
const cssName = readdirSync(join(root, "dist", "assets")).find((name) => /^styles-.*\.css$/.test(name));
if (!cssName) throw new Error("Build the renderer before verifying the logo");

const html = `<!doctype html><html data-skin="daylight"><head><link rel="stylesheet" href="/styles.css"></head>
<body style="margin:0;background:var(--color-app);display:grid;place-items:center;min-height:240px">
<div style="display:flex;align-items:center;gap:24px;color:var(--color-ink)">
<span style="display:inline-flex;height:52px">
<img class="rai-logo-dark h-full w-auto object-contain hidden" src="/white.png" alt="RAI squared white">
<img class="rai-logo-light h-full w-auto object-contain block" src="/black.png" alt="RAI squared black">
</span><strong id="skin">daylight</strong></div></body></html>`;

const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://fixture").pathname;
  if (path === "/") response.end(html);
  else if (path === "/styles.css") response.end(readFileSync(join(root, "dist", "assets", cssName)));
  else if (path === "/white.png") response.end(readFileSync(join(root, "public", "assets", "rai-core-white.png")));
  else if (path === "/black.png") response.end(readFileSync(join(root, "public", "assets", "rai-core-black.png")));
  else response.writeHead(404).end();
});

const scratch = mkdtempSync(join(tmpdir(), "rai2-logo-theme-"));
const chrome = await openHeadlessChrome(join(scratch, "chrome"));
let cleanupError: unknown;
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  await chrome.send("Page.enable");
  await chrome.send("Emulation.setDeviceMetricsOverride", { width: 800, height: 240, deviceScaleFactor: 1, mobile: false });
  await chrome.send("Page.navigate", { url: `http://127.0.0.1:${address.port}/` });
  await chrome.until("document.readyState === 'complete' && [...document.images].every(image => image.complete)");
  const display = () => chrome.evaluate(`({
    white: getComputedStyle(document.querySelector('.rai-logo-dark')).display,
    black: getComputedStyle(document.querySelector('.rai-logo-light')).display
  })`);
  assert.deepEqual(await display(), { white: "none", black: "block" });
  await chrome.evaluate(`document.documentElement.dataset.skin = "midnight"; document.getElementById("skin").textContent = "midnight"`);
  assert.deepEqual(await display(), { white: "block", black: "none" });
  writeFileSync(output, await chrome.capture());
  console.log(`RAI2 logo theme verified in Chrome: ${output}`);
} finally {
  chrome.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM" || (error as NodeJS.ErrnoException).code === "EBUSY") {
      console.warn(`Chrome released its fixture profile late: ${scratch}`);
    } else {
      cleanupError = error;
    }
  }
}
if (cleanupError) throw cleanupError;
