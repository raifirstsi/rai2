#!/usr/bin/env node
import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const customer = args.customer?.trim();
if (!customer) {
  console.error("Usage: node scripts/issue-rai2-custom-license.mjs --customer <Name> [--days 365] [--max-bots 50] [--domain ai.corp.vn] [--key /etc/rai2/custom-license-private.pem]");
  process.exit(1);
}

const keyPath = args.key || process.env.RAI2_LICENSE_PRIVATE_KEY_FILE || "/etc/rai2/custom-license-private.pem";
const privateKeyPem = readFileSync(keyPath, "utf8");
const days = Math.max(1, Number.parseInt(args.days || "365", 10) || 365);
const maxBots = args["max-bots"] ? Number.parseInt(args["max-bots"], 10) : undefined;
const domain = args.domain?.trim() || undefined;
const now = Date.now();

const payload = {
  v: 1,
  licenseId: `lic_${randomUUID().slice(0, 12)}`,
  customerName: customer,
  plan: "custom",
  issuedAt: now,
  expiresAt: now + days * 86_400_000,
  ...(Number.isFinite(maxBots) ? { maxBots } : {}),
  ...(domain ? { allowedDomain: domain } : {}),
};

const toBase64Url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
const sig = sign(null, Buffer.from(`RAI2C1.${payloadB64}`, "utf8"), createPrivateKey(privateKeyPem));
const token = `RAI2C1.${payloadB64}.${toBase64Url(sig)}`;

console.log("=== RAI2 CUSTOM LICENSE ISSUED ===");
console.log("Customer :", payload.customerName);
console.log("LicenseID:", payload.licenseId);
console.log("Expires  :", new Date(payload.expiresAt).toISOString());
if (payload.allowedDomain) console.log("Domain   :", payload.allowedDomain);
if (payload.maxBots) console.log("Max Bots :", payload.maxBots);
console.log("\nRAI2_LICENSE_KEY=" + token);
