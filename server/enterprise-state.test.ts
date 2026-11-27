import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EnterpriseStateStore } from "./enterprise-state.ts";
import { createEnterpriseStateRoutes } from "./routes/enterprise-state-routes.ts";

describe("EnterpriseStateStore & Real Server Routes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rai2-ent-state-"));
    delete process.env.OMB_RAI2_FORCE_PLAN;
  });

  afterEach(() => {
    delete process.env.OMB_RAI2_FORCE_PLAN;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persists Context Vault, TOC, Margin Guard, 5 Levers, and Autonomy across restarts", () => {
    const file = join(tmpDir, "enterprise-os-state.json");
    const store1 = new EnterpriseStateStore(file);
    store1.updateState("ws_alpha", {
      contextVault: { pillars: { offer_breakdown: "B.Braun Medical 35%" }, hardGateLocked: true },
      marginGuard: { minThresholdPct: 32 },
      fiveLevers: { targetGrossMargin: 38 },
    });
    store1.recordMarginApproval("ws_alpha", "msg_99", {
      approvedAt: "2026-11-27T12:00:00.000Z",
      approvedBy: "ceo@company.vn",
      marginPct: 28,
    });

    const store2 = new EnterpriseStateStore(file);
    const loaded = store2.getState("ws_alpha");
    expect(loaded.contextVault?.pillars.offer_breakdown).toBe("B.Braun Medical 35%");
    expect(loaded.contextVault?.hardGateLocked).toBe(true);
    expect(loaded.marginGuard?.minThresholdPct).toBe(32);
    expect(loaded.marginGuard?.approvals?.msg_99?.approvedBy).toBe("ceo@company.vn");
    expect(loaded.fiveLevers?.targetGrossMargin).toBe(38);
  });

  it("blocks /api/enterprise/* on Starter plan and allows VIP/Trial with SSRF-safe Friday Pulse", async () => {
    const handler = createEnterpriseStateRoutes();
    const call = async (method: "GET" | "POST" | "PUT", path: string, body?: unknown) => {
      let status = 0;
      let respBody: unknown = null;
      await handler({
        req: { url: `http://localhost${path}` } as any,
        res: {} as any,
        url: new URL(`http://localhost${path}`),
        path: path.split("?")[0]!,
        method,
        auth: { kind: "loopback", scopes: ["admin"], trust: "service" },
        json: (_r, c, b) => {
          status = c;
          respBody = b;
        },
        readBody: async () => body ?? {},
      });
      return { status, body: respBody };
    };

    process.env.OMB_RAI2_FORCE_PLAN = "starter";
    const denied = await call("GET", "/api/enterprise/state?workspaceId=default");
    expect(denied.status).toBe(403);
    expect((denied.body as { code: string }).code).toBe("ENTERPRISE_VIP_REQUIRED");

    process.env.OMB_RAI2_FORCE_PLAN = "vip";
    const updated = await call("PUT", "/api/enterprise/state", {
      workspaceId: "default",
      marginGuard: { minThresholdPct: 40 },
    });
    expect(updated.status).toBe(200);

    const fetched = await call("GET", "/api/enterprise/state?workspaceId=default");
    expect(fetched.status).toBe(200);
    expect((fetched.body as any).state.marginGuard.minThresholdPct).toBe(40);

    // SSRF block on internal IP webhook
    const ssrf = await call("POST", "/api/enterprise/friday-pulse/send", {
      workspaceId: "default",
      webhookUrl: "http://127.0.0.1:8860/steal",
      markdown: "test",
    });
    expect(ssrf.status).toBe(400);
  });

  it("enforces admin RBAC scope and clamps margin percentages + blocks IPv6 SSRF", async () => {
    const handler = createEnterpriseStateRoutes();
    const callAs = async (scope: "admin" | "client", method: "PUT" | "POST", path: string, body: unknown) => {
      let status = 0;
      let respBody: unknown = null;
      await handler({
        req: { url: `http://localhost${path}` } as any,
        res: {} as any,
        url: new URL(`http://localhost${path}`),
        path,
        method,
        auth: { kind: "loopback", scopes: [scope], trust: "service" },
        json: (_r, c, b) => {
          status = c;
          respBody = b;
        },
        readBody: async () => body,
      });
      return { status, body: respBody };
    };

    process.env.OMB_RAI2_FORCE_PLAN = "vip";
    const nonAdminPut = await callAs("client", "PUT", "/api/enterprise/state", {
      workspaceId: "default",
      marginGuard: { minThresholdPct: 1 },
    });
    expect(nonAdminPut.status).toBe(403);

    const nonAdminAutonomy = await callAs("client", "POST", "/api/enterprise/autonomy/record", {
      botId: "b1",
      profile: { currentTier: "TIER_3_AUTONOMOUS" },
    });
    expect(nonAdminAutonomy.status).toBe(403);

    // Clamps extreme percentage
    const clamped = await callAs("admin", "PUT", "/api/enterprise/state", {
      workspaceId: "default",
      marginGuard: { minThresholdPct: -25 },
    });
    expect(clamped.status).toBe(200);
    expect((clamped.body as any).state.marginGuard.minThresholdPct).toBe(0);

    // Blocks IPv6-mapped loopback SSRF
    const ipv6Ssrf = await callAs("admin", "POST", "/api/enterprise/friday-pulse/send", {
      workspaceId: "default",
      webhookUrl: "https://[::ffff:127.0.0.1]/hook",
      markdown: "test",
    });
    expect(ipv6Ssrf.status).toBe(400);
  });
});
