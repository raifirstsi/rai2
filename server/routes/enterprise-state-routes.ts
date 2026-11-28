import { isIP } from "node:net";
import { getEnterpriseStateStore, type EnterpriseStatePatch } from "../enterprise-state.ts";
import { requireEnterpriseVip } from "../rai2-entitlement.ts";
import { getBusinessPulseEngine } from "../business-pulse.ts";
import { getWorkspaceAuditLedger } from "../agent/merkle-audit.ts";
import { getEvalsRunner, type BotSampleInteraction } from "../evals-runner.ts";
import { getPromotionGate } from "../promotion-gate.ts";
import { getPulseScheduler } from "../pulse-scheduler.ts";
import { PASS, type RouteHandler } from "./table.ts";

function isSafeWebhookUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host.startsWith("::ffff:") ||
      host.startsWith("[::ffff:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:") ||
      host.startsWith("[fc") ||
      host.startsWith("[fd") ||
      host.startsWith("[fe80:") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      (isIP(host) === 4 && /^172\.(1[6-9]|2\d|3[0-1])\./.test(host))
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export interface EnterpriseStateRouteDeps {
  getBotInteractions?: (botId: string) => { botName: string; interactions: BotSampleInteraction[]; systemPrompt?: string };
  getEnterpriseStats?: () => { enterpriseBotsCount: number; totalBotsCount: number };
}

export function createEnterpriseStateRoutes(deps?: EnterpriseStateRouteDeps): RouteHandler {
  return async ({ req, res, path, method, url, auth, json, readBody }) => {
    if (!path.startsWith("/api/enterprise/")) return PASS;
    if (requireEnterpriseVip(res, json)) return;

    const urlObj = new URL(req.url ?? "", "http://localhost");
    const store = getEnterpriseStateStore();

    // 5. GET /api/enterprise/architecture-scan - Real workspace readiness scan (/21)
    if (method === "GET" && path === "/api/enterprise/architecture-scan") {
      const ws = url.searchParams.get("workspaceId")?.trim() || "default";
      const state = store.getState(ws);
      const pillars = state.contextVault?.pillars ?? {};
      const canonicalKeys = ["brand_voice", "customer_avatar", "offer_breakdown", "competitive_positioning", "sales_process", "case_studies", "sops", "industry_context"];
      const filledPillars = canonicalKeys.filter((k) => typeof pillars[k] === "string" && pillars[k].trim().length > 0).length;
      const hasToc = Boolean(state.tocDiagnosis && typeof state.tocDiagnosis === "object");
      const hasMargin = typeof state.marginGuard?.minThresholdPct === "number" && typeof state.marginGuard?.maxDiscountPct === "number";
      const pulseCfg = getPulseScheduler().getConfig();
      const hasPulseSchedule = Boolean(pulseCfg.enabled || state.fridayPulse?.webhookUrl || pulseCfg.zaloToId);
      const stats = deps?.getEnterpriseStats?.() ?? { enterpriseBotsCount: 0, totalBotsCount: 0 };
      const evaluatedBots = Object.keys(state.autonomyProfiles ?? {}).length;

      const checks = [
        { id: "vault", label: `Két Sắt Ngữ Cảnh (${filledPillars}/8 trụ cột)`, passed: filledPillars >= 4, points: Math.min(6, Math.round((filledPillars / 8) * 6)) },
        { id: "toc", label: "Chẩn đoán Điểm Nghẽn TOC", passed: hasToc, points: hasToc ? 3 : 0 },
        { id: "margin", label: `Cầu dao Margin Guard (${state.marginGuard?.minThresholdPct ?? 18}% / ${state.marginGuard?.maxDiscountPct ?? 15}%)`, passed: hasMargin, points: hasMargin ? 3 : 0 },
        { id: "bots", label: `Nhân Sự Số Enterprise (${stats.enterpriseBotsCount} bot)`, passed: stats.enterpriseBotsCount > 0, points: stats.enterpriseBotsCount > 0 ? 4 : 0 },
        { id: "pulse", label: "Lịch Nhịp Thở 17:00 / Webhook / Zalo", passed: hasPulseSchedule, points: hasPulseSchedule ? 3 : 0 },
        { id: "autonomy", label: `Sát hạch Tự trị (${evaluatedBots} bot đã kiểm định)`, passed: evaluatedBots > 0, points: evaluatedBots > 0 ? 2 : 0 },
      ];
      const totalScore = checks.reduce((acc, c) => acc + c.points, 0);
      return json(res, 200, { success: true, totalScore, maxScore: 21, checks, stats });
    }

    // 1. GET /api/enterprise/state
    if (method === "GET" && path === "/api/enterprise/state") {
      const ws = urlObj.searchParams.get("workspaceId") || "default";
      const state = store.getState(ws);
      const livePulse = getBusinessPulseEngine().getDailyPulse(ws);
      return json(res, 200, { success: true, state, livePulse });
    }

    // 2. PUT /api/enterprise/state
    if (method === "PUT" && path === "/api/enterprise/state") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to update enterprise state" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 524_288);
      } catch {
        return json(res, 400, { error: "expected JSON body within 512KB" });
      }
      const parsed = body as { workspaceId?: unknown } & EnterpriseStatePatch;
      const ws = typeof parsed?.workspaceId === "string" && parsed.workspaceId.trim() ? parsed.workspaceId.trim() : "default";
      const { workspaceId: _ws, ...patch } = parsed ?? {};
      const next = store.updateState(ws, patch);
      if (patch.contextVault || patch.marginGuard || patch.architectureAssessment) {
        try {
          const actor = (auth.kind === "session" ? auth.session.email : undefined) || "service";
          getWorkspaceAuditLedger().append(ws, actor, "enterprise.state.updated", {
            sections: Object.keys(patch),
          });
        } catch {
          // Non-fatal
        }
      }
      return json(res, 200, { success: true, state: next });
    }

    // 3. POST /api/enterprise/margin-guard/approve
    if (method === "POST" && path === "/api/enterprise/margin-guard/approve") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to approve margin exceptions" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 16_384);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }
      const p = body as {
        workspaceId?: unknown;
        messageId?: unknown;
        note?: unknown;
        proposedPrice?: unknown;
        directCosts?: unknown;
        marginPct?: unknown;
      };
      const ws = typeof p?.workspaceId === "string" && p.workspaceId.trim() ? p.workspaceId.trim() : "default";
      const messageId = typeof p?.messageId === "string" && p.messageId.trim() ? p.messageId.trim() : `manual_${Date.now()}`;
      const approvedBy = (auth.kind === "session" ? auth.session.email : undefined) || "founder";
      const record = {
        approvedAt: new Date().toISOString(),
        approvedBy,
        ...(typeof p?.note === "string" ? { note: p.note.slice(0, 500) } : {}),
        ...(typeof p?.proposedPrice === "number" ? { proposedPrice: p.proposedPrice } : {}),
        ...(typeof p?.directCosts === "number" ? { directCosts: p.directCosts } : {}),
        ...(typeof p?.marginPct === "number" ? { marginPct: p.marginPct } : {}),
      };
      const next = store.recordMarginApproval(ws, messageId, record);
      try {
        getWorkspaceAuditLedger().append(ws, approvedBy, "enterprise.margin_exception_approved", {
          messageId,
          ...record,
        });
      } catch {
        // Non-fatal
      }
      return json(res, 200, { success: true, state: next, approval: record });
    }

    // 4. POST /api/enterprise/friday-pulse/send
    if (method === "POST" && path === "/api/enterprise/friday-pulse/send") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to dispatch executive pulse" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }
      const p = body as {
        workspaceId?: unknown;
        webhookUrl?: unknown;
        markdown?: unknown;
        weekDisplay?: unknown;
        dispatchZalo?: unknown;
      };
      const ws = typeof p?.workspaceId === "string" && p.workspaceId.trim() ? p.workspaceId.trim() : "default";
      const weekDisplay = typeof p?.weekDisplay === "string" ? p.weekDisplay : "";
      const markdown = typeof p?.markdown === "string" ? p.markdown : "";
      const webhookRaw = typeof p?.webhookUrl === "string" ? p.webhookUrl.trim() : "";

      let webhookDelivered = false;
      let webhookError: string | undefined;
      if (webhookRaw) {
        const safeUrl = isSafeWebhookUrl(webhookRaw);
        if (!safeUrl) {
          return json(res, 400, { error: "Webhook URL phải là HTTPS công khai hợp lệ (chặn localhost/LAN)." });
        }
        try {
          const resp = await fetch(safeUrl, {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(7_000),
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: markdown,
              content: markdown,
              source: "RAI2_ENTERPRISE_FRIDAY_PULSE",
              workspaceId: ws,
              week: weekDisplay,
            }),
          });
          webhookDelivered = resp.ok;
          if (!resp.ok) webhookError = `HTTP ${resp.status}`;
        } catch (err) {
          webhookError = err instanceof Error ? err.message : "Webhook delivery failed";
        }
      }

      let zaloDispatched = false;
      if (p?.dispatchZalo === true) {
        try {
          const results = await getPulseScheduler().dispatchNow([ws]);
          zaloDispatched = results.some((r) => r.zaloSent);
        } catch {
          // Non-fatal
        }
      }

      const nowIso = new Date().toISOString();
      const next = store.updateState(ws, {
        fridayPulse: {
          ...(webhookRaw ? { webhookUrl: webhookRaw } : {}),
          ...(webhookDelivered || zaloDispatched ? { lastSentAt: nowIso, lastSentWeek: weekDisplay } : {}),
          ...(weekDisplay ? { reviewedWeek: weekDisplay } : {}),
        },
      });
      try {
        const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
        getWorkspaceAuditLedger().append(ws, actor, "enterprise.friday_pulse_sent", {
          weekDisplay,
          webhookDelivered,
          zaloDispatched,
        });
      } catch {
        // Non-fatal
      }

      return json(res, 200, {
        success: webhookRaw ? webhookDelivered || zaloDispatched : true,
        webhookDelivered,
        zaloDispatched,
        ...(webhookError ? { error: webhookError } : {}),
        state: next,
      });
    }

    // 5. POST /api/enterprise/autonomy/record
    if (method === "POST" && path === "/api/enterprise/autonomy/record") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to modify bot autonomy tier" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }
      const p = body as {
        workspaceId?: unknown;
        botId?: unknown;
        profile?: unknown;
        promoteToTier?: unknown;
      };
      const ws = typeof p?.workspaceId === "string" && p.workspaceId.trim() ? p.workspaceId.trim() : "default";
      const botId = typeof p?.botId === "string" && p.botId.trim() ? p.botId.trim() : "";
      if (!botId || !p?.profile || typeof p.profile !== "object") {
        return json(res, 400, { error: "botId and profile object are required" });
      }
      const next = store.updateState(ws, {
        autonomyProfiles: { [botId]: p.profile },
      });
      const tier = String((p.profile as { currentTier?: unknown }).currentTier ?? "");
      let evalResult = null;
      let promotionResult = null;
      if (tier === "TIER_2_COPILOT" || tier === "TIER_3_AUTONOMOUS" || Array.isArray((p as { interactions?: unknown }).interactions)) {
        try {
          const runner = getEvalsRunner();
          const gate = getPromotionGate();
          const reqInteractions = Array.isArray((p as { interactions?: unknown }).interactions)
            ? ((p as { interactions: BotSampleInteraction[] }).interactions)
            : undefined;
          const fetched = deps?.getBotInteractions?.(botId);
          const botName = fetched?.botName || String((p.profile as { botName?: unknown }).botName ?? botId);
          const interactions = reqInteractions && reqInteractions.length > 0 ? reqInteractions : (fetched?.interactions ?? []);
          evalResult = runner.evaluateBot(botId, botName, interactions, fetched?.systemPrompt ?? "");
          const actorName = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
          promotionResult = gate.evaluateAndPromote(evalResult, ws, actorName);
        } catch {
          // Non-fatal
        }
      }
      try {
        const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
        getWorkspaceAuditLedger().append(ws, actor, "enterprise.autonomy_updated", {
          botId,
          tier,
        });
      } catch {
        // Non-fatal
      }
      return json(res, 200, { success: true, state: next, evalResult, promotionResult });
    }

    return PASS;
  };
}

