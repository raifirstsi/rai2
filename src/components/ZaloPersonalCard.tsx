import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MoreHorizontal, QrCode, KeyRound, TriangleAlert, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { api } from "@/state/store";
import { t } from "@/lib/i18n";
import type { ZaloPersonalStatus } from "../../shared/zalo";
import { SidebarPopoverMenu } from "./SidebarPopoverMenu";

const pill = "inline-flex h-7 min-w-[64px] shrink-0 items-center justify-center gap-2 rounded-full bg-control/80 px-3 text-[13px] font-medium leading-5 text-ink transition-colors hover:bg-raised-hover disabled:opacity-40";
const field = "h-8 w-full min-w-0 rounded-lg bg-inset px-2.5 text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent/50";

export function ZaloPersonalIcon() {
  return (
    <div className="relative grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#0068ff] text-white shadow-sm" aria-hidden="true">
      <span className="text-[17px] font-black tracking-tight">Z</span>
      <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-[#ff9800] text-white shadow">
        <User size={10} strokeWidth={2.5} />
      </span>
    </div>
  );
}

export function ZaloPersonalCard({ refreshKey = 0, onConnection }: {
  refreshKey?: number;
  onConnection?: (connected: boolean | null) => void;
}) {
  const [status, setStatus] = useState<ZaloPersonalStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState<"qr" | "session">("qr");
  const [busy, setBusy] = useState<"qr" | "save" | "disconnect" | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [sessionCookie, setSessionCookie] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:18789");

  const mounted = useRef(true);

  const load = useCallback(async (): Promise<ZaloPersonalStatus | null> => {
    try {
      const response = (await api("/api/zalo/personal")) as ZaloPersonalStatus;
      if (!mounted.current) return null;
      setStatus(response);
      setLoadFailed(false);
      if (response.phone) setPhone(response.phone);
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

  const requestQr = async () => {
    setBusy("qr");
    setError(null);
    try {
      const res = (await api("/api/zalo/personal/qr", { method: "POST" })) as { ok: boolean; qrCode: string };
      if (mounted.current && res.qrCode) {
        setQrCodeData(res.qrCode);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Không thể khởi tạo mã QR đăng nhập");
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const saveSession = async () => {
    if (busy) return;
    setBusy("save");
    setError(null);
    try {
      await api("/api/zalo/personal", {
        method: "POST",
        body: JSON.stringify({
          phone: phone.trim() || undefined,
          sessionCookie: sessionCookie.trim() || undefined,
          gatewayUrl: gatewayUrl.trim() || undefined,
        }),
      });
      setIsEditing(false);
      await load();
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Không thể lưu thông tin kết nối");
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const disconnect = async () => {
    if (busy || !window.confirm("Ngắt kết nối Zalo Cá nhân? Bot sẽ ngừng nhận và gửi tin nhắn qua tài khoản này.")) return;
    setBusy("disconnect");
    setError(null);
    try {
      await api("/api/zalo/personal", { method: "DELETE" });
      setPhone("");
      setSessionCookie("");
      setQrCodeData(null);
      setIsEditing(false);
      await load();
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Không thể ngắt kết nối");
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const description = connected
    ? `Đã kết nối tài khoản: ${status?.displayName || status?.phone || "Zalo User"}`
    : "Kết nối tài khoản Zalo cá nhân để tự động hóa trả lời tin nhắn và quản lý nhóm.";

  return (
    <div data-app-tile="zalo-personal" className="flex min-w-0 flex-col rounded-xl px-2 py-2 transition-colors hover:bg-raised/40">
      <div className="flex items-center gap-3">
        <ZaloPersonalIcon />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold leading-5 text-ink">Zalo Cá nhân (Personal)</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              Thử nghiệm
            </span>
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
              ariaLabel="Tùy chọn Zalo Cá nhân"
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
          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-raised/60 p-3">
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <TriangleAlert size={15} className="shrink-0 text-amber-500" />
              <div>
                <strong className="font-semibold">Cảnh báo rủi ro bảo mật:</strong> Zalo cá nhân không có API chính thức. Việc tự động hóa có thể dẫn tới bị khóa tài khoản Zalo tạm thời hoặc vĩnh viễn. Khuyến nghị chỉ sử dụng số điện thoại/SIM phụ để thử nghiệm.
              </div>
            </div>

            <div className="flex border-b border-hairline/40">
              <button
                type="button"
                onClick={() => setMode("qr")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  mode === "qr" ? "border-accent text-accent-text" : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                <QrCode size={13} />
                Quét mã QR
              </button>
              <button
                type="button"
                onClick={() => setMode("session")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  mode === "session" ? "border-accent text-accent-text" : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                <KeyRound size={13} />
                Session / Token
              </button>
            </div>

            {mode === "qr" ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                {qrCodeData ? (
                  <>
                    <div className="rounded-lg bg-white p-3 shadow-md">
                      <QRCodeSVG value={qrCodeData} size={150} level="M" />
                    </div>
                    <div className="text-[12px] text-ink-secondary">
                      Mở ứng dụng <strong className="text-ink">Zalo trên điện thoại</strong> → Bấm icon <strong>Quét mã QR</strong> để đăng nhập.
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <p className="text-[12px] text-ink-secondary">Tạo mã QR để đăng nhập trực tiếp tài khoản Zalo cá nhân</p>
                    <button
                      type="button"
                      disabled={busy === "qr"}
                      onClick={() => void requestQr()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                    >
                      {busy === "qr" ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={14} />}
                      Tạo mã QR đăng nhập
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void saveSession(); }}>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Số điện thoại Zalo (Tài khoản test)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0976087820"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={field}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Session Cookie / Secret Token</label>
                  <textarea
                    rows={3}
                    placeholder="Dán chuỗi session token/cookie đã trích xuất"
                    value={sessionCookie}
                    onChange={(e) => setSessionCookie(e.target.value)}
                    className="w-full rounded-lg bg-inset px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-secondary">Gateway Hub URL (GoClaw Adapter)</label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:18789"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    className={field}
                  />
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-[12px] text-ink-secondary hover:text-ink"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : "Lưu kết nối"}
                  </button>
                </div>
              </form>
            )}

            {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
