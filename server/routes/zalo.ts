import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";

import { writeFileAtomic } from "../atomic.ts";
import { DATA_DIR } from "../config.ts";
import { PASS, type RouteHandler } from "./table.ts";
import type { ZaloOAConfig, ZaloOAStatus, ZaloPersonalConfig, ZaloPersonalStatus } from "../../shared/zalo.ts";

const oaInputSchema = z.object({
  appId: z.string().trim().min(1).max(64),
  secretKey: z.string().trim().min(1).max(128),
  oaId: z.string().trim().min(1).max(64),
  accessToken: z.string().trim().max(4096).optional(),
  refreshToken: z.string().trim().max(4096).optional(),
  webhookSecret: z.string().trim().max(256).optional(),
}).strict();

const personalInputSchema = z.object({
  phone: z.string().trim().max(64).optional(),
  sessionCookie: z.string().trim().max(16384).optional(),
  secretKey: z.string().trim().max(256).optional(),
  gatewayUrl: z.string().trim().max(512).optional(),
  assignedBotId: z.string().trim().max(128).optional(),
}).strict();

export interface ZaloRouteDeps {
  dataDir?: string;
  onOAMessage?: (senderId: string, text: string) => Promise<void> | void;
  onPersonalMessage?: (botId: string, senderId: string, text: string, senderName?: string) => Promise<void> | void;
}

export function createZaloRoutes(deps: ZaloRouteDeps = {}): RouteHandler {
  const dataDir = deps.dataDir ?? DATA_DIR;
  const workspaceId = process.env.OMB_SIGNIN_TENANT_SLUG || basename(dirname(dataDir)) || "default";
  const oaFile = join(dataDir, "zalo-oa.json");
  const personalFile = join(dataDir, "zalo-personal.json");

  function readOA(): ZaloOAConfig | null {
    try {
      if (existsSync(oaFile)) return JSON.parse(readFileSync(oaFile, "utf8")) as ZaloOAConfig;
    } catch {}
    return null;
  }

  function readPersonal(): ZaloPersonalConfig | null {
    try {
      if (existsSync(personalFile)) return JSON.parse(readFileSync(personalFile, "utf8")) as ZaloPersonalConfig;
    } catch {}
    return null;
  }

  return async ({ req, res, path, method, auth, json, readBody }) => {
    // 1. Zalo Inbound Webhook (public endpoint from VNG Zalo servers)
    if (path === "/api/webhooks/zalo-oa" && method === "POST") {
      const rawBody = await readBody(req, 1_048_576);
      if (rawBody && typeof rawBody === "object") {
        const event = rawBody as Record<string, unknown>;
        const eventName = String(event.event_name ?? "");
        const sender = event.sender as { id?: string } | undefined;
        const msg = event.message as { text?: string } | undefined;
        if (eventName === "user_send_text" && sender?.id && msg?.text && deps.onOAMessage) {
          try {
            await deps.onOAMessage(sender.id, msg.text);
          } catch {}
        }
      }
      return json(res, 200, { error: 0, message: "ok" });
    }

    // 2. Zalo Personal Inbound Webhook (forwarded from Zalo Gateway)
    if (path === "/api/webhooks/zalo-personal" && method === "POST") {
      const rawBody = await readBody(req, 1_048_576);
      if (rawBody && typeof rawBody === "object") {
        const payload = rawBody as { workspaceId?: string; fromId?: string; text?: string; fromName?: string };
        const config = readPersonal();
        if (config?.assignedBotId && deps.onPersonalMessage && payload.fromId && payload.text) {
          try {
            await deps.onPersonalMessage(config.assignedBotId, payload.fromId, payload.text, payload.fromName);
          } catch {}
        }
      }
      return json(res, 200, { ok: true });
    }

    if (!path.startsWith("/api/zalo")) return PASS;

    res.setHeader("Cache-Control", "no-store");

    // Zalo OA API Endpoints
    if (path === "/api/zalo/oa") {
      if (method === "GET") {
        const config = readOA();
        const host = req.headers.host || "localhost";
        const proto = (req.headers["x-forwarded-proto"] as string) || "https";
        const webhookUrl = `${proto}://${host}/api/webhooks/zalo-oa`;
        const status: ZaloOAStatus = {
          state: config ? "connected" : "not-connected",
          appId: config?.appId,
          oaId: config?.oaId,
          webhookUrl,
          hasToken: Boolean(config?.accessToken),
          lastConnectedAt: config?.configuredAt ?? null,
        };
        return json(res, 200, status);
      }

      if (!auth.scopes.includes("admin")) return json(res, 403, { error: "Admin only" });

      if (method === "POST") {
        const parsed = oaInputSchema.safeParse(await readBody(req, 32_768));
        if (!parsed.success) return json(res, 400, { error: "Invalid Zalo OA configuration parameters" });
        const config: ZaloOAConfig = { ...parsed.data, configuredAt: Date.now() };
        writeFileAtomic(oaFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        return json(res, 200, { ok: true });
      }

      if (method === "DELETE") {
        try {
          if (existsSync(oaFile)) unlinkSync(oaFile);
        } catch {}
        return json(res, 200, { ok: true });
      }

      return json(res, 405, { error: "method not allowed" });
    }

    // Zalo Personal API Endpoints
    if (path === "/api/zalo/personal") {
      if (method === "GET") {
        const config = readPersonal();
        let gwConnected = false;
        let liveUserInfo: { uid?: string; name?: string; phone?: string; avatar?: string } | undefined;

        try {
          const gwRes = await fetch(`http://127.0.0.1:18789/status?workspaceId=${encodeURIComponent(workspaceId)}`, { signal: AbortSignal.timeout(2000) });
          if (gwRes.ok) {
            const data = await gwRes.json() as { connected: boolean; userInfo?: { uid?: string; name?: string; phone?: string; avatar?: string } };
            gwConnected = Boolean(data.connected);
            liveUserInfo = data.userInfo;
          }
        } catch {}

        const isConnected = (config && gwConnected) || (config && Boolean(config.phone));
        const displayName = liveUserInfo?.name && liveUserInfo.name !== "Zalo User"
          ? `${liveUserInfo.name}${liveUserInfo.phone ? ` (${liveUserInfo.phone})` : ""}`
          : (config?.phone ? `Zalo (${config.phone})` : undefined);

        const status: ZaloPersonalStatus = {
          state: isConnected ? "connected" : "not-connected",
          phone: liveUserInfo?.phone || config?.phone,
          displayName,
          avatarUrl: liveUserInfo?.avatar,
          assignedBotId: config?.assignedBotId,
          gatewayConnected: gwConnected,
          lastConnectedAt: config?.configuredAt ?? null,
        };
        return json(res, 200, status);
      }

      if (!auth.scopes.includes("admin")) return json(res, 403, { error: "Admin only" });

      if (method === "POST") {
        const parsed = personalInputSchema.safeParse(await readBody(req, 32_768));
        if (!parsed.success) return json(res, 400, { error: "Invalid Zalo Personal configuration parameters" });
        const existing = readPersonal();
        const config: ZaloPersonalConfig = {
          ...existing,
          ...parsed.data,
          configuredAt: Date.now(),
        };
        writeFileAtomic(personalFile, JSON.stringify(config, null, 2), { mode: 0o600 });
        return json(res, 200, { ok: true });
      }

      if (method === "DELETE") {
        try {
          if (existsSync(personalFile)) unlinkSync(personalFile);
          await fetch("http://127.0.0.1:18789/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId }),
          });
        } catch {}
        return json(res, 200, { ok: true });
      }

      return json(res, 405, { error: "method not allowed" });
    }

    // Zalo Personal QR Generator Endpoint
    if (path === "/api/zalo/personal/qr") {
      if (!auth.scopes.includes("admin")) return json(res, 403, { error: "Admin only" });

      if (method === "POST") {
        try {
          const webhookPort = process.env.OMB_WEBHOOK_PORT || 8811;
          await fetch("http://127.0.0.1:18789/login-qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              webhookUrl: `http://127.0.0.1:${webhookPort}/api/webhooks/zalo-personal`,
            }),
          });
        } catch {}
        return json(res, 200, { ok: true, status: "started" });
      }

      if (method === "GET") {
        try {
          const gwRes = await fetch(`http://127.0.0.1:18789/status?workspaceId=${encodeURIComponent(workspaceId)}`, { signal: AbortSignal.timeout(3000) });
          const gwData = await gwRes.json() as {
            workspaceId?: string;
            connected: boolean;
            qrStatus: string;
            qrData: string | null;
            userInfo?: { uid?: string; name?: string; phone?: string; avatar?: string };
            error?: string | null;
          };

          if (gwData.connected || gwData.qrStatus === "ready") {
            const existing = readPersonal();
            const config: ZaloPersonalConfig = {
              phone: gwData.userInfo?.phone || gwData.userInfo?.name || existing?.phone || "Zalo User",
              gatewayUrl: "http://127.0.0.1:18789",
              assignedBotId: existing?.assignedBotId,
              configuredAt: existing?.configuredAt || Date.now(),
            };
            writeFileAtomic(personalFile, JSON.stringify(config, null, 2), { mode: 0o600 });
          }

          return json(res, 200, gwData);
        } catch {
          return json(res, 200, {
            connected: false,
            qrStatus: "idle",
            qrData: null,
            error: "Zalo Gateway chưa sẵn sàng",
          });
        }
      }

      return json(res, 405, { error: "method not allowed" });
    }

    // Send Outbound Zalo Message
    if (path === "/api/zalo/personal/send" && method === "POST") {
      if (!auth.scopes.includes("admin")) return json(res, 403, { error: "Admin only" });
      const body = (await readBody(req, 65_536)) as { toId?: string; text?: string };
      if (!body?.toId || !body?.text) return json(res, 400, { error: "toId and text are required" });

      try {
        const gwRes = await fetch("http://127.0.0.1:18789/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            toId: body.toId,
            text: body.text,
          }),
        });
        const gwData = await gwRes.json();
        return json(res, gwRes.status, gwData);
      } catch (e) {
        return json(res, 500, { error: (e as Error).message || "Failed to reach Zalo Gateway" });
      }
    }

    return json(res, 404, { error: "not found" });
  };
}
