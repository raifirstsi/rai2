import { useCallback, useEffect, useState } from "react";
import { KeyRound, MessageSquare, Plus, Send, ShieldAlert, Webhook } from "lucide-react";
import { cn } from "@/lib/cn";

type Platform = "zalo" | "telegram" | "whatsapp" | "discord";
type Tier = "public" | "internal" | "zone" | "confidential";

interface ChannelCfg {
  id: string;
  platform: Platform;
  name: string;
  groupId: string;
  scopeZone: string;
  maxChannelTier: Tier;
  allowExternalGuests: boolean;
  telegramBotToken?: string;
}

interface BindingItem {
  id: string;
  employeeEmail: string;
  platform: Platform;
  externalUserId: string;
  externalDisplayName: string;
  status: "active" | "revoked";
}

interface SyncEvent {
  id: string;
  platform: Platform;
  groupId: string;
  senderEmail?: string;
  isGuestMode: boolean;
  effectiveTier: Tier;
  inboundText: string;
  outboundReply: string;
}

interface OmnichannelState {
  channels: Record<string, ChannelCfg>;
  bindings: Record<string, BindingItem>;
  syncEvents: SyncEvent[];
}

export function EnterpriseOmnichannelPanel() {
  const [subTab, setSubTab] = useState<"channels" | "binding" | "ingest">("channels");
  const [omni, setOmni] = useState<OmnichannelState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Channel form
  const [platform, setPlatform] = useState<Platform>("telegram");
  const [chName, setChName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [scopeZone, setScopeZone] = useState("Zone 3");
  const [maxTier, setMaxTier] = useState<Tier>("zone");
  const [allowGuests, setAllowGuests] = useState(false);
  const [tgToken, setTgToken] = useState("");
  const [tgWebhookSecret, setTgWebhookSecret] = useState("");

  // OTP Binding form
  const [bindEmail, setBindEmail] = useState("");
  const [bindPlatform, setBindPlatform] = useState<Platform>("telegram");
  const [issuedOtp, setIssuedOtp] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyExtId, setVerifyExtId] = useState("");

  // Ingest / Test form
  const [testPlatform, setTestPlatform] = useState<Platform>("telegram");
  const [testGroupId, setTestGroupId] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [testText, setTestText] = useState("");

  const loadOmni = useCallback(async () => {
    try {
      const resp = await fetch("/api/enterprise/omnichannel");
      const data = (await resp.json()) as { omnichannel?: OmnichannelState; error?: string };
      if (!resp.ok || !data.omnichannel) {
        setErr(data.error || "Không thể tải cấu hình Đa kênh Omnichannel.");
        return;
      }
      setOmni(data.omnichannel);
    } catch {
      setErr("Lỗi kết nối máy chủ.");
    }
  }, []);

  useEffect(() => {
    void loadOmni();
  }, [loadOmni]);

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chName.trim() || !groupId.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/omnichannel/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          name: chName,
          groupId,
          scopeZone,
          maxChannelTier: maxTier,
          allowExternalGuests: allowGuests,
          telegramBotToken: platform === "telegram" ? tgToken : undefined,
          webhookSecret: platform === "telegram" ? tgWebhookSecret : undefined,
        }),
      });
      const data = (await resp.json()) as { success?: boolean; omnichannel?: OmnichannelState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể lưu kết nối kênh.");
        return;
      }
      if (data.omnichannel) setOmni(data.omnichannel);
      setChName("");
      setGroupId("");
      setTgToken("");
      setTgWebhookSecret("");
      setMsg(`Đã kết nối nhóm ${platform.toUpperCase()} với trần dữ liệu ${maxTier}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindEmail.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/omnichannel/bind/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeEmail: bindEmail, platform: bindPlatform }),
      });
      const data = (await resp.json()) as { success?: boolean; challenge?: { code: string }; error?: string };
      if (!resp.ok || !data.success || !data.challenge) {
        setErr(data.error || "Không thể cấp mã OTP.");
        return;
      }
      setIssuedOtp(data.challenge.code);
      setVerifyCode(data.challenge.code);
      setMsg(`Mã OTP: ${data.challenge.code} (hết hạn sau 10 phút). Gõ /bind ${data.challenge.code} trong nhóm ${bindPlatform.toUpperCase()}!`);
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeBinding = async (bPlatform: Platform, externalUserId: string) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/omnichannel/bind/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: bPlatform, externalUserId }),
      });
      const data = (await resp.json()) as { success?: boolean; omnichannel?: OmnichannelState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Không thể thu hồi liên kết.");
        return;
      }
      if (data.omnichannel) setOmni(data.omnichannel);
      setMsg("Đã thu hồi liên kết định danh kênh chat.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim() || !verifyExtId.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/omnichannel/bind/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode, externalUserId: verifyExtId }),
      });
      const data = (await resp.json()) as { success?: boolean; omnichannel?: OmnichannelState; error?: string };
      if (!resp.ok || !data.success) {
        setErr(data.error || "Mã OTP không hợp lệ.");
        return;
      }
      if (data.omnichannel) setOmni(data.omnichannel);
      setVerifyExtId("");
      setMsg("Đã liên kết định danh nhân viên thành công!");
    } finally {
      setBusy(false);
    }
  };

  const handleTestIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testGroupId.trim() || !testUserId.trim() || !testText.trim()) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const resp = await fetch("/api/enterprise/omnichannel/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: testPlatform,
          channelGroupId: testGroupId,
          externalUserId: testUserId,
          messageText: testText,
        }),
      });
      const data = (await resp.json()) as {
        success?: boolean;
        result?: { reason: string; effectiveTier: Tier; outboundReply: string };
        omnichannel?: OmnichannelState;
      };
      if (data.omnichannel) setOmni(data.omnichannel);
      if (!data.success) {
        setErr(`Bị chặn bởi Chính sách Least-Privilege: ${data.result?.reason || "blocked"}`);
        return;
      }
      setMsg(`Hợp lệ (${data.result?.effectiveTier}) → ${data.result?.outboundReply}`);
    } finally {
      setBusy(false);
    }
  };

  const channels = Object.values(omni?.channels ?? {});
  const bindings = Object.values(omni?.bindings ?? {});
  const events = omni?.syncEvents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "channels", label: `1. Kênh Nhóm (${channels.length})`, icon: Webhook },
          { id: "binding", label: `2. Định danh OTP (${bindings.length})`, icon: KeyRound },
          { id: "ingest", label: `3. Đồng bộ & Kiểm thử (${events.length})`, icon: MessageSquare },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as "channels" | "binding" | "ingest")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                subTab === item.id ? "bg-accent text-white" : "bg-raised text-ink-secondary hover:text-ink",
              )}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
      </div>

      {msg && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</div>}
      {err && <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</div>}

      {subTab === "channels" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleSaveChannel(e)} className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="font-medium text-ink">Kết nối Nhóm Chat Doanh nghiệp (Zalo / Telegram / WhatsApp / Discord)</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="rounded-lg border border-hairline/40 bg-inset px-2 py-1.5 text-ink">
                <option value="telegram">Telegram</option>
                <option value="zalo">Zalo</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="discord">Discord</option>
              </select>
              <input value={chName} onChange={(e) => setChName(e.target.value)} placeholder="Tên nhóm (VD: Sales Zone 3)" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="Group ID (VD: -100...)" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={scopeZone} onChange={(e) => setScopeZone(e.target.value)} placeholder="Zone" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select value={maxTier} onChange={(e) => setMaxTier(e.target.value as Tier)} className="rounded-lg border border-hairline/40 bg-inset px-2 py-1 text-ink">
                  <option value="public">Trần kênh: Public</option>
                  <option value="internal">Trần kênh: Internal</option>
                  <option value="zone">Trần kênh: Zone</option>
                  <option value="confidential">Trần kênh: Confidential</option>
                </select>
                {platform === "telegram" && (
                  <>
                    <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="Telegram Bot Token (tùy chọn)" className="w-44 rounded-lg border border-hairline/40 bg-inset px-2 py-1 text-ink" />
                    <input value={tgWebhookSecret} onChange={(e) => setTgWebhookSecret(e.target.value)} placeholder="Webhook Secret (bảo mật)" className="w-40 rounded-lg border border-hairline/40 bg-inset px-2 py-1 text-ink" />
                  </>
                )}
                <label className="flex items-center gap-1.5 text-ink-secondary">
                  <input type="checkbox" checked={allowGuests} onChange={(e) => setAllowGuests(e.target.checked)} />
                  Cho phép khách lạ (khóa ở mức Public)
                </label>
              </div>
              <button type="submit" disabled={busy || !chName.trim() || !groupId.trim()} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
                <Plus size={13} /> Kết nối Kênh
              </button>
            </div>
            <div className="text-[11px] text-ink-tertiary">
              Telegram Webhook URL: <code>/api/webhooks/telegram-enterprise</code>
            </div>
          </form>

          <div className="space-y-2">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-xl border border-hairline/40 bg-card p-3 text-xs">
                <div>
                  <div className="font-semibold text-ink">[{ch.platform.toUpperCase()}] {ch.name} (<code>{ch.groupId}</code>)</div>
                  <div className="text-[11px] text-ink-tertiary">
                    Zone: <strong>{ch.scopeZone}</strong> · Trần: <strong>{ch.maxChannelTier}</strong> · Khách lạ: {ch.allowExternalGuests ? "Khóa Public" : "Chặn tuyệt đối"}
                  </div>
                </div>
                <ShieldAlert size={15} className={ch.allowExternalGuests ? "text-amber-500" : "text-emerald-500"} />
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "binding" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleRequestOtp(e)} className="flex flex-wrap gap-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <input value={bindEmail} onChange={(e) => setBindEmail(e.target.value)} placeholder="Email nhân viên (an@company.vn)" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <select value={bindPlatform} onChange={(e) => setBindPlatform(e.target.value as Platform)} className="rounded-lg border border-hairline/40 bg-inset px-2 py-1.5 text-ink">
              <option value="telegram">Telegram</option>
              <option value="zalo">Zalo</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="discord">Discord</option>
            </select>
            <button type="submit" disabled={busy || !bindEmail.trim()} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
              Cấp OTP 6 số
            </button>
          </form>

          {issuedOtp && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              Mã OTP: <strong className="font-mono text-sm">{issuedOtp}</strong> — Nhân viên chỉ cần gõ <code>/bind {issuedOtp}</code> trong nhóm chat, hoặc xác nhận nhanh bên dưới:
            </div>
          )}

          <form onSubmit={(e) => void handleVerifyOtp(e)} className="flex flex-wrap gap-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Mã OTP 6 số" className="w-36 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <input value={verifyExtId} onChange={(e) => setVerifyExtId(e.target.value)} placeholder="User ID ngoài (VD: tg-user-42)" className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            <button type="submit" disabled={busy || !verifyCode.trim() || !verifyExtId.trim()} className="rounded-lg bg-raised px-3 py-1.5 font-medium text-ink hover:bg-control">
              Xác thực Định danh
            </button>
          </form>

          <div className="space-y-1.5">
            {bindings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-hairline/40 bg-card px-3 py-2 text-xs">
                <span><strong>{b.employeeEmail}</strong> ↔ [{b.platform.toUpperCase()}] <code>{b.externalUserId}</code></span>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px]", b.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-danger/15 text-danger")}>{b.status}</span>
                  {b.status === "active" && (
                    <button type="button" disabled={busy} onClick={() => void handleRevokeBinding(b.platform, b.externalUserId)} className="rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-medium text-danger">
                      Thu hồi
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "ingest" && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleTestIngest(e)} className="space-y-2 rounded-xl border border-hairline/40 bg-card p-3 text-xs">
            <div className="font-medium text-ink">Kiểm thử Least-Privilege & Đồng bộ Nhóm Chat</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select value={testPlatform} onChange={(e) => setTestPlatform(e.target.value as Platform)} className="rounded-lg border border-hairline/40 bg-inset px-2 py-1.5 text-ink">
                <option value="telegram">Telegram</option>
                <option value="zalo">Zalo</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="discord">Discord</option>
              </select>
              <input value={testGroupId} onChange={(e) => setTestGroupId(e.target.value)} placeholder="Group ID" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="External User ID" className="rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
            </div>
            <div className="flex gap-2">
              <input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Nội dung tin nhắn (hỗ trợ /bind OTP, @mention, DLP)..." className="flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-ink" />
              <button type="submit" disabled={busy || !testGroupId.trim() || !testUserId.trim() || !testText.trim()} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
                <Send size={12} /> Gửi thử
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-hairline/40 bg-inset p-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-ink-tertiary">
                  <span>[{ev.platform.toUpperCase()} · {ev.groupId}] {ev.senderEmail || "Khách lạ"}</span>
                  <span>Scope: <strong>{ev.effectiveTier}</strong></span>
                </div>
                <div className="mt-1 text-ink">← {ev.inboundText}</div>
                <div className="mt-0.5 text-ink-secondary">→ {ev.outboundReply}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
