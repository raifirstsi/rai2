import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnterpriseGovernanceStoreForTest, getEnterpriseGovernanceStore } from "./enterprise-governance.ts";
import { EnterpriseOmnichannelGateway, resetEnterpriseOmnichannelGatewayForTest } from "./enterprise-omnichannel.ts";

describe("Enterprise Phase 4: Omnichannel (Zalo, Telegram, WhatsApp, Discord), OTP Binding & Least-Privilege Intersection", () => {
  const dirs: string[] = [];
  afterEach(() => {
    resetEnterpriseOmnichannelGatewayForTest();
    resetEnterpriseGovernanceStoreForTest();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("binds Telegram/Zalo identity via OTP, computes EffectiveScope intersection, and blocks offboarded users", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-omni-"));
    dirs.push(dir);
    process.env.RAI2_DATA_DIR = dir;
    resetEnterpriseGovernanceStoreForTest();

    const gov = getEnterpriseGovernanceStore();
    gov.upsertEmployee({ email: "an@co.vn", name: "An", role: "manager", zone: "Zone 3", maxDataTier: "zone" }, "admin");

    const gw = new EnterpriseOmnichannelGateway(dir);
    gw.upsertChannel({
      platform: "telegram",
      name: "Nhóm Sales Zone 3",
      groupId: "-100999888",
      scopeZone: "Zone 3",
      maxChannelTier: "internal",
      allowExternalGuests: false,
      telegramBotToken: "123456:ABCDEF_SECRET_TOKEN",
    });

    // Secret token must be masked when read back
    const masked = gw.getStateMasked();
    expect(Object.values(masked.channels)[0]?.telegramBotToken).toBe("***OKEN");

    // Issue OTP and bind via `/bind <OTP>` right inside Telegram
    const otp = gw.issueBindingOtp("an@co.vn", "telegram", "an@co.vn");
    const bindRes = gw.processInboundMessage({
      platform: "telegram",
      channelGroupId: "-100999888",
      externalUserId: "tg-user-42",
      externalDisplayName: "An Nguyen",
      messageText: `/bind ${otp.code}`,
    });
    expect(bindRes.allowed).toBe(true);
    expect(bindRes.reason).toBe("identity_bound");

    // EffectiveScope = min(User="zone", Bot="confidential", Channel="internal") => "internal"
    const msgRes = gw.processInboundMessage({
      platform: "telegram",
      channelGroupId: "-100999888",
      externalUserId: "tg-user-42",
      messageText: "Kiểm tra đơn sk-1234567890abcdef123456",
      botMaxTier: "confidential",
      replyToExternalId: "msg-77",
    });
    expect(msgRes.allowed).toBe(true);
    expect(msgRes.effectiveTier).toBe("internal");
    expect(msgRes.sanitizedInboundText).toContain("[REDACTED_API_KEY]");
    expect(msgRes.syncEvent?.replyToExternalId).toBe("msg-77");

    // Unverified guest must be blocked when allowExternalGuests=false
    const guestBlocked = gw.processInboundMessage({
      platform: "telegram",
      channelGroupId: "-100999888",
      externalUserId: "stranger-99",
      messageText: "Cho xin bảng giá nội bộ",
    });
    expect(guestBlocked.allowed).toBe(false);
    expect(guestBlocked.reason).toBe("unverified_guest_blocked");

    // Offboarding revokes binding immediately
    const revokedCount = gw.revokeBindingsForEmployee("an@co.vn", "admin");
    expect(revokedCount).toBe(1);
    const afterRevoke = gw.processInboundMessage({
      platform: "telegram",
      channelGroupId: "-100999888",
      externalUserId: "tg-user-42",
      messageText: "Tôi thử nhắn lại",
    });
    expect(afterRevoke.allowed).toBe(false);
    expect(afterRevoke.reason).toBe("binding_revoked");
  });

  it("locks external guests down to public tier when allowExternalGuests=true (Confused Deputy protection)", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-omni-guest-"));
    dirs.push(dir);
    process.env.RAI2_DATA_DIR = dir;
    resetEnterpriseGovernanceStoreForTest();

    const gw = new EnterpriseOmnichannelGateway(dir);
    gw.upsertChannel({
      platform: "zalo",
      name: "Zalo CSKH Công khai",
      groupId: "zalo-grp-1",
      scopeZone: "Zone 3",
      maxChannelTier: "zone",
      allowExternalGuests: true,
    });

    const guestRes = gw.processInboundMessage({
      platform: "zalo",
      channelGroupId: "zalo-grp-1",
      externalUserId: "zalo-guest-1",
      externalDisplayName: "Khách hàng Zalo",
      messageText: "Tư vấn sản phẩm giúp mình",
    });
    expect(guestRes.allowed).toBe(true);
    expect(guestRes.isGuestMode).toBe(true);
    expect(guestRes.effectiveTier).toBe("public");
  });
  it("verifies Telegram webhook secret via timingSafeEqual, deduplicates update_id, and locks OTP after 5 failed guesses", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-omni-sec-"));
    dirs.push(dir);
    process.env.RAI2_DATA_DIR = dir;
    resetEnterpriseGovernanceStoreForTest();

    const gw = new EnterpriseOmnichannelGateway(dir);
    gw.upsertChannel({
      platform: "telegram",
      name: "TG Secure",
      groupId: "-100111",
      webhookSecret: "top-secret-hmac",
      telegramBotToken: "999:tok",
    });

    expect(gw.verifyTelegramWebhookSecret("-100111", "wrong-secret").ok).toBe(false);
    expect(gw.verifyTelegramWebhookSecret("-100111", "top-secret-hmac").ok).toBe(true);
    expect(gw.claimWebhookUpdateOnce("tg:-100111:1001")).toBe(true);
    expect(gw.claimWebhookUpdateOnce("tg:-100111:1001")).toBe(false);

    const otp = gw.issueBindingOtp("sec@co.vn", "telegram", "admin");
    for (let i = 0; i < 5; i++) {
      expect(gw.verifyBindingOtp("000000", "u1")).toBeNull();
    }
    // Real OTP must be invalidated after 5 failed attempts
    expect(gw.verifyBindingOtp(otp.code, "u1")).toBeNull();
  });
});
