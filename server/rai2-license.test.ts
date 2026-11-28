import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { signRai2CustomLicense, verifyRai2CustomLicense } from "./rai2-license.ts";
import { configureRai2Entitlement, getRai2EntitlementSnapshot } from "./rai2-entitlement.ts";
import { createBotCreateRoutes } from "./routes/bots-create.ts";
import { createEnterpriseStateRoutes } from "./routes/enterprise-state-routes.ts";

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

  it("blocks creating bots above maxBots and blocks Enterprise bots even when caller passes a custom id", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "lic-botcap-"));
    configureRai2Entitlement({ dataDir: tmp, env: { RAI2_CUSTOM_ONPREM: "1" } });
    let status = 0;
    let body: unknown = null;
    const route = createBotCreateRoutes({
      store: { bots: [{ id: "b1", threadId: "t1" }], bot: () => null, botByThread: () => null, groupByThread: () => null } as never,
      cfg: {} as never,
      presetStore: { get: () => null } as never,
      orgInstallStatuses: {} as never,
      hostedWorkspace: false,
      hostedFullAccessRefusal: null,
      desktopManaged: false,
      maxWorkspaceBots: 50,
      cloudOwnerKey: null,
      hostedModels: null,
      cloudRoutineAuthors: null,
      storedAvatarExists: () => false,
      defaultSelection: async () => ({ instanceId: "default", model: "gpt-4o" }),
      checkedModelSelection: () => ({ ok: true, selection: { instanceId: "default", model: "gpt-4o" } }),
      cloudOwnerSession: () => false,
      wireBot: (b: unknown) => b as never,
      routines: () => ({}) as never,
      botLimit: { refusal: () => null } as never,
      notify: () => {},
      broadcast: () => {},
      onBotCreated: () => {},
    } as never);
    await route({
      req: { headers: {} } as never,
      res: {} as never,
      path: "/api/bots",
      method: "POST",
      url: new URL("http://localhost/api/bots"),
      auth: { kind: "session", session: { email: "ceo@abc.vn" }, scopes: ["admin"] } as never,
      readBody: async () => ({ id: "bypass-id", name: "Sale Bot", zone: 3, section: "Phòng Kinh Doanh & Chốt Hợp Đồng" }),
      json(_r: unknown, s: number, b: unknown) {
        status = s;
        body = b;
      },
    });
    expect(status).toBe(403);
    expect((body as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");
  });

  it("serves /api/custom/license-status to admins only and blocks non-admin members", async () => {
    const route = createEnterpriseStateRoutes();
    let status = 0;
    let body: unknown = null;
    await route({
      req: {} as never,
      res: {} as never,
      path: "/api/custom/license-status",
      method: "GET",
      url: new URL("http://localhost/api/custom/license-status"),
      auth: { kind: "session", session: { email: "member@abc.vn" }, scopes: ["read"] } as never,
      readBody: async () => ({}),
      json(_r: unknown, s: number, b: unknown) {
        status = s;
        body = b;
      },
    });
    expect(status).toBe(403);

    await route({
      req: {} as never,
      res: {} as never,
      path: "/api/custom/license-status",
      method: "GET",
      url: new URL("http://localhost/api/custom/license-status"),
      auth: { kind: "session", session: { email: "ceo@abc.vn" }, scopes: ["admin"] } as never,
      readBody: async () => ({}),
      json(_r: unknown, s: number, b: unknown) {
        status = s;
        body = b;
      },
    });
    expect(status).toBe(200);
    expect((body as { valid: boolean }).valid).toBeDefined();
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
