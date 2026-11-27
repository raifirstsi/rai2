/**
 * Sprint 4 API Routes
 * Sát hạch năng lực Bot (Promotion Gate), Voice-Text Hand-off & Artifact Diff Consent.
 */

import { getEvalsRunner, ENTERPRISE_21_CRITERIA, type BotSampleInteraction } from "../evals-runner.ts";
import { getPromotionGate } from "../promotion-gate.ts";
import { getVoiceHandoffEngine } from "../voice-handoff.ts";
import { getArtifactDiffEngine } from "../artifact-diff.ts";
import { getBusinessPulseEngine } from "../business-pulse.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createSprint4Routes(): RouteHandler {
  return async ({ req, res, path, method, auth, json, readBody }) => {
    // 1. GET /api/bots/evals/criteria - Danh sách 21 tiêu chí đánh giá
    if (method === "GET" && path === "/api/bots/evals/criteria") {
      return json(res, 200, { success: true, count: ENTERPRISE_21_CRITERIA.length, criteria: ENTERPRISE_21_CRITERIA });
    }

    // 2. POST /api/bots/evals/run - Chạy kiểm thử tự động 21 tiêu chí
    if (method === "POST" && path === "/api/bots/evals/run") {
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        botId?: unknown;
        botName?: unknown;
        interactions?: unknown;
        systemPrompt?: unknown;
      };

      const botId = typeof p?.botId === "string" && p.botId ? p.botId : "bot_default";
      const botName = typeof p?.botName === "string" && p.botName ? p.botName : "Assistant";
      const interactions = Array.isArray(p?.interactions) ? (p.interactions as BotSampleInteraction[]) : [];
      const systemPrompt = typeof p?.systemPrompt === "string" ? p.systemPrompt : "";

      const runner = getEvalsRunner();
      const evalResult = runner.evaluateBot(botId, botName, interactions, systemPrompt);

      return json(res, 200, { success: true, evalResult });
    }

    // 3. POST /api/bots/promote - Sát hạch và Cấp cờ tiếp khách (admin only)
    if (method === "POST" && path === "/api/bots/promote") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to promote bots" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 65_536);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        botId?: unknown;
        botName?: unknown;
        workspaceId?: unknown;
        interactions?: unknown;
        promotedBy?: unknown;
      };

      const botId = typeof p?.botId === "string" && p.botId ? p.botId : "bot_default";
      const botName = typeof p?.botName === "string" && p.botName ? p.botName : "Assistant";
      const workspaceId = typeof p?.workspaceId === "string" && p.workspaceId ? p.workspaceId : "default";
      const promotedBy = typeof p?.promotedBy === "string" && p.promotedBy ? p.promotedBy : "admin";
      const interactions = Array.isArray(p?.interactions) ? (p.interactions as BotSampleInteraction[]) : [];

      const runner = getEvalsRunner();
      const gate = getPromotionGate();

      const evalResult = runner.evaluateBot(botId, botName, interactions);
      const record = gate.evaluateAndPromote(evalResult, workspaceId, promotedBy);

      return json(res, 200, {
        success: true,
        promoted: record.status === "promoted",
        record,
        evalResult,
      });
    }

    // 4. GET /api/bots/status - Kiểm tra trạng thái cấp phép phục vụ khách hàng
    if (method === "GET" && path === "/api/bots/status") {
      const url = new URL(req.url ?? "", "http://localhost");
      const botId = url.searchParams.get("botId") || "bot_default";
      const workspaceId = url.searchParams.get("workspaceId") || undefined;
      const gate = getPromotionGate();
      const check = gate.canServeCustomer(botId, workspaceId);
      const record = gate.getRecord(botId, workspaceId);

      return json(res, 200, {
        success: true,
        botId,
        workspaceId: workspaceId ?? record.workspaceId,
        canServeCustomer: check.allowed,
        status: check.status,
        reason: check.reason,
        record,
      });
    }

    // 5. POST /api/voice/handoff - Bàn giao Voice sang Text & bóc tách P&L (< 15ms)
    if (method === "POST" && path === "/api/voice/handoff") {
      let body: unknown;
      try {
        body = await readBody(req, 32_768);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        transcript?: unknown;
        sessionId?: unknown;
        workspaceId?: unknown;
        autoRecordPulse?: unknown;
      };
      const transcript = typeof p?.transcript === "string" ? p.transcript : "";
      const sessionId = typeof p?.sessionId === "string" ? p.sessionId : undefined;
      const workspaceId = typeof p?.workspaceId === "string" && p.workspaceId ? p.workspaceId : "default";
      const autoRecordPulse = p?.autoRecordPulse !== false;

      const engine = getVoiceHandoffEngine();
      const result = engine.handoff(transcript, sessionId);

      if (
        autoRecordPulse &&
        result.financialIntent.intent === "pnl_calculation" &&
        typeof result.financialIntent.revenue === "number" &&
        result.financialIntent.revenue > 0
      ) {
        try {
          getBusinessPulseEngine().recordTransaction({
            workspaceId,
            orderCode: `VOICE-${Date.now().toString().slice(-4)}`,
            revenue: result.financialIntent.revenue,
            cost: result.financialIntent.cost ?? 0,
            customerName: "Đơn từ Voice Hand-off",
            status: "approved",
          });
        } catch {
          // Never block voice handoff response
        }
      }

      return json(res, 200, { success: true, ...result });
    }

    // 6. POST /api/artifacts/diff - So sánh khác biệt văn bản / tài liệu
    if (method === "POST" && path === "/api/artifacts/diff") {
      let body: unknown;
      try {
        body = await readBody(req, 131_072);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as { title?: unknown; originalText?: unknown; modifiedText?: unknown };
      const title = typeof p?.title === "string" ? p.title : "Document Diff";
      const orig = typeof p?.originalText === "string" ? p.originalText : "";
      const mod = typeof p?.modifiedText === "string" ? p.modifiedText : "";

      const engine = getArtifactDiffEngine();
      const diff = engine.computeDiff(title, orig, mod);

      return json(res, 200, { success: true, diff });
    }

    // 7. POST /api/artifacts/consent - Ký duyệt chữ ký đồng thuận (admin only)
    if (method === "POST" && path === "/api/artifacts/consent") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required to sign Merkle consent" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 32_768);
      } catch {
        return json(res, 400, { error: "expected JSON body" });
      }

      const p = body as {
        diffId?: unknown;
        title?: unknown;
        approverId?: unknown;
        approverRole?: unknown;
        status?: unknown;
        notes?: unknown;
      };

      const diffId = typeof p?.diffId === "string" ? p.diffId : "";
      const title = typeof p?.title === "string" ? p.title : "Document Consent";
      const approverId = typeof p?.approverId === "string" ? p.approverId : "director_01";
      const approverRole = typeof p?.approverRole === "string" ? p.approverRole : "Director";
      const status = p?.status === "rejected" ? "rejected" : "signed";
      const notes = typeof p?.notes === "string" ? p.notes : undefined;

      const engine = getArtifactDiffEngine();
      const record = engine.signConsent(diffId, title, approverId, approverRole, status, notes);

      return json(res, 200, { success: true, record });
    }

    // 8. GET /api/artifacts/consent/verify - Kiểm tra tính toàn vẹn chữ ký số Merkle Consent
    if (method === "GET" && path === "/api/artifacts/consent/verify") {
      const url = new URL(req.url ?? "", "http://localhost");
      const consentId = url.searchParams.get("consentId") || "";
      const engine = getArtifactDiffEngine();
      const verification = engine.verifyConsent(consentId);

      return json(res, 200, {
        success: true,
        consentId,
        valid: verification.valid,
        record: verification.record,
      });
    }

    // 9. GET /api/artifacts/consent/chain - Kiểm tra toàn vẹn chuỗi khối Merkle Consent Chain
    if (method === "GET" && path === "/api/artifacts/consent/chain") {
      const engine = getArtifactDiffEngine();
      const chainVerification = engine.verifyConsentChain();

      return json(res, 200, {
        success: true,
        valid: chainVerification.valid,
        length: chainVerification.length,
        brokenAtIndex: chainVerification.brokenAtIndex,
      });
    }

    return PASS;
  };
}
