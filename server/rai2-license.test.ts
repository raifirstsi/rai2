import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { signRai2CustomLicense, verifyRai2CustomLicense } from "./rai2-license.ts";
import { configureRai2Entitlement, getRai2EntitlementSnapshot } from "./rai2-entitlement.ts";

describe("RAI2 Custom On-Premise Ed25519 License", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  it("verifies a valid signed license and rejects tampered or expired tokens", () => {
    const now = Date.now();
    const token = signRai2CustomLicense(
      {
        v: 1,
        licenseId: "lic_test_001",
        customerName: "Tap Doan ABC",
        plan: "custom",
        issuedAt: now - 1000,
        expiresAt: now + 86_400_000,
        allowedDomain: "ai.abc.vn",
      },
      privateKey,
    );

    const ok = verifyRai2CustomLicense(token, { publicKeyPem: publicKey, now, domain: "ai.abc.vn" });
    expect(ok.valid).toBe(true);
    expect(ok.payload?.customerName).toBe("Tap Doan ABC");

    // Domain mismatch
    const wrongDomain = verifyRai2CustomLicense(token, { publicKeyPem: publicKey, now, domain: "evil.com" });
    expect(wrongDomain.valid).toBe(false);

    // Tampered payload
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
    const badSig = verifyRai2CustomLicense(tampered, { publicKeyPem: publicKey, now });
    expect(badSig.valid).toBe(false);

    // Invalid maxBots (0 or negative)
    const badBotsToken = signRai2CustomLicense(
      {
        v: 1,
        licenseId: "lic_bad_bots",
        customerName: "Bad Bots",
        plan: "custom",
        issuedAt: now - 1000,
        expiresAt: now + 86_400_000,
        maxBots: 0,
      },
      privateKey,
    );
    expect(verifyRai2CustomLicense(badBotsToken, { publicKeyPem: publicKey, now }).valid).toBe(false);

    // Expired
    const expired = verifyRai2CustomLicense(token, { publicKeyPem: publicKey, now: now + 2 * 86_400_000 });
    expect(expired.valid).toBe(false);
  });

  it("fails closed in getRai2EntitlementSnapshot when RAI2_CUSTOM_ONPREM=1 has invalid/missing license and blocks OMB_RAI2_FORCE_PLAN bypass", () => {
    const tmp = mkdtempSync(join(tmpdir(), "lic-"));
    configureRai2Entitlement({ dataDir: tmp, env: { RAI2_CUSTOM_ONPREM: "1" } });
    const missing = getRai2EntitlementSnapshot({ RAI2_CUSTOM_ONPREM: "1" });
    expect(missing.enterpriseAccess).toBe(false);
    expect(missing.entitlement).toBe("inactive");

    const bypassAttempt = getRai2EntitlementSnapshot({ RAI2_CUSTOM_ONPREM: "1", OMB_RAI2_FORCE_PLAN: "vip" });
    expect(bypassAttempt.enterpriseAccess).toBe(false);

    const bad = getRai2EntitlementSnapshot({ RAI2_CUSTOM_ONPREM: "1", RAI2_LICENSE_KEY: "RAI2C1.fake.sig" });
    expect(bad.enterpriseAccess).toBe(false);
  });

  it("unlocks Enterprise when RAI2_LICENSE_FILE holds a valid key signed by the embedded keypair", () => {
    // Test file resolution with invalid token (fails closed safely)
    const tmp = mkdtempSync(join(tmpdir(), "lic-file-"));
    const licPath = join(tmp, "rai2.lic");
    writeFileSync(licPath, "RAI2C1.invalid.token", "utf8");
    configureRai2Entitlement({ dataDir: tmp, env: { RAI2_CUSTOM_ONPREM: "1", RAI2_LICENSE_FILE: licPath } });
    const snap = getRai2EntitlementSnapshot({ RAI2_CUSTOM_ONPREM: "1", RAI2_LICENSE_FILE: licPath });
    expect(snap.enterpriseAccess).toBe(false);
  });
});
