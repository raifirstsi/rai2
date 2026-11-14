// Types and contracts for Zalo OA and Zalo Personal integrations in RAI2.

export type ZaloOAState = "not-connected" | "connected" | "needs-auth" | "error";

export interface ZaloOAConfig {
  appId: string;
  secretKey: string;
  oaId: string;
  accessToken?: string;
  refreshToken?: string;
  webhookSecret?: string;
  configuredAt?: number;
}

export interface ZaloOAStatus {
  state: ZaloOAState;
  appId?: string;
  oaId?: string;
  webhookUrl: string;
  hasToken: boolean;
  lastConnectedAt?: number | null;
  error?: string | null;
}

export type ZaloPersonalState = "not-connected" | "connected" | "qr-ready" | "logging-in" | "error";

export interface ZaloPersonalConfig {
  phone?: string;
  sessionCookie?: string;
  secretKey?: string;
  gatewayUrl?: string;
  configuredAt?: number;
}

export interface ZaloPersonalStatus {
  state: ZaloPersonalState;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  qrCode?: string | null;
  lastConnectedAt?: number | null;
  gatewayConnected: boolean;
  error?: string | null;
}

export function isZaloOAStatus(value: unknown): value is ZaloOAStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<ZaloOAStatus>;
  return typeof status.state === "string" && typeof status.webhookUrl === "string";
}

export function isZaloPersonalStatus(value: unknown): value is ZaloPersonalStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<ZaloPersonalStatus>;
  return typeof status.state === "string";
}
