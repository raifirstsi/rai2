import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, MoreHorizontal } from "lucide-react";

import { api } from "@/state/store";
import { t } from "@/lib/i18n";
import { openExternalLink } from "@/lib/app-links";
import type { ZaloOAStatus } from "../../shared/zalo";
import { SidebarPopoverMenu } from "./SidebarPopoverMenu";

const pill = "inline-flex h-7 min-w-[64px] shrink-0 items-center justify-center gap-2 rounded-full bg-control/80 px-3 text-[13px] font-medium leading-5 text-ink transition-colors hover:bg-raised-hover disabled:opacity-40";
const field = "h-8 w-full min-w-0 rounded-lg bg-inset px-2.5 text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent/50";

export function ZaloOAIcon() {
  return (
    <div className="relative grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#0068ff] text-white shadow-sm" aria-hidden="true">
      <span className="text-[17px] font-black tracking-tight">Z</span>
      <span className="absolute -bottom-1 -right-1 rounded bg-[#004bbd] px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-white shadow">
        OA
      </span>
    </div>
  );
}

export function ZaloOACard({ refreshKey = 0, onConnection }: {
  refreshKey?: number;
  onConnection?: (connected: boolean | null) => void;
}) {
  const [status, setStatus] = useState<ZaloOAStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "disconnect" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appId, setAppId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [oaId, setOaId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const mounted = useRef(true);

  const load = useCallback(async (): Promise<ZaloOAStatus | null> => {
    try {
      const response = (await api("/api/zalo/oa")) as ZaloOAStatus;
      if (!mounted.current) return null;
      setStatus(response);
      setLoadFailed(false);
      if (response.appId) setAppId(response.appId);
      if (response.oaId) setOaId(response.oaId);
      return response;
    } catch {
      if (!mounted.current) return null;
      setLoadFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load, refreshKey]);

  const connected = status?.state === "connected";

  useEffect(() => {
    onConnection?.(status ? connected : null);
  }, [status, connected, onConnection]);

  const saveConfig = async () => {
    if (busy || !appId.trim() || !secretKey.trim() || !oaId.trim()) return;
    setBusy("save");
    setError(null);
    try {
      await api("/api/zalo/oa", {
        method: "POST",
        body: JSON.stringify({
          appId: appId.trim(),
          secretKey: secretKey.trim(),
          oaId: oaId.trim(),
          accessToken: accessToken.trim() || undefined,
        }),
      });
      setIsEditing(false);
      await load();
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Không thể lưu cấu hình Zalo OA");
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const disconnect = async () => {
    if (busy || !window.confirm("Ngắt kết nối Zalo OA? Các bot sẽ không còn nhận hoặc gửi được tin nhắn qua OA này.")) return;
    setBusy("disconnect");
    setError(null);
    try {
      await api("/api/zalo/oa", { method: "DELETE" });
      setAppId("");
      setSecretKey("");
      setOaId("");
      setAccessToken("");
      setIsEditing(false);
      await load();
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Không thể ngắt kết nối Zalo OA");
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const copyWebhook = () => {
    const url = status?.webhookUrl ?? `${window.location.origin}/api/webhooks/zalo-oa`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const webhookUrl = status?.webhookUrl ?? `${window.location.origin}/api/webhooks/zalo-oa`;

  const description = connected
    ? `Đã kết nối OA ID: ${status?.oaId ?? ""}`
    : "Gửi tin nhắn CSKH, thông báo ZNS và tương tác với khách hàng qua Zalo OA chính thức.";

  return (
    <div data-app-tile="zalo-oa" className="flex min-w-0 flex-col rounded-xl px-2 py-2 transition-colors hover:bg-raised/40">
      <div className="flex items-center gap-3">
        <ZaloOAIcon />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold leading-5 text-ink">Zalo OA (Official Account)</span>
            {connected && <Check size={13} strokeWidth={2.5} className="shrink-0 text-success" aria-label={t("apps.connected")} />}
          </div>
          <p className="truncate text-[13px] leading-[18px] text-ink-secondary" title={description}>{description}</p>
        </div>

        {status === null ? (
          loadFailed ? (
            <button type="button" onClick={() => void load()} className={pill}>{t("connectors.action.retry")}</button>
          ) : (
            <button type="button" disabled className={pill}><Loader2 size={14} className="animate-spin" /></button>
          )
        ) : connected ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setIsEditing(!isEditing)} className={pill}>
              {isEditing ? "Đóng" : "Cấu hình"}
            </button>
            <SidebarPopoverMenu
              placement="below"
              ariaLabel="Tùy chọn Zalo OA"
              triggerClassName="shrink-0"
              items={[{ key: "disconnect", label: "Ngắt kết nối", disabled: busy !== null, onSelect: () => void disconnect() }]}
              renderTrigger={() => (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-control/80 text-ink hover:bg-raised-hover">
                  {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={15} />}
                </span>
              )}
            />
          </div>
        ) : (
          <button type="button" onClick={() => { setIsEditing(!isEditing); setError(null); }} className={pill}>
            {isEditing ? "Hủy" : t("connectors.action.connect")}
          </button>
        )}
      </div>

      <div className="ps-[52px]">
        {isEditing && (
          <form className="mt-3 flex flex-col gap-2 rounded-lg bg-raised/60 p-3" onSubmit={(e) => { e.preventDefault(); void saveConfig(); }}>
            <div className="text-[12px] font-semibold text-ink">Cấu hình kết nối Zalo Official Account</div>
            
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-secondary">App ID (*)</label>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Ví dụ: 4567890123456789"
                  value={appId}
                  disabled={busy !== null}
                  onChange={(e) => setAppId(e.target.value)}
                  className={field}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Secret Key (*)</label>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Khóa bí mật ứng dụng"
                  value={secretKey}
                  disabled={busy !== null}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className={field}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-secondary">OA ID (*)</label>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Mã số Official Account"
                value={oaId}
                disabled={busy !== null}
                onChange={(e) => setOaId(e.target.value)}
                className={field}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Access Token / Refresh Token (Tùy chọn)</label>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Dán token nếu có sẵn"
                value={accessToken}
                disabled={busy !== null}
                onChange={(e) => setAccessToken(e.target.value)}
                className={field}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Webhook Callback URL (Dán vào Zalo App)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="h-8 w-full min-w-0 rounded-lg bg-inset/50 px-2.5 text-[12px] text-ink-secondary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-control px-2.5 text-[12px] font-medium text-ink hover:bg-raised-hover"
                >
                  <Copy size={13} />
                  {copied ? "Đã chép" : "Chép"}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="mt-1 text-[12px] text-danger">{error}</p>}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-hairline/40 pt-2">
              <button
                type="button"
                onClick={() => void openExternalLink("https://developers.zalo.me/")}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-text hover:underline"
              >
                Mở Zalo for Developers
                <ExternalLink size={11} />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[12px] text-ink-secondary hover:text-ink"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={busy !== null || !appId.trim() || !secretKey.trim() || !oaId.trim()}
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[12px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-40"
                >
                  {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : "Lưu & Kích hoạt"}
                </button>
              </div>
            </div>
          </form>
        )}

        <details className="mt-1 text-[12px] text-ink-secondary">
          <summary className="cursor-pointer font-medium hover:text-ink">Hướng dẫn cấu hình & Quyền hạn</summary>
          <div className="mt-2 space-y-1.5 leading-relaxed">
            <p>1. Truy cập <span className="font-medium text-ink">developers.zalo.me</span> và tạo ứng dụng liên kết với OA.</p>
            <p>2. Bật quyền <span className="font-medium text-ink">Quản lý tin nhắn (oa.message)</span> và dán Webhook URL ở trên vào mục Webhook.</p>
            <p>3. Khi khách hàng nhắn tin vào OA, hệ thống RAI2 sẽ tự động điều phối cho AI Bot phản hồi.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
