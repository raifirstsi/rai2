#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const customer = args.customer?.trim();
const domain = args.domain?.trim();
if (!customer || !domain) {
  console.error("Usage: node scripts/package-rai2-custom-handover.mjs --customer <Name> --domain <ai.corp.vn> [--days 365] [--max-bots 50] [--admin-emails ceo@corp.vn]");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const issueOut = execFileSync(
  process.execPath,
  [
    join(root, "scripts/issue-rai2-custom-license.mjs"),
    "--customer", customer,
    "--domain", domain,
    "--days", args.days || "365",
    ...(args["max-bots"] ? ["--max-bots", args["max-bots"]] : []),
  ],
  { encoding: "utf8" },
);

const keyLine = issueOut.split(/\r?\n/).find((l) => l.startsWith("RAI2_LICENSE_KEY="));
if (!keyLine) throw new Error("Failed to extract RAI2_LICENSE_KEY");
const licenseKey = keyLine.slice("RAI2_LICENSE_KEY=".length).trim();

const slug = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
const outDir = join(root, "release", `rai2-custom-${slug}`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, "deploy/rai2-custom"), outDir, { recursive: true });
const composePath = join(outDir, "docker-compose.yml");
const composeRaw = readFileSync(composePath, "utf8");
writeFileSync(
  composePath,
  composeRaw.replace(/\s*build:\n\s*context: \.\.\/\.\.\n\s*dockerfile: deploy\/rai2-custom\/Dockerfile\n/, "\n"),
);

const envContent = [
  `DOMAIN=${domain}`,
  `OMB_SERVER_NAME=RAI2 Enterprise - ${customer}`,
  `RAI2_LICENSE_KEY=${licenseKey}`,
  `OMB_SIGNIN_EMAILS=${args["admin-emails"] || ""}`,
  `OMB_SIGNIN_SMTP_URL=`,
  `OMB_SIGNIN_SMTP_FROM=ai-noreply@${domain}`,
  `LOCAL_LLM_URL=`,
  `LOCAL_LLM_API_KEY=`,
  "",
].join("\n");
writeFileSync(join(outDir, ".env"), envContent, { mode: 0o600 });

const sbomFiles = existsSync(join(root, "release"))
  ? execFileSync("bash", ["-c", `ls -t "${join(root, "release")}"/*.cdx.json 2>/dev/null | head -n 1 || true`], { encoding: "utf8" }).trim()
  : "";
if (sbomFiles && existsSync(sbomFiles)) {
  writeFileSync(join(outDir, "sbom.cdx.json"), readFileSync(sbomFiles));
}

console.log(`=== CUSTOM HANDOVER BUNDLE READY ===`);
console.log(`Directory: ${outDir}`);
console.log(`Customer : ${customer}`);
console.log(`Domain   : ${domain}`);
