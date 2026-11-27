import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configureRai2Entitlement,
  getRai2EntitlementSnapshot,
  isEnterpriseBotRequest,
  isEnterpriseVipAllowed,
  refreshRai2Entitlement,
  requireEnterpriseVip,
} from "./rai2-entitlement.ts";

describe("rai2-entitlement - VIP & Trial Gating", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rai2-entitlement-"));
  });

  afterEach(() => {
    configureRai2Entitlement({ dataDir: undefined, env: process.env });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows enterprise features for local standalone workspaces", () => {
    configureRai2Entitlement({ dataDir: tmpDir, env: {} });
    const snap = getRai2EntitlementSnapshot({});
    expect(snap.managed).toBe(false);
    expect(snap.enterpriseAccess).toBe(true);
    expect(isEnterpriseVipAllowed()).toBe(true);
  });

  it("fails closed for managed starter tenants and unlocks on vip or active trial", async () => {
    let planFromSaas: Record<string, unknown> = {
      ok: true,
      planId: "starter",
      planName: "RAI² Starter (Cá Nhân)",
      entitlement: "paid",
      enterpriseAccess: false,
      paidThrough: Date.now() + 86_400_000,
      trialThrough: 0,
    };

    const env: NodeJS.ProcessEnv = {
      OMB_RAI2_TENANT: "1",
      OMB_SIGNIN_TENANT_URL: "https://app.rai2.si",
      OMB_SIGNIN_TENANT_SLUG: "u-1234567890abcdef1234",
      OMB_SIGNIN_TENANT_TOKEN: "secret-token",
    };

    configureRai2Entitlement({
      dataDir: tmpDir,
      env,
      fetchImpl: async () =>
        new Response(JSON.stringify(planFromSaas), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    // Before first sync -> fail closed
    expect(isEnterpriseVipAllowed()).toBe(false);

    // Refresh as starter -> still locked
    await refreshRai2Entitlement(true);
    expect(isEnterpriseVipAllowed()).toBe(false);

    let refusedStatus = 0;
    let refusedBody: unknown = null;
    const blocked = requireEnterpriseVip({} as any, (_res, code, body) => {
      refusedStatus = code;
      refusedBody = body;
    });
    expect(blocked).toBe(true);
    expect(refusedStatus).toBe(403);
    expect((refusedBody as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");

    // Upgrade to VIP -> unlocks immediately on refresh
    planFromSaas = {
      ok: true,
      planId: "vip",
      planName: "RAI² Enterprise VIP",
      entitlement: "paid",
      enterpriseAccess: true,
      paidThrough: Date.now() + 30 * 86_400_000,
      trialThrough: 0,
    };
    await refreshRai2Entitlement(true);
    expect(isEnterpriseVipAllowed()).toBe(true);
    expect(requireEnterpriseVip({} as any, () => {})).toBe(false);
  });

  it("identifies enterprise 7-zone bots accurately while allowing free personal bots", () => {
    expect(isEnterpriseBotRequest({ zone: 2 })).toBe(true);
    expect(isEnterpriseBotRequest({ section: "Phòng Kinh Doanh & Chốt Hợp Đồng" })).toBe(true);
    expect(isEnterpriseBotRequest({ id: "rai-lead" })).toBe(true);
    expect(isEnterpriseBotRequest({ role: "rai-margin" })).toBe(true);
    expect(isEnterpriseBotRequest({ section: "Sáng tạo cá nhân" })).toBe(false);
    expect(isEnterpriseBotRequest({})).toBe(false);
  });
});

import { createSprint4Routes } from "./routes/sprint4-routes.ts";
import { createSprint5Routes } from "./routes/sprint5-routes.ts";
import { createVirtualTablesRoutes } from "./routes/virtual-tables-routes.ts";

describe("Enterprise VIP route enforcement (sprint4, sprint5, virtual-tables)", () => {
  afterEach(() => {
    delete process.env.OMB_RAI2_FORCE_PLAN;
  });

  const callRoute = async (
    handler: ReturnType<typeof createSprint4Routes>,
    pathAndQuery: string,
    method: "GET" | "POST" = "GET",
  ) => {
    let status = 0;
    let body: unknown = null;
    const urlObj = new URL(`http://localhost${pathAndQuery}`);
    await handler({
      req: {} as any,
      res: {} as any,
      url: urlObj,
      path: urlObj.pathname,
      method,
      auth: { kind: "loopback", scopes: ["admin"], trust: "service" },
      json: (_res, code, payload) => {
        status = code;
        body = payload;
      },
      readBody: async () => ({}),
    });
    return { status, body };
  };

  it("blocks Enterprise APIs with 403 ENTERPRISE_VIP_REQUIRED on Starter plan and allows on Trial/VIP", async () => {
    const s4 = createSprint4Routes();
    const s5 = createSprint5Routes();
    const vt = createVirtualTablesRoutes();

    process.env.OMB_RAI2_FORCE_PLAN = "starter";
    const r4 = await callRoute(s4, "/api/bots/evals/criteria", "GET");
    expect(r4.status).toBe(403);
    expect((r4.body as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");

    const r5 = await callRoute(s5, "/api/pulse/today?workspaceId=default", "GET");
    expect(r5.status).toBe(403);
    expect((r5.body as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");

    const rvt = await callRoute(vt, "/api/tables/query", "POST");
    expect(rvt.status).toBe(403);
    expect((rvt.body as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");

    // Non-matching path still passes through cleanly even on starter
    let passed = false;
    const passRes = await s4({
      req: {} as any,
      res: {} as any,
      url: new URL("http://localhost/api/bots"),
      path: "/api/bots",
      method: "GET",
      auth: { kind: "loopback", scopes: ["admin"], trust: "service" },
      json: () => { passed = true; },
      readBody: async () => ({}),
    });
    expect(passed).toBe(false);
    expect(passRes).not.toBeUndefined();

    // Trial (14 days) and VIP both unlock
    for (const plan of ["trial", "vip"]) {
      process.env.OMB_RAI2_FORCE_PLAN = plan;
      const ok4 = await callRoute(s4, "/api/bots/evals/criteria", "GET");
      expect(ok4.status).toBe(200);
      const ok5 = await callRoute(s5, "/api/pulse/today?workspaceId=default", "GET");
      expect(ok5.status).toBe(200);
    }
  });
});
