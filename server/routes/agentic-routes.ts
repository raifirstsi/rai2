import { getTurnSteeringManager, type SteeringAction } from "../turn-steering.ts";
import { convertOfficeDocument } from "../office-convert.ts";
import { PASS, type RouteHandler } from "./table.ts";

export interface AgenticOsRouteDeps {
  stopTurn?: (turnId: string) => void | Promise<void>;
}

export function createAgenticOsRoutes(deps?: AgenticOsRouteDeps): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    // 1. POST /api/chat/steer
    if (method === "POST" && path === "/api/chat/steer") {
      let body: unknown;
      try {
        body = await readBody(req, 16_384);
      } catch {
        return json(res, 400, { error: "expected a small JSON body" });
      }

      const parsed = body as { turnId?: unknown; action?: unknown; instruction?: unknown };
      if (typeof parsed?.turnId !== "string" || !parsed.turnId) {
        return json(res, 400, { error: "turnId is required" });
      }
      if (typeof parsed?.action !== "string" || !["redirect", "pause", "cancel", "inject_context"].includes(parsed.action)) {
        return json(res, 400, { error: "valid action is required (redirect, pause, cancel, inject_context)" });
      }

      const directive = getTurnSteeringManager().submitSteer(
        parsed.turnId,
        parsed.action as SteeringAction,
        typeof parsed.instruction === "string" ? parsed.instruction : undefined
      );

      // If action is cancel and a stopTurn hook is available, invoke it
      if (parsed.action === "cancel" && deps?.stopTurn) {
        try {
          await deps.stopTurn(parsed.turnId);
        } catch (err) {
          console.warn("[AgenticRoutes] stopTurn failed:", err);
        }
      }

      return json(res, 200, { ok: true, directive });
    }

    // 2. POST /api/office/convert
    if (method === "POST" && path === "/api/office/convert") {
      let body: unknown;
      try {
        body = await readBody(req, 10_485_760); // 10MB limit
      } catch {
        return json(res, 400, { error: "payload exceeded size limit" });
      }

      const parsed = body as { filename?: unknown; contentBase64?: unknown; mimeType?: unknown };
      if (typeof parsed?.filename !== "string" || typeof parsed?.contentBase64 !== "string") {
        return json(res, 400, { error: "filename and contentBase64 are required" });
      }

      try {
        const buffer = Buffer.from(parsed.contentBase64, "base64");
        const result = await convertOfficeDocument({
          filename: parsed.filename,
          buffer,
          mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : undefined
        });
        return json(res, 200, { ok: true, result });
      } catch (err) {
        return json(res, 500, { error: "failed to convert document", details: String(err) });
      }
    }

    return PASS;
  };
}
