import { isIP } from "node:net";
import { getEnterpriseStateStore, type EnterpriseStatePatch } from "../enterprise-state.ts";
import { getRai2EntitlementSnapshot, requireEnterpriseVip } from "../rai2-entitlement.ts";
import { resolveCustomLicenseTokenFromEnv, verifyRai2CustomLicense } from "../rai2-license.ts";
import { getBusinessPulseEngine } from "../business-pulse.ts";
import { getWorkspaceAuditLedger } from "../agent/merkle-audit.ts";
import { getEvalsRunner, type BotSampleInteraction } from "../evals-runner.ts";
import { getPromotionGate } from "../promotion-gate.ts";
import { getPulseScheduler } from "../pulse-scheduler.ts";
import { getEnterpriseGovernanceStore, ROLE_DEFAULT_MAX_TIER, type DataClassificationTier, type EmployeeRole } from "../enterprise-governance.ts";
import { scanAndRedactText } from "../enterprise-dlp.ts";
import { getEnterpriseBrainStore, matchesZone, type KnowledgeKind, type PromotionStatus } from "../enterprise-brain.ts";
import { getEnterpriseTeamOrchestrator, type DagWorkflowStep, type WorkItemStatus, type WorkPriority } from "../enterprise-team.ts";
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
  resolveOpenAiKey?: () => { apiKey?: string; baseUrl?: string } | null;
  provisionPersonalBot?: (input: { email: string; name: string; zone?: string; botName: string; namespace: string }) => { id: string; name: string } | null;
  offboardPersonalBot?: (botId: string) => void;
  reactivatePersonalBot?: (botId: string, email: string) => void;
  fetchImpl?: typeof fetch;
}

export function createEnterpriseStateRoutes(deps?: EnterpriseStateRouteDeps): RouteHandler {
  return async ({ req, res, path, method, url, auth, json, readBody }) => {
    // 0. GET /api/custom/license-status - Inspect active Custom On-Premise Ed25519 license metadata
    if (method === "GET" && path === "/api/custom/license-status") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required" });
      }
      const token = resolveCustomLicenseTokenFromEnv(process.env);
      const snap = getRai2EntitlementSnapshot();
      if (!token) {
        return json(res, 200, {
          customOnPrem: process.env.RAI2_CUSTOM_ONPREM === "1",
          valid: snap.enterpriseAccess,
          planId: snap.planId,
          planName: snap.planName,
          enterpriseAccess: snap.enterpriseAccess,
        });
      }
      let publicDomain: string | undefined;
      try {
        if (process.env.OMB_PUBLIC_URL) {
          publicDomain = new URL(process.env.OMB_PUBLIC_URL).hostname;
        }
      } catch {
        publicDomain = undefined;
      }
      const verified = verifyRai2CustomLicense(token, { domain: publicDomain });
      const daysRemaining = verified.payload?.expiresAt
        ? Math.max(0, Math.ceil((verified.payload.expiresAt - Date.now()) / 86_400_000))
        : 0;
      return json(res, 200, {
        customOnPrem: true,
        valid: verified.valid,
        reason: verified.reason,
        licenseId: verified.payload?.licenseId,
        customerName: verified.payload?.customerName,
        expiresAt: verified.payload?.expiresAt,
        daysRemaining,
        renewWarning: verified.valid && daysRemaining <= 14,
        maxBots: verified.payload?.maxBots,
        allowedDomain: verified.payload?.allowedDomain,
        enterpriseAccess: snap.enterpriseAccess,
      });
    }

    if (!path.startsWith("/api/enterprise/")) return PASS;
    if (requireEnterpriseVip(res, json)) return;

    const urlObj = new URL(req.url ?? "", "http://localhost");
    const store = getEnterpriseStateStore();

    // 6. POST /api/enterprise/voice-transcribe - Cross-device Whisper audio transcription (admin only, 12MB cap)
    if (method === "POST" && path === "/api/enterprise/voice-transcribe") {
      if (!auth?.scopes.includes("admin")) {
        return json(res, 403, { error: "admin scope required" });
      }
      let body: unknown;
      try {
        body = await readBody(req, 16 * 1024 * 1024);
      } catch {
        return json(res, 413, { error: "File âm thanh quá lớn (tối đa 12MB)." });
      }
      const p = body as { audioBase64?: unknown; mimeType?: unknown; fileName?: unknown; language?: unknown };
      const rawB64 = typeof p?.audioBase64 === "string" ? p.audioBase64.trim() : "";
      if (!rawB64) {
        return json(res, 400, { error: "audioBase64 là bắt buộc." });
      }
      const cleanB64 = rawB64.includes(",") ? rawB64.split(",").pop() || "" : rawB64;
      if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanB64)) {
        return json(res, 400, { error: "Chuỗi base64 âm thanh không hợp lệ." });
      }
      const audioBuf = Buffer.from(cleanB64, "base64");
      if (audioBuf.length === 0 || audioBuf.length > 12 * 1024 * 1024) {
        return json(res, 400, { error: "Dữ liệu âm thanh không hợp lệ hoặc vượt quá 12MB." });
      }

      const rawMime = typeof p?.mimeType === "string" ? p.mimeType.split(";")[0].trim().toLowerCase() : "audio/webm";
      const ALLOWED_MIMES = new Set([
        "audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a",
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg",
      ]);
      if (!ALLOWED_MIMES.has(rawMime)) {
        return json(res, 400, { error: `Định dạng âm thanh không được hỗ trợ (${rawMime}).` });
      }

      const resolved = deps?.resolveOpenAiKey?.() ?? {
        apiKey: process.env.OPENAI_API_KEY || process.env.OMB_OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      };
      const apiKey = resolved?.apiKey?.trim();
      if (!apiKey) {
        return json(res, 400, {
          error: "Chưa cấu hình OpenAI API Key (BYOK) trong Cài đặt để giải mã file ghi âm Whisper.",
          code: "OPENAI_KEY_REQUIRED",
        });
      }

      const baseUrl = (resolved?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp4": "mp4",
        "audio/m4a": "m4a",
        "audio/x-m4a": "m4a",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/ogg": "ogg",
      };
      const ext = extMap[rawMime] || "webm";
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audioBuf)], { type: rawMime }), `voice-sop.${ext}`);
      form.append("model", "whisper-1");
      form.append("language", typeof p?.language === "string" && p.language.trim() ? p.language.trim().slice(0, 8) : "vi");

      const doFetch = deps?.fetchImpl ?? fetch;
      try {
        const resp = await doFetch(`${baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(60_000),
        });
        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => "");
          return json(res, 502, { error: `Whisper API trả lỗi HTTP ${resp.status}: ${errTxt.slice(0, 180)}` });
        }
        const data = (await resp.json()) as { text?: unknown };
        const text = typeof data?.text === "string" ? data.text.trim() : "";
        try {
          const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
          getWorkspaceAuditLedger().append("default", actor, "enterprise.voice_transcribed", {
            bytes: audioBuf.length,
            mimeType: rawMime,
            chars: text.length,
          });
        } catch {
          // Non-fatal
        }
        return json(res, 200, { success: true, text });
      } catch (err) {
        return json(res, 502, { error: err instanceof Error ? err.message : "Không thể kết nối Whisper API" });
      }
    }

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

    const rejectOffboardedSession = (): boolean => {
      if (auth?.kind !== "session" || !auth.session.email) return false;
      const email = auth.session.email.trim().toLowerCase();
      const emp = getEnterpriseGovernanceStore().getState().employees[email];
      if (emp && emp.status === "offboarded") {
        try {
          getWorkspaceAuditLedger().append("default", email, "enterprise.offboarded_api_blocked", { path });
        } catch {}
        json(res, 403, { error: "employee_offboarded" });
        return true;
      }
      return false;
    };

    // ── Phase 1: Enterprise Governance, ABAC, Provisioning, DLP & Audit Trail ──
    if (method === "GET" && path === "/api/enterprise/governance") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const full = getEnterpriseGovernanceStore().getState();
      if (auth.scopes.includes("admin")) {
        return json(res, 200, { governance: full });
      }
      const actorEmail = (auth.kind === "session" ? auth.session.email : undefined)?.toLowerCase();
      const selfEmp = actorEmail ? full.employees[actorEmail] : undefined;
      return json(res, 200, {
        governance: {
          ...full,
          employees: selfEmp && actorEmail ? { [actorEmail]: selfEmp } : {},
        },
      });
    }

    if (method === "PUT" && path === "/api/enterprise/governance") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as Record<string, unknown>;
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const next = getEnterpriseGovernanceStore().updateGovernance(
        {
          constitution: (body.constitution as Record<string, unknown> | undefined) as Parameters<ReturnType<typeof getEnterpriseGovernanceStore>["updateGovernance"]>[0]["constitution"],
          zoneDataTiers: body.zoneDataTiers as Record<string, DataClassificationTier> | undefined,
          employeeUpdates: body.employeeUpdates as Parameters<ReturnType<typeof getEnterpriseGovernanceStore>["updateGovernance"]>[0]["employeeUpdates"],
        },
        actor,
      );
      return json(res, 200, { success: true, governance: next });
    }

    if (method === "POST" && path === "/api/enterprise/employees/provision") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as {
        employees?: Array<{
          email: string;
          name?: string;
          role?: EmployeeRole;
          zone?: string;
          maxDataTier?: DataClassificationTier;
          personalBotId?: string;
          personalBotName?: string;
        }>;
        email?: string;
        name?: string;
        role?: EmployeeRole;
        zone?: string;
        maxDataTier?: DataClassificationTier;
      };
      const items = Array.isArray(body.employees)
        ? body.employees.slice(0, 20)
        : body.email
          ? [{ email: body.email, name: body.name, role: body.role, zone: body.zone, maxDataTier: body.maxDataTier }]
          : [];
      if (items.length === 0) {
        return json(res, 400, { error: "email or employees[] is required" });
      }
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      if (body.email?.trim().toLowerCase() === actor.trim().toLowerCase()) {
        return json(res, 400, { error: "self_offboard_forbidden" });
      }
      const storeGov = getEnterpriseGovernanceStore();
      const provisioned = items
        .filter((item) => typeof item.email === "string" && item.email.includes("@"))
        .map((item) => {
          const role: EmployeeRole = item.role && item.role in ROLE_DEFAULT_MAX_TIER ? item.role : "member";
          const empName = item.name || item.email.split("@")[0]!;
          const desiredBotName = item.personalBotName || `Trợ lý ${empName}`;
          const existing = storeGov.getState().employees[item.email.trim().toLowerCase()];
          let botId = item.personalBotId ?? existing?.personalBotId;
          let botName = existing?.personalBotName ?? desiredBotName;
          if (botId && existing?.status === "offboarded" && deps?.reactivatePersonalBot) {
            deps.reactivatePersonalBot(botId, item.email.trim().toLowerCase());
          }
          if (!botId && deps?.provisionPersonalBot) {
            const created = deps.provisionPersonalBot({
              email: item.email.trim().toLowerCase(),
              name: empName,
              zone: item.zone,
              botName: desiredBotName,
              namespace: `work-context/${item.email.trim().toLowerCase()}`,
            });
            if (created) {
              botId = created.id;
              botName = created.name;
            }
          }
          return storeGov.upsertEmployee(
            {
              email: item.email,
              name: empName,
              role,
              zone: item.zone,
              maxDataTier: item.maxDataTier ?? ROLE_DEFAULT_MAX_TIER[role],
              personalBotId: botId,
              personalBotName: botName,
            },
            actor,
          );
        });
      return json(res, 200, { success: true, provisioned, governance: storeGov.getState() });
    }

    if (method === "POST" && path === "/api/enterprise/employees/offboard") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as { email?: string; successorEmail?: string; workSummary?: string };
      if (!body.email || !body.email.includes("@")) {
        return json(res, 400, { error: "valid email is required" });
      }
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const storeGov = getEnterpriseGovernanceStore();
      const offboarded = storeGov.offboardEmployee(body.email, actor);
      if (!offboarded) return json(res, 404, { error: "employee not found" });
      if (offboarded.personalBotId && deps?.offboardPersonalBot) {
        deps.offboardPersonalBot(offboarded.personalBotId);
      }
      const handover = getEnterpriseBrainStore().recordOffboardingHandover(
        {
          departedEmail: offboarded.email,
          departedName: offboarded.name,
          zone: offboarded.zone || "all",
          successorEmail: body.successorEmail,
          workSummary: body.workSummary || "",
          preservedWorkNamespace: offboarded.namespaces.workContext,
          purgedPrivateNamespace: offboarded.namespaces.privatePersonal,
        },
        actor,
      );
      return json(res, 200, { success: true, employee: offboarded, handover, governance: storeGov.getState() });
    }

    if (method === "POST" && path === "/api/enterprise/dlp/test") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const body = (await readBody(req)) as { text?: string; blockOnForbiddenTopic?: boolean };
      const gov = getEnterpriseGovernanceStore().getState();
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const result = scanAndRedactText(String(body.text ?? ""), {
        dlpEnabled: gov.constitution.dlpEnabled,
        censorshipEnabled: gov.constitution.censorshipEnabled,
        forbiddenTopics: gov.constitution.forbiddenTopics,
        blockOnForbiddenTopic: body.blockOnForbiddenTopic === true,
        auditActor: actor,
        auditAction: "enterprise.dlp_policy_test",
      });
      return json(res, 200, { result });
    }

    if (method === "GET" && path === "/api/enterprise/audit-trail") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const actor = url.searchParams.get("actor") ?? undefined;
      const action = url.searchParams.get("action") ?? undefined;
      const q = url.searchParams.get("q") ?? undefined;
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50;
      const trail = getEnterpriseGovernanceStore().queryAuditTrail({ actor, action, q, limit });
      return json(res, 200, trail);
    }

    // ── Phase 2: Org Decision Ledger, Knowledge Flywheel, Handover & Onboarding Brief ──
    if (method === "GET" && path === "/api/enterprise/brain") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const isAdmin = auth.scopes.includes("admin");
      const actorEmail = (auth.kind === "session" ? auth.session.email : undefined)?.toLowerCase();
      const emp = actorEmail ? getEnterpriseGovernanceStore().getState().employees[actorEmail] : undefined;
      const brain = getEnterpriseBrainStore().getScopedState({
        isAdmin,
        employeeZone: emp?.zone,
        employeeEmail: actorEmail,
      });
      return json(res, 200, { brain });
    }

    if (method === "POST" && path === "/api/enterprise/decisions/propose") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as { title?: string; summary?: string; scopeZone?: string; effectiveFrom?: string; autoApprove?: boolean };
      if (!body.title?.trim() || !body.summary?.trim()) {
        return json(res, 400, { error: "title and summary are required" });
      }
      if (rejectOffboardedSession()) return;
      const isAdmin = auth.scopes.includes("admin");
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || (isAdmin ? "admin" : "employee");
      const emp = auth.kind === "session" && auth.session.email ? getEnterpriseGovernanceStore().getState().employees[auth.session.email.toLowerCase()] : undefined;
      if (!isAdmin && body.scopeZone && body.scopeZone.trim().toLowerCase() !== "all") {
        if (emp?.zone && emp.zone.trim().toLowerCase() !== body.scopeZone.trim().toLowerCase()) {
          return json(res, 403, { error: "cross_zone_propose_denied" });
        }
      }
      const canAuto = Boolean(body.autoApprove && isAdmin);
      const rec = getEnterpriseBrainStore().proposeDecision(
        { title: body.title, summary: body.summary, scopeZone: body.scopeZone, effectiveFrom: body.effectiveFrom, autoApprove: canAuto },
        actor,
      );
      const brain = getEnterpriseBrainStore().getScopedState({ isAdmin, employeeZone: emp?.zone, employeeEmail: actor.toLowerCase() });
      return json(res, 200, { success: true, decision: rec, brain });
    }

    if (method === "POST" && path === "/api/enterprise/decisions/review") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as { id?: string; status?: PromotionStatus };
      if (!body.id || !body.status || !["proposed", "approved", "deprecated"].includes(body.status)) {
        return json(res, 400, { error: "valid id and status are required" });
      }
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const updated = getEnterpriseBrainStore().reviewDecision(body.id, body.status, actor);
      if (!updated) return json(res, 404, { error: "decision not found" });
      return json(res, 200, { success: true, decision: updated, brain: getEnterpriseBrainStore().getState() });
    }

    if (method === "POST" && path === "/api/enterprise/knowledge/propose") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as { kind?: KnowledgeKind; title?: string; content?: string; scopeZone?: string; autoApprove?: boolean };
      if (!body.title?.trim() || !body.content?.trim()) {
        return json(res, 400, { error: "title and content are required" });
      }
      if (rejectOffboardedSession()) return;
      const isAdmin = auth.scopes.includes("admin");
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || (isAdmin ? "admin" : "employee");
      const emp = auth.kind === "session" && auth.session.email ? getEnterpriseGovernanceStore().getState().employees[auth.session.email.toLowerCase()] : undefined;
      if (!isAdmin && body.scopeZone && body.scopeZone.trim().toLowerCase() !== "all") {
        if (emp?.zone && emp.zone.trim().toLowerCase() !== body.scopeZone.trim().toLowerCase()) {
          return json(res, 403, { error: "cross_zone_propose_denied" });
        }
      }
      const canAuto = Boolean(body.autoApprove && isAdmin);
      const entry = getEnterpriseBrainStore().proposeKnowledge(
        { kind: body.kind, title: body.title, content: body.content, scopeZone: body.scopeZone, autoApprove: canAuto },
        actor,
      );
      const brain = getEnterpriseBrainStore().getScopedState({ isAdmin, employeeZone: emp?.zone, employeeEmail: actor.toLowerCase() });
      return json(res, 200, { success: true, entry, brain });
    }

    if (method === "POST" && path === "/api/enterprise/knowledge/review") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const body = (await readBody(req)) as { id?: string; status?: PromotionStatus };
      if (!body.id || !body.status || !["proposed", "approved", "deprecated"].includes(body.status)) {
        return json(res, 400, { error: "valid id and status are required" });
      }
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const updated = getEnterpriseBrainStore().reviewKnowledge(body.id, body.status, actor);
      if (!updated) return json(res, 404, { error: "knowledge entry not found" });
      return json(res, 200, { success: true, entry: updated, brain: getEnterpriseBrainStore().getState() });
    }

    if (method === "GET" && path === "/api/enterprise/onboarding-brief") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const isAdmin = auth.scopes.includes("admin");
      const actorEmail = (auth.kind === "session" ? auth.session.email : undefined)?.toLowerCase();
      const emp = actorEmail ? getEnterpriseGovernanceStore().getState().employees[actorEmail] : undefined;
      const requestedZone = url.searchParams.get("zone") ?? undefined;
      const zone = isAdmin ? requestedZone : (emp?.zone || "all");
      const employeeEmail = url.searchParams.get("email") ?? undefined;
      const brief = getEnterpriseBrainStore().buildOnboardingBrief({ zone, employeeEmail });
      return json(res, 200, { brief });
    }

    if (method === "GET" && path === "/api/enterprise/export") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const actor = (auth.kind === "session" ? auth.session.email : undefined) || "admin";
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: actor,
        governance: getEnterpriseGovernanceStore().getState(),
        brain: getEnterpriseBrainStore().getState(),
        team: getEnterpriseTeamOrchestrator().getState(),
      };
      getWorkspaceAuditLedger().append("default", actor, "enterprise.data_exported", {
        employees: Object.keys(payload.governance.employees).length,
        decisions: Object.keys(payload.brain.decisions).length,
        knowledge: Object.keys(payload.brain.knowledge).length,
        handovers: Object.keys(payload.brain.handovers).length,
      });
      return json(res, 200, payload);
    }

    // â”€â”€ Phase 3: Hierarchical Team Orchestration, DAG Workflows & Proactive Escalations â”€â”€
    const getTeamActor = () => {
      const isAdmin = Boolean(auth?.scopes.includes("admin"));
      const actorEmail = (auth?.kind === "session" ? auth.session.email : undefined)?.toLowerCase();
      const emp = actorEmail ? getEnterpriseGovernanceStore().getState().employees[actorEmail] : undefined;
      const canApprove = isAdmin || emp?.role === "manager" || emp?.role === "owner";
      const actor = actorEmail || (isAdmin ? "admin" : "employee");
      return { isAdmin, actorEmail, emp, canApprove, actor };
    };
    const scopedTeam = (ctx: ReturnType<typeof getTeamActor>) =>
      getEnterpriseTeamOrchestrator().getScopedState({
        isAdmin: ctx.isAdmin,
        employeeZone: ctx.emp?.zone,
        employeeEmail: ctx.actorEmail,
      });
    const hasZoneAccess = (ctx: ReturnType<typeof getTeamActor>, targetZone?: string): boolean => {
      if (ctx.isAdmin) return true;
      if (!targetZone || targetZone.trim().toLowerCase() === "all") return true;
      return matchesZone(targetZone, ctx.emp?.zone);
    };

    if (method === "GET" && path === "/api/enterprise/team") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      return json(res, 200, { team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/tasks") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as {
        title?: string;
        description?: string;
        zone?: string;
        priority?: WorkPriority;
        assignedBotId?: string;
        assignedBotName?: string;
        leadBotId?: string;
        parentTaskId?: string;
        dueAt?: number;
        subtasks?: Array<{ title: string; description?: string; assignedBotId: string; assignedBotName?: string }>;
      };
      const orch = getEnterpriseTeamOrchestrator();
      if (body.parentTaskId && Array.isArray(body.subtasks) && body.subtasks.length > 0) {
        const parent = orch.getState().workItems[body.parentTaskId];
        if (!parent) return json(res, 404, { error: "parent task not found" });
        if (!hasZoneAccess(ctx, parent.zone)) return json(res, 403, { error: "cross_zone_denied" });
        const created = orch.delegateSubtasks(body.parentTaskId, body.subtasks, ctx.actor);
        return json(res, 200, { success: true, subtasks: created, team: scopedTeam(ctx) });
      }
      if (!body.title?.trim() || !body.assignedBotId?.trim()) {
        return json(res, 400, { error: "title and assignedBotId are required" });
      }
      if (!hasZoneAccess(ctx, body.zone)) return json(res, 403, { error: "cross_zone_denied" });
      const task = orch.createTask(
        {
          title: body.title,
          description: body.description,
          zone: body.zone,
          priority: body.priority,
          assignedBotId: body.assignedBotId,
          assignedBotName: body.assignedBotName,
          leadBotId: body.leadBotId,
          parentTaskId: body.parentTaskId,
          dueAt: body.dueAt,
        },
        ctx.actor,
      );
      return json(res, 200, { success: true, task, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/tasks/review") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as {
        taskId?: string;
        action?: "progress" | "approved" | "rejected";
        status?: WorkItemStatus;
        progressPct?: number;
        blockerReason?: string;
        deliverable?: string;
        notes?: string;
      };
      if (!body.taskId) return json(res, 400, { error: "taskId is required" });
      const orch = getEnterpriseTeamOrchestrator();
      const target = orch.getState().workItems[body.taskId];
      if (!target) return json(res, 404, { error: "task not found" });
      if (!hasZoneAccess(ctx, target.zone)) return json(res, 403, { error: "cross_zone_denied" });
      if (body.action === "approved" || body.action === "rejected") {
        if (!ctx.canApprove) return json(res, 403, { error: "manager_or_admin_required_to_review" });
        const updated = orch.reviewTeamTask(body.taskId, body.action, body.notes ?? "", ctx.actor);
        return json(res, 200, { success: true, task: updated, team: scopedTeam(ctx) });
      }
      const updated = orch.updateTaskProgress(
        body.taskId,
        { status: body.status, progressPct: body.progressPct, blockerReason: body.blockerReason, deliverable: body.deliverable },
        ctx.actor,
      );
      return json(res, 200, { success: true, task: updated, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/workflows") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as {
        name?: string;
        description?: string;
        scopeZone?: string;
        trigger?: "manual" | "schedule" | "event";
        maxHops?: number;
        budgetCapUsd?: number;
        steps?: DagWorkflowStep[];
        publish?: boolean;
      };
      if (!body.name?.trim() || !Array.isArray(body.steps) || body.steps.length === 0) {
        return json(res, 400, { error: "name and steps[] are required" });
      }
      const orch = getEnterpriseTeamOrchestrator();
      const workflow = orch.createDagWorkflow(
        {
          name: body.name,
          description: body.description,
          scopeZone: body.scopeZone,
          trigger: body.trigger,
          maxHops: body.maxHops,
          budgetCapUsd: body.budgetCapUsd,
          steps: body.steps,
          publish: body.publish ?? true,
        },
        ctx.actor,
      );
      return json(res, 200, { success: true, workflow, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/workflows/run") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as {
        workflowId?: string;
        runId?: string;
        action?: "continue" | "approve" | "reject";
        notes?: string;
      };
      const orch = getEnterpriseTeamOrchestrator();
      if (body.runId) {
        const existingRun = orch.getState().dagRuns[body.runId];
        if (!existingRun) return json(res, 404, { error: "dag run not found" });
        if (!hasZoneAccess(ctx, existingRun.scopeZone)) return json(res, 403, { error: "cross_zone_denied" });
        if ((body.action === "approve" || body.action === "reject") && !ctx.canApprove) {
          return json(res, 403, { error: "manager_or_admin_required_to_approve" });
        }
        const run = orch.advanceDagRun(body.runId, body.action ?? "continue", ctx.actor, body.notes);
        return json(res, 200, { success: true, run, team: scopedTeam(ctx) });
      }
      if (!body.workflowId) return json(res, 400, { error: "workflowId or runId is required" });
      const wf = orch.getState().workflows[body.workflowId];
      if (!wf) return json(res, 404, { error: "workflow not found" });
      if (!hasZoneAccess(ctx, wf.scopeZone)) return json(res, 403, { error: "cross_zone_denied" });
      const run = orch.startDagRun(body.workflowId, ctx.actor);
      return json(res, 200, { success: true, run, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/escalations/resolve") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as { id?: string; decision?: "approved" | "reassigned" | "dismissed"; note?: string };
      if (!body.id || !body.decision || !["approved", "reassigned", "dismissed"].includes(body.decision)) {
        return json(res, 400, { error: "valid id and decision are required" });
      }
      const orch = getEnterpriseTeamOrchestrator();
      const targetEsc = orch.getState().escalations[body.id];
      if (!targetEsc) return json(res, 404, { error: "escalation not found" });
      if (!hasZoneAccess(ctx, targetEsc.zone)) return json(res, 403, { error: "cross_zone_denied" });
      if (!ctx.canApprove) return json(res, 403, { error: "manager_or_admin_required_to_resolve" });
      const card = orch.resolveEscalation(body.id, body.decision, ctx.actor, body.note);
      return json(res, 200, { success: true, escalation: card, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/reminders") {
      if (!auth || !auth.scopes.includes("admin")) return json(res, 403, { error: "admin scope required" });
      if (requireEnterpriseVip(res, json)) return;
      const ctx = getTeamActor();
      const body = (await readBody(req)) as {
        title?: string;
        schedule?: "hourly" | "daily_0900" | "daily_1700" | "weekly_mon";
        targetZone?: string;
        targetChannel?: "dashboard" | "group_chat";
      };
      if (!body.title?.trim()) return json(res, 400, { error: "title is required" });
      const orch = getEnterpriseTeamOrchestrator();
      const reminder = orch.createReminder(
        { title: body.title, schedule: body.schedule, targetZone: body.targetZone, targetChannel: body.targetChannel },
        ctx.actor,
      );
      return json(res, 200, { success: true, reminder, team: scopedTeam(ctx) });
    }

    if (method === "POST" && path === "/api/enterprise/team/sweep") {
      if (!auth) return json(res, 401, { error: "unauthorized" });
      if (requireEnterpriseVip(res, json)) return;
      if (rejectOffboardedSession()) return;
      const ctx = getTeamActor();
      const orch = getEnterpriseTeamOrchestrator();
      const sweep = orch.runProactiveSweep(ctx.actor);
      return json(res, 200, { success: true, sweep, team: scopedTeam(ctx) });
    }

    return PASS;
  };
}

