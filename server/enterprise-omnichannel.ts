import { randomInt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceAuditLedger } from "./agent/merkle-audit.ts";
import { matchesZone } from "./enterprise-brain.ts";
import { scanAndRedactText } from "./enterprise-dlp.ts";
import {
  DATA_TIER_RANK,
  getEnterpriseGovernanceStore,
  type DataClassificationTier,
} from "./enterprise-governance.ts";

export type ChannelPlatform = "zalo" | "telegram" | "whatsapp" | "discord";

export interface OmnichannelGroupConfig {
  id: string;
  platform: ChannelPlatform;
  name: string;
  groupId: string;
  botId: string;
  botName: string;
  scopeZone: string;
  maxChannelTier: DataClassificationTier;
  allowExternalGuests: boolean;
  telegramBotToken?: string;
  discordWebhookUrl?: string;
  webhookSecret?: string;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface BindingOtpChallenge {
  code: string;
  employeeEmail: string;
  platform: ChannelPlatform;
  expiresAt: number;
  createdBy: string;
  failedAttempts?: number;
}

export interface VerifiedIdentityBinding {
  id: string;
  employeeEmail: string;
  platform: ChannelPlatform;
  externalUserId: string;
  externalDisplayName: string;
  status: "active" | "revoked";
  verifiedAt: number;
  revokedAt?: number;
}

export interface OmnichannelSyncEvent {
  id: string;
  platform: ChannelPlatform;
  channelConfigId: string;
  groupId: string;
  scopeZone: string;
  senderExternalId: string;
  senderEmail?: string;
  isGuestMode: boolean;
  effectiveTier: DataClassificationTier;
  inboundText: string;
  outboundReply: string;
  replyToExternalId?: string;
  blocked: boolean;
  blockReason?: string;
  createdAt: number;
}

export interface OmnichannelState {
  channels: Record<string, OmnichannelGroupConfig>;
  otps: Record<string, BindingOtpChallenge>;
  bindings: Record<string, VerifiedIdentityBinding>;
  syncEvents: OmnichannelSyncEvent[];
  updatedAt: number;
}

const VALID_PLATFORMS: readonly ChannelPlatform[] = ["zalo", "telegram", "whatsapp", "discord"];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bindingKey(platform: ChannelPlatform, externalUserId: string): string {
  return `${platform}:${externalUserId.trim()}`;
}

function maskSecret(val?: string): string | undefined {
  if (!val || !val.trim()) return undefined;
  const s = val.trim();
  if (s.length <= 6) return "***";
  return `***${s.slice(-4)}`;
}

function minTier(a: DataClassificationTier, b: DataClassificationTier, c: DataClassificationTier): DataClassificationTier {
  const rankA = DATA_TIER_RANK[a] ?? 0;
  const rankB = DATA_TIER_RANK[b] ?? 0;
  const rankC = DATA_TIER_RANK[c] ?? 0;
  const minRank = Math.min(rankA, rankB, rankC);
  const found = (Object.entries(DATA_TIER_RANK) as Array<[DataClassificationTier, number]>).find(
    ([, r]) => r === minRank,
  );
  return found ? found[0] : "public";
}

export class EnterpriseOmnichannelGateway {
  private readonly filePath: string;
  private state: OmnichannelState;
  private readonly processedUpdateIds = new Set<string>();

  constructor(dataDir?: string) {
    const baseDir =
      dataDir ||
      process.env.RAI2_DATA_DIR ||
      process.env.OMB_DATA_DIR ||
      process.env.DATA_DIR ||
      "/tmp";
    this.filePath = join(baseDir, "enterprise-omnichannel.json");
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): OmnichannelState {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<OmnichannelState>;
        return {
          channels: parsed.channels ?? {},
          otps: parsed.otps ?? {},
          bindings: parsed.bindings ?? {},
          syncEvents: Array.isArray(parsed.syncEvents) ? parsed.syncEvents : [],
          updatedAt: parsed.updatedAt ?? Date.now(),
        };
      } catch {
        // Fallback on corrupt file
      }
    }
    return { channels: {}, otps: {}, bindings: {}, syncEvents: [], updatedAt: Date.now() };
  }

  private saveToDisk(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  public verifyTelegramWebhookSecret(groupId: string, providedSecret: string): { ok: boolean; telegramBotToken?: string } {
    const ch = Object.values(this.state.channels).find(
      (c) => c.platform === "telegram" && c.groupId === groupId.trim() && c.enabled,
    );
    if (!ch) return { ok: false };
    if (ch.webhookSecret) {
      const a = Buffer.from(ch.webhookSecret, "utf8");
      const b = Buffer.from(providedSecret, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false };
      }
    }
    return { ok: true, telegramBotToken: ch.telegramBotToken };
  }

  public claimWebhookUpdateOnce(updateKey: string | undefined): boolean {
    if (!updateKey) return true;
    if (this.processedUpdateIds.has(updateKey)) return false;
    if (this.processedUpdateIds.size > 2000) {
      const first = this.processedUpdateIds.values().next().value;
      if (first) this.processedUpdateIds.delete(first);
    }
    this.processedUpdateIds.add(updateKey);
    return true;
  }

  public revokeSingleBinding(platform: ChannelPlatform, externalUserId: string, actor = "admin"): boolean {
    const key = bindingKey(platform, externalUserId);
    const b = this.state.bindings[key];
    if (!b || b.status !== "active") return false;
    b.status = "revoked";
    b.revokedAt = Date.now();
    this.state.updatedAt = Date.now();
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.channel_binding_revoked", {
      employeeEmail: b.employeeEmail,
      platform,
      externalUserId,
    });
    return true;
  }

  public async dispatchTelegramReply(token: string, chatId: string, text: string, replyToMessageId?: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, 4000),
          ...(replyToMessageId && /^\d+$/.test(replyToMessageId) ? { reply_to_message_id: Number(replyToMessageId) } : {}),
        }),
      });
    } catch {
      // Non-fatal network dispatch
    }
  }

  public getStateMasked(): OmnichannelState {
    const cloned = structuredClone(this.state);
    for (const ch of Object.values(cloned.channels)) {
      if (ch.telegramBotToken) ch.telegramBotToken = maskSecret(ch.telegramBotToken);
      if (ch.discordWebhookUrl) ch.discordWebhookUrl = maskSecret(ch.discordWebhookUrl);
      if (ch.webhookSecret) ch.webhookSecret = maskSecret(ch.webhookSecret);
    }
    return cloned;
  }

  public getScopedStateMasked(opts: {
    isAdmin: boolean;
    employeeZone?: string;
    employeeEmail?: string;
  }): OmnichannelState {
    const full = this.getStateMasked();
    if (opts.isAdmin) return full;
    const email = opts.employeeEmail?.trim().toLowerCase();
    const zone = opts.employeeZone?.trim();
    const channels: Record<string, OmnichannelGroupConfig> = {};
    for (const [id, ch] of Object.entries(full.channels)) {
      if (matchesZone(ch.scopeZone, zone)) channels[id] = ch;
    }
    const bindings: Record<string, VerifiedIdentityBinding> = {};
    for (const [k, b] of Object.entries(full.bindings)) {
      if (email && b.employeeEmail.toLowerCase() === email) bindings[k] = b;
    }
    const otps: Record<string, BindingOtpChallenge> = {};
    for (const [k, o] of Object.entries(full.otps)) {
      if (email && o.employeeEmail.toLowerCase() === email) otps[k] = o;
    }
    const syncEvents = full.syncEvents.filter((ev) => matchesZone(ev.scopeZone, zone));
    return { channels, otps, bindings, syncEvents, updatedAt: full.updatedAt };
  }

  public upsertChannel(
    input: {
      id?: string;
      platform: ChannelPlatform;
      name: string;
      groupId: string;
      botId?: string;
      botName?: string;
      scopeZone?: string;
      maxChannelTier?: DataClassificationTier;
      allowExternalGuests?: boolean;
      telegramBotToken?: string;
      discordWebhookUrl?: string;
      webhookSecret?: string;
      enabled?: boolean;
    },
    actor = "admin",
  ): OmnichannelGroupConfig {
    if (!VALID_PLATFORMS.includes(input.platform)) {
      throw new Error(`Unsupported channel platform: ${input.platform}`);
    }
    const name = input.name.trim().slice(0, 120);
    const groupId = input.groupId.trim().slice(0, 120);
    if (!name || !groupId) throw new Error("Channel name and groupId are required");

    const existing = input.id
      ? this.state.channels[input.id]
      : Object.values(this.state.channels).find(
          (c) => c.platform === input.platform && c.groupId === groupId,
        );
    const now = Date.now();
    const cfg: OmnichannelGroupConfig = {
      id: existing?.id ?? makeId("ch"),
      platform: input.platform,
      name,
      groupId,
      botId: (input.botId ?? existing?.botId ?? "enterprise-group-bot").trim(),
      botName: (input.botName ?? existing?.botName ?? "Trợ lý Nhóm AI").trim(),
      scopeZone: (input.scopeZone ?? existing?.scopeZone ?? "all").trim() || "all",
      maxChannelTier:
        input.maxChannelTier && input.maxChannelTier in DATA_TIER_RANK
          ? input.maxChannelTier
          : (existing?.maxChannelTier ?? "zone"),
      allowExternalGuests: input.allowExternalGuests ?? existing?.allowExternalGuests ?? false,
      ...(input.telegramBotToken?.trim()
        ? { telegramBotToken: input.telegramBotToken.trim() }
        : existing?.telegramBotToken
          ? { telegramBotToken: existing.telegramBotToken }
          : {}),
      ...(input.discordWebhookUrl?.trim()
        ? { discordWebhookUrl: input.discordWebhookUrl.trim() }
        : existing?.discordWebhookUrl
          ? { discordWebhookUrl: existing.discordWebhookUrl }
          : {}),
      ...(input.webhookSecret?.trim()
        ? { webhookSecret: input.webhookSecret.trim() }
        : existing?.webhookSecret
          ? { webhookSecret: existing.webhookSecret }
          : {}),
      enabled: input.enabled ?? existing?.enabled ?? true,
      createdBy: existing?.createdBy ?? actor,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.state.channels[cfg.id] = cfg;
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", actor, "enterprise.omnichannel_configured", {
      channelId: cfg.id,
      platform: cfg.platform,
      groupId: cfg.groupId,
      scopeZone: cfg.scopeZone,
      maxChannelTier: cfg.maxChannelTier,
      allowExternalGuests: cfg.allowExternalGuests,
    });
    return this.getStateMasked().channels[cfg.id]!;
  }

  public issueBindingOtp(
    employeeEmail: string,
    platform: ChannelPlatform,
    actor = "employee",
  ): BindingOtpChallenge {
    if (!VALID_PLATFORMS.includes(platform)) throw new Error("Invalid platform");
    const email = employeeEmail.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Valid employeeEmail is required");
    const now = Date.now();
    // Purge expired OTPs
    for (const [k, v] of Object.entries(this.state.otps)) {
      if (v.expiresAt < now) delete this.state.otps[k];
    }
    const code = String(randomInt(100000, 999999));
    const challenge: BindingOtpChallenge = {
      code,
      employeeEmail: email,
      platform,
      expiresAt: now + 10 * 60_000,
      createdBy: actor,
    };
    this.state.otps[code] = challenge;
    this.state.updatedAt = now;
    this.saveToDisk();
    return structuredClone(challenge);
  }

  public verifyBindingOtp(
    code: string,
    externalUserId: string,
    externalDisplayName?: string,
  ): VerifiedIdentityBinding | null {
    const cleanCode = code.trim();
    const challenge = this.state.otps[cleanCode];
    const now = Date.now();
    if (!challenge || challenge.expiresAt < now) {
      if (challenge) {
        delete this.state.otps[cleanCode];
        this.saveToDisk();
      }
      // Increment failed attempt counter on all active OTPs to thwart brute-force guessing
      for (const [k, v] of Object.entries(this.state.otps)) {
        v.failedAttempts = (v.failedAttempts ?? 0) + 1;
        if (v.failedAttempts >= 5) delete this.state.otps[k];
      }
      this.saveToDisk();
      return null;
    }
    const extId = externalUserId.trim();
    if (!extId) return null;
    const key = bindingKey(challenge.platform, extId);
    const binding: VerifiedIdentityBinding = {
      id: makeId("bind"),
      employeeEmail: challenge.employeeEmail,
      platform: challenge.platform,
      externalUserId: extId,
      externalDisplayName: (externalDisplayName ?? extId).trim().slice(0, 120),
      status: "active",
      verifiedAt: now,
    };
    this.state.bindings[key] = binding;
    delete this.state.otps[cleanCode];
    this.state.updatedAt = now;
    this.saveToDisk();
    getWorkspaceAuditLedger().append("default", binding.employeeEmail, "enterprise.channel_identity_bound", {
      platform: binding.platform,
      externalUserId: binding.externalUserId,
    });
    return structuredClone(binding);
  }

  public revokeBindingsForEmployee(employeeEmail: string, actor = "admin"): number {
    const email = employeeEmail.trim().toLowerCase();
    const now = Date.now();
    let count = 0;
    for (const b of Object.values(this.state.bindings)) {
      if (b.employeeEmail.toLowerCase() === email && b.status === "active") {
        b.status = "revoked";
        b.revokedAt = now;
        count += 1;
      }
    }
    if (count > 0) {
      this.state.updatedAt = now;
      this.saveToDisk();
      getWorkspaceAuditLedger().append("default", actor, "enterprise.channel_binding_revoked", {
        employeeEmail: email,
        revokedCount: count,
      });
    }
    return count;
  }

  /**
   * Evaluates an inbound message from Zalo / Telegram / WhatsApp / Discord:
   * - Supports `/bind <OTP>` directly in chat
   * - Computes EffectiveScope = UserScope ∩ BotScope ∩ ChannelScope
   * - Blocks offboarded employees & enforces Confused-Deputy lockdown for external guests
   * - Runs Inbound DLP + Outbound Censorship + records bidirectional sync event
   */
  public processInboundMessage(input: {
    platform: ChannelPlatform;
    channelGroupId: string;
    externalUserId: string;
    externalDisplayName?: string;
    messageText: string;
    botMaxTier?: DataClassificationTier;
    replyToExternalId?: string;
    simulatedReply?: string;
  }): {
    allowed: boolean;
    reason: string;
    effectiveTier: DataClassificationTier;
    isGuestMode: boolean;
    senderEmail?: string;
    sanitizedInboundText: string;
    outboundReply: string;
    syncEvent?: OmnichannelSyncEvent;
  } {
    const rawText = input.messageText.trim();
    const channel = Object.values(this.state.channels).find(
      (c) => c.platform === input.platform && c.groupId === input.channelGroupId.trim() && c.enabled,
    );
    if (!channel) {
      return {
        allowed: false,
        reason: "channel_not_configured",
        effectiveTier: "public",
        isGuestMode: true,
        sanitizedInboundText: "",
        outboundReply: "",
      };
    }

    // Handle `/bind <6-digit-OTP>` directly inside Telegram / Zalo / WhatsApp / Discord
    const bindMatch = rawText.match(/^\/bind\s+(\d{6})$/i);
    if (bindMatch) {
      const bound = this.verifyBindingOtp(bindMatch[1]!, input.externalUserId, input.externalDisplayName);
      const reply = bound
        ? `✅ Đã xác thực định danh ${bound.employeeEmail} trên ${input.platform.toUpperCase()}!`
        : "❌ Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng tạo mã mới trên Dashboard rai2.si.";
      return {
        allowed: Boolean(bound),
        reason: bound ? "identity_bound" : "invalid_otp",
        effectiveTier: "public",
        isGuestMode: !bound,
        senderEmail: bound?.employeeEmail,
        sanitizedInboundText: rawText,
        outboundReply: reply,
      };
    }

    const gov = getEnterpriseGovernanceStore().getState();
    const bKey = bindingKey(input.platform, input.externalUserId);
    const binding = this.state.bindings[bKey];
    const emp = binding && binding.status === "active" ? gov.employees[binding.employeeEmail] : undefined;

    if (binding && binding.status === "revoked") {
      getWorkspaceAuditLedger().append("default", binding.employeeEmail, "enterprise.omnichannel_revoked_blocked", {
        platform: input.platform,
        groupId: channel.groupId,
      });
      return {
        allowed: false,
        reason: "binding_revoked",
        effectiveTier: "public",
        isGuestMode: false,
        senderEmail: binding.employeeEmail,
        sanitizedInboundText: "",
        outboundReply: "",
      };
    }

    if (emp && emp.status === "offboarded") {
      getWorkspaceAuditLedger().append("default", emp.email, "enterprise.omnichannel_offboarded_blocked", {
        platform: input.platform,
        groupId: channel.groupId,
      });
      return {
        allowed: false,
        reason: "employee_offboarded",
        effectiveTier: "public",
        isGuestMode: false,
        senderEmail: emp.email,
        sanitizedInboundText: "",
        outboundReply: "",
      };
    }

    const isGuestMode = !emp;
    if (isGuestMode && !channel.allowExternalGuests) {
      getWorkspaceAuditLedger().append("default", input.externalUserId, "enterprise.omnichannel_guest_blocked", {
        platform: input.platform,
        groupId: channel.groupId,
      });
      return {
        allowed: false,
        reason: "unverified_guest_blocked",
        effectiveTier: "public",
        isGuestMode: true,
        sanitizedInboundText: "",
        outboundReply: "",
      };
    }

    if (
      emp &&
      emp.role !== "owner" &&
      emp.role !== "admin" &&
      channel.scopeZone !== "all" &&
      !matchesZone(channel.scopeZone, emp.zone)
    ) {
      return {
        allowed: false,
        reason: `cross_zone_denied:${emp.zone}_ne_${channel.scopeZone}`,
        effectiveTier: "public",
        isGuestMode: false,
        senderEmail: emp.email,
        sanitizedInboundText: "",
        outboundReply: "",
      };
    }

    const botTier = input.botMaxTier ?? "zone";
    const effectiveTier: DataClassificationTier = isGuestMode
      ? "public"
      : minTier(emp.maxDataTier, botTier, channel.maxChannelTier);

    const actor = emp?.email ?? `guest:${input.platform}:${input.externalUserId}`;
    const inboundDlp = scanAndRedactText(rawText, {
      dlpEnabled: gov.constitution.dlpEnabled,
      censorshipEnabled: false,
      blockOnForbiddenTopic: false,
      auditActor: actor,
      auditAction: "enterprise.omnichannel_inbound_dlp",
    });

    const draftReply =
      input.simulatedReply?.trim() ||
      `[${channel.botName} · ${effectiveTier.toUpperCase()}${isGuestMode ? " · GUEST LOCKDOWN" : ""}] Đã tiếp nhận từ ${emp ? emp.name : input.externalDisplayName || input.externalUserId}: "${inboundDlp.sanitizedText.slice(0, 140)}"`;

    const outboundDlp = scanAndRedactText(draftReply, {
      dlpEnabled: gov.constitution.dlpEnabled,
      censorshipEnabled: gov.constitution.censorshipEnabled,
      forbiddenTopics: gov.constitution.forbiddenTopics,
      blockOnForbiddenTopic: false,
      auditActor: channel.botName,
      auditAction: "enterprise.omnichannel_outbound_dlp",
    });

    const event: OmnichannelSyncEvent = {
      id: makeId("omni"),
      platform: input.platform,
      channelConfigId: channel.id,
      groupId: channel.groupId,
      scopeZone: channel.scopeZone,
      senderExternalId: input.externalUserId,
      ...(emp ? { senderEmail: emp.email } : {}),
      isGuestMode,
      effectiveTier,
      inboundText: inboundDlp.sanitizedText.slice(0, 1500),
      outboundReply: outboundDlp.sanitizedText.slice(0, 2000),
      ...(input.replyToExternalId ? { replyToExternalId: input.replyToExternalId } : {}),
      blocked: false,
      createdAt: Date.now(),
    };
    this.state.syncEvents.unshift(event);
    if (this.state.syncEvents.length > 200) {
      this.state.syncEvents = this.state.syncEvents.slice(0, 200);
    }
    this.state.updatedAt = Date.now();
    this.saveToDisk();

    return {
      allowed: true,
      reason: isGuestMode ? "guest_public_lockdown" : "authorized",
      effectiveTier,
      isGuestMode,
      senderEmail: emp?.email,
      sanitizedInboundText: inboundDlp.sanitizedText,
      outboundReply: outboundDlp.sanitizedText,
      syncEvent: structuredClone(event),
    };
  }
}

let globalOmnichannelGateway: EnterpriseOmnichannelGateway | null = null;
export function getEnterpriseOmnichannelGateway(): EnterpriseOmnichannelGateway {
  if (!globalOmnichannelGateway) {
    globalOmnichannelGateway = new EnterpriseOmnichannelGateway();
  }
  return globalOmnichannelGateway;
}

export function resetEnterpriseOmnichannelGatewayForTest(): void {
  globalOmnichannelGateway = null;
}
