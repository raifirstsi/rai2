import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const source = JSON.parse(readFileSync(join(root, "compliance", "rai2-source.json"), "utf8"));
const assets = JSON.parse(readFileSync(join(root, "compliance", "assets.json"), "utf8"));
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
};
const fail = (message) => { throw new Error(`RAI2 compliance: ${message}`); };
const normalized = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

for (const path of source.restrictedPaths) {
  if (existsSync(join(root, path))) fail(`restricted source is present: ${path}`);
}
for (const path of [
  "capybara_files.json", "drive_files.json", "drive_folder.html", "download_all_mascots.py",
  "find_ids.py", "get_drive_files.py", "inspect_drive.py", "parse_drive.py",
]) {
  if (existsSync(join(root, path))) fail(`asset acquisition scratch file is present: ${path}`);
}

const license = normalized("LICENSE");
const licenseHash = createHash("sha256").update(license).digest("hex");
if (licenseHash !== "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30") {
  fail("root LICENSE is not the reviewed Apache License 2.0 text");
}
const notice = normalized("NOTICE");
for (const text of [
  "OpenMausBot\nCopyright 2026 Milind Soni and OpenMausBot contributors",
  "RAI2 is a modified distribution developed by RAI FIRST in 2026.",
  "RAI2 does not claim ownership of their work.",
  "Streaming reply rendering (src/state/live-reply.ts)",
  "The updatable model manifest (server/model-manifest/)",
]) {
  if (!notice.includes(text)) fail(`NOTICE is missing: ${text.replaceAll("\n", " ")}`);
}
const app = JSON.parse(normalized("package.json"));
if (app.license !== source.coreLicense) fail(`package.json license must be ${source.coreLicense}`);

for (const path of [
  "third_party/cache-tax/LICENSE", "third_party/cua-driver/LICENSE.md", "third_party/elkjs/LICENSE.md",
  "third_party/hpke-js/common-LICENSE.txt", "third_party/hpke-js/core-LICENSE.txt", "third_party/khroma/LICENSE",
  "third_party/minimock/LICENSE", "third_party/models-dev/LICENSE", "third_party/onepassword-sdk/LICENSE",
  "third_party/opencode/LICENSE", "third_party/playwright-injected/LICENSE", "third_party/provider-icons/LICENSE-Lobe-Icons.txt",
  "third_party/puppeteer/LICENSE", "third_party/t3-code/LICENSE", "third_party/vexa/LICENSE",
]) {
  if (!existsSync(join(root, path))) fail(`reviewed third-party license is missing: ${path}`);
}

const inventoriedAssets = assets.entries.flatMap((entry) => entry.paths).sort();
for (const path of inventoriedAssets) {
  if (!existsSync(join(root, path))) fail(`asset inventory names a missing file: ${path}`);
}

const hasBase = spawnSync("git", ["merge-base", "--is-ancestor", source.baseCommit, "HEAD"], { cwd: root }).status === 0;
let changedAssets = inventoriedAssets;
let modifications = normalized("compliance/MODIFIED_FILES.md");
let modifiedCount = modifications.split("\n").filter((line) => line.startsWith("- `")).length;
if (hasBase) {
  const diff = run("git", ["diff", "--name-only", "--diff-filter=AM", source.baseCommit]);
  changedAssets = diff.split(/\r?\n/)
    .filter((path) => !path.startsWith("artifacts/"))
    .filter((path) => /\.(?:gif|ico|jpe?g|otf|png|svg|ttf|webp|woff2)$/i.test(path)).sort();
  const missingAssets = changedAssets.filter((path) => !inventoriedAssets.includes(path));
  if (missingAssets.length) fail(`asset rights inventory is missing:\n${missingAssets.join("\n")}`);
  const modified = run("git", ["diff", "--name-only", "--diff-filter=M", source.baseCommit])
    .split(/\r?\n/).filter(Boolean).sort();
  modifiedCount = modified.length;
  modifications = [
    "# RAI2 modified files",
    "",
    `RAI2 is derived from OpenMausBot at \`${source.baseCommit}\`. The following upstream files are modified in this source tree:`,
    "",
    ...modified.map((path) => `- \`${path}\``),
    "",
  ].join("\n");
}

const pnpm = process.env.npm_execpath;
if (!pnpm) fail("run the compliance gate through pnpm so the package manager version is pinned");
const licenses = JSON.parse(run(process.execPath, [pnpm, "licenses", "list", "--prod", "--json"]));
const reviewed = new Set(source.reviewedDependencyLicenseExpressions);
const dependencyRows = [];
const platformBinary = /(?:^|[-/])(?:android|darwin|freebsd|linux(?:musl)?|win32)-(?:arm|arm64|ia32|ppc64|riscv64|s390x|x64)(?:-(?:gnu|musl|msvc))?$/;
for (const [expression, packages] of Object.entries(licenses)) {
  if (expression !== "Unknown" && !reviewed.has(expression)) fail(`unreviewed dependency license expression: ${expression}`);
  for (const dependency of packages) {
    if (expression === "Unknown") {
      const versions = source.reviewedUnknownDependencies[dependency.name];
      if (!versions || dependency.versions.some((version) => !versions.includes(version))) {
        fail(`dependency has an unreviewed unknown license: ${dependency.name}@${dependency.versions.join(",")}`);
      }
    }
    if (!platformBinary.test(dependency.name)) {
      dependencyRows.push({ name: dependency.name, versions: [...dependency.versions].sort(), license: expression });
    }
  }
}
dependencyRows.sort((a, b) => a.name.localeCompare(b.name) || a.versions.join(",").localeCompare(b.versions.join(",")));
const dependencyReport = `${JSON.stringify({ scope: "portable pnpm production dependency graph; platform binaries remain license-gated and are recorded in each artifact SBOM", dependencies: dependencyRows }, null, 2)}\n`;

const outputs = new Map([
  [join(root, "compliance", "MODIFIED_FILES.md"), modifications],
  [join(root, "compliance", "dependency-licenses.json"), dependencyReport],
]);
for (const [path, expected] of outputs) {
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected);
  } else if (!existsSync(path) || readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== expected) {
    fail(`${relative(root, path)} is stale; run pnpm compliance:rai2 -- --write`);
  }
}

console.log(`RAI2 compliance checks passed: OSS-only source, ${modifiedCount} modified upstream files, ${changedAssets.length} reviewed assets, ${dependencyRows.length} dependency records`);
