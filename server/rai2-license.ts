import { createPublicKey, createPrivateKey, sign, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const RAI2_CUSTOM_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAfvxmL7uE7FzgK5DuQXUl0RQPge3PY5JmPKe+Cjedkdg=
-----END PUBLIC KEY-----`;

export interface Rai2CustomLicensePayload {
  v: 1;
  licenseId: string;
  customerName: string;
  plan: "custom";
  issuedAt: number;
  expiresAt: number;
  maxBots?: number;
  allowedDomain?: string;
}

export interface Rai2LicenseVerificationResult {
  valid: boolean;
  reason?: string;
  payload?: Rai2CustomLicensePayload;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function signRai2CustomLicense(
  payload: Rai2CustomLicensePayload,
  privateKeyPem: string,
): string {
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const key = createPrivateKey(privateKeyPem);
  const sig = sign(null, Buffer.from(`RAI2C1.${payloadB64}`, "utf8"), key);
  return `RAI2C1.${payloadB64}.${toBase64Url(sig)}`;
}

export function verifyRai2CustomLicense(
  token: string | undefined | null,
  options?: { publicKeyPem?: string; now?: number; domain?: string },
): Rai2LicenseVerificationResult {
  if (typeof token !== "string" || !token.trim()) {
    return { valid: false, reason: "Thiếu RAI2_LICENSE_KEY" };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "RAI2C1") {
    return { valid: false, reason: "Định dạng License Key không hợp lệ" };
  }
  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    return { valid: false, reason: "License Key bị thiếu dữ liệu" };
  }

  let sigOk = false;
  try {
    const pubKey = createPublicKey(options?.publicKeyPem ?? RAI2_CUSTOM_PUBLIC_KEY_PEM);
    const sigBuf = fromBase64Url(sigB64);
    sigOk = verify(null, Buffer.from(`RAI2C1.${payloadB64}`, "utf8"), pubKey, sigBuf);
  } catch {
    return { valid: false, reason: "Chữ ký Ed25519 không hợp lệ" };
  }
  if (!sigOk) {
    return { valid: false, reason: "Chữ ký License Key không khớp (nghi vấn giả mạo)" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(payloadB64).toString("utf8"));
  } catch {
    return { valid: false, reason: "Payload License không đọc được" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, reason: "Payload License sai định dạng" };
  }
  const p = parsed as Partial<Rai2CustomLicensePayload>;
  if (
    p.v !== 1 ||
    p.plan !== "custom" ||
    typeof p.licenseId !== "string" || !p.licenseId.trim() ||
    typeof p.customerName !== "string" || !p.customerName.trim() ||
    typeof p.issuedAt !== "number" || !Number.isFinite(p.issuedAt) ||
    typeof p.expiresAt !== "number" || !Number.isFinite(p.expiresAt)
  ) {
    return { valid: false, reason: "Trường dữ liệu License không hợp lệ" };
  }

  const now = options?.now ?? Date.now();
  if (p.issuedAt > now + 300_000) {
    return { valid: false, reason: "License có thời gian phát hành ở tương lai" };
  }
  if (p.expiresAt <= now) {
    return { valid: false, reason: "License Custom đã hết hạn bảo trì", payload: p as Rai2CustomLicensePayload };
  }
  if (typeof p.allowedDomain === "string" && p.allowedDomain.trim()) {
    const expected = p.allowedDomain.trim().toLowerCase();
    const actual = (options?.domain ?? "").trim().toLowerCase();
    if (!actual || (actual !== expected && !actual.endsWith(`.${expected}`))) {
      return {
        valid: false,
        reason: `License chỉ cấp cho domain ${expected}`,
        payload: p as Rai2CustomLicensePayload,
      };
    }
  }

  return { valid: true, payload: p as Rai2CustomLicensePayload };
}

export function resolveCustomLicenseTokenFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const direct = env.RAI2_LICENSE_KEY?.trim();
  if (direct) return direct;
  const filePath = env.RAI2_LICENSE_FILE?.trim();
  if (filePath && existsSync(filePath)) {
    try {
      return readFileSync(filePath, "utf8").trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
