import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createZaloRoutes } from "./zalo.ts";

describe("server/routes/zalo - Multi-Tenant Zalo Integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "zalo-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  function createCaller(deps = {}) {
    const handler = createZaloRoutes({ dataDir: tempDir, ...deps });
    return async (opts: {
      path: string;
      method?: string;
      body?: unknown;
      admin?: boolean;
    }) => {
      const answers: [number, unknown][] = [];
      await handler({
        req: { headers: { host: "workspace.example" } },
        res: { setHeader() {} },
        path: opts.path,
        method: opts.method ?? "GET",
        auth: { scopes: opts.admin ? ["admin"] : [] },
        json: (_res: unknown, status: number, body: unknown) => answers.push([status, body]),
        readBody: async () => opts.body,
      } as never);
      return answers[0] ?? [404, null];
    };
  }

  it("returns not-connected when no personal configuration exists", async () => {
    const call = createCaller();
    const [status, data] = await call({ path: "/api/zalo/personal" });
    expect(status).toBe(200);
    expect((data as { state: string }).state).toBe("not-connected");
  });

  it("refuses non-admin users from configuring Zalo Personal", async () => {
    const call = createCaller();
    const [status] = await call({
      path: "/api/zalo/personal",
      method: "POST",
      admin: false,
      body: { phone: "0976087820" },
    });
    expect(status).toBe(403);
  });

  it("saves personal configuration with assignedBotId for admin", async () => {
    const call = createCaller();
    const [status, data] = await call({
      path: "/api/zalo/personal",
      method: "POST",
      admin: true,
      body: { phone: "0976087820", assignedBotId: "bot-rai-quote" },
    });
    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });

    const configFile = join(tempDir, "zalo-personal.json");
    expect(existsSync(configFile)).toBe(true);
    const parsed = JSON.parse(readFileSync(configFile, "utf8"));
    expect(parsed.phone).toBe("0976087820");
    expect(parsed.assignedBotId).toBe("bot-rai-quote");
  });

  it("dispatches inbound zalo webhook message to assigned bot", async () => {
    const onPersonalMessage = vi.fn();
    const call = createCaller({ onPersonalMessage });

    // First, configure personal Zalo with assignedBotId
    await call({
      path: "/api/zalo/personal",
      method: "POST",
      admin: true,
      body: { phone: "0976087820", assignedBotId: "bot-rai-sales" },
    });

    // Inbound webhook from Gateway
    const [status, data] = await call({
      path: "/api/webhooks/zalo-personal",
      method: "POST",
      body: {
        workspaceId: "test-workspace",
        fromId: "zalo-user-123",
        fromName: "Nguyen Van A",
        text: "Xin chao bot tu van",
        timestamp: Date.now(),
      },
    });

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(onPersonalMessage).toHaveBeenCalledWith(
      "bot-rai-sales",
      "zalo-user-123",
      "Xin chao bot tu van",
      "Nguyen Van A"
    );
  });

  it("deletes configuration on DELETE and signals gateway", async () => {
    const call = createCaller();

    // Configure first
    await call({
      path: "/api/zalo/personal",
      method: "POST",
      admin: true,
      body: { phone: "0976087820" },
    });
    const configFile = join(tempDir, "zalo-personal.json");
    expect(existsSync(configFile)).toBe(true);

    // Delete
    const [status, data] = await call({
      path: "/api/zalo/personal",
      method: "DELETE",
      admin: true,
    });
    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(existsSync(configFile)).toBe(false);
  });
});
