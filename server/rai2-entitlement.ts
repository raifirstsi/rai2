import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ServerResponse } from "node:http";

export type Rai2PlanId = "starter" | "vip" | "trial" | "none" | "local";
export type Rai2EntitlementStatus = "trial" | "paid" | "inactive" | "local";

export interface Rai2PlanEntitlement {
  managed: boolean;
  planId: Rai2PlanId;
  planName: string;
  entitlement: Rai2EntitlementStatus;
  enterpriseAccess: boolean;
  paidThrough: number;
  trialThrough: number;
  checkedAt: number;
  upgradeUrl?: string;
}

const ENTERPRISE_DEPARTMENT_NAMES = new Set([
  "Văn Phòng Điều Hành & Chiến Lược Của Chủ",
  "Phòng Marketing & Thu Hút Khách Hàng",
  "Phòng Kinh Doanh & Chốt Hợp Đồng",
  "Phòng Thực Thi & Giám Sát Vận Hành",
  "Phòng Chăm Sóc Khách Hàng & Giữ Chân",
  "Phòng Tài Chính & Bảo Vệ Dòng Tiền",
  "Phòng Nhân Sự, Đào Tạo & Văn Hóa",
]);

const ENTERPRISE_DEPARTMENT_CODES = new Set([
  "ZONE_1_EXECUTIVE",
  "ZONE_2_MARKETING",
  "ZONE_3_SALES",
  "ZONE_4_OPERATIONS",
  "ZONE_5_RETENTION",
  "ZONE_6_FINANCE",
  "ZONE_7_HR",
]);

const ENTERPRISE_AGENT_KEYS = new Set([
  "rai-strategy",
  "rai-lead",
  "rai-copy",
  "rai-quote",
  "rai-close",
  "rai-task",
  "rai-qc",
  "rai-care",
  "rai-rescue",
  "rai-cash",
  "rai-margin",
  "rai-talent",
  "rai-coach",
]);

export function isEnterpriseBotRequest(input: {
  id?: string | null;
  role?: string | null;
  zone?: number | null;
  section?: string | null;
}): boolean {
  if (typeof input.zone === "number" && input.zone >= 1 && input.zone <= 7) return true;
  if (typeof input.id === "string" && ENTERPRISE_AGENT_KEYS.has(input.id.trim().toLowerCase())) return true;
  if (typeof input.role === "string" && ENTERPRISE_AGENT_KEYS.has(input.role.trim().toLowerCase())) return true;
  if (typeof input.section === "string") {
    const trimmed = input.section.trim();
    if (ENTERPRISE_DEPARTMENT_NAMES.has(trimmed) || ENTERPRISE_DEPARTMENT_CODES.has(trimmed)) return true;
  }
  return false;
}

const CACHE_TTL_MS = 60_000;

interface EntitlementRuntime {
  dataDir?: string;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  onChanged?: (next: Rai2PlanEntitlement) => void;
  cached: Rai2PlanEntitlement | null;
  inFlight: Promise<Rai2PlanEntitlement> | null;
}

const runtime: EntitlementRuntime = {
  env: process.env,
  cached: null,
  inFlight: null,
};

function cacheFilePath(): string | null {
  return runtime.dataDir ? join(runtime.dataDir, "rai2-entitlement.json") : null;
}

function defaultUpgradeUrl(env: NodeJS.ProcessEnv): string | undefined {
  try {
    const base = new URL(env.OMB_SIGNIN_TENANT_URL ?? "");
    return `${base.origin}/?plan=vip&checkout=1`;
  } catch {
    return undefined;
  }
}

function readDiskCache(): Rai2PlanEntitlement | null {
  const path = cacheFilePath();
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Rai2PlanEntitlement>;
    if (typeof parsed.enterpriseAccess === "boolean" && typeof parsed.planId === "string") {
      return {
        managed: true,
        planId: parsed.planId as Rai2PlanId,
        planName: typeof parsed.planName === "string" ? parsed.planName : "RAI² Starter (Cá Nhân)",
        entitlement: (parsed.entitlement as Rai2EntitlementStatus) ?? "inactive",
        enterpriseAccess: parsed.enterpriseAccess,
        paidThrough: typeof parsed.paidThrough === "number" ? parsed.paidThrough : 0,
        trialThrough: typeof parsed.trialThrough === "number" ? parsed.trialThrough : 0,
        checkedAt: typeof parsed.checkedAt === "number" ? parsed.checkedAt : 0,
        ...(parsed.upgradeUrl ? { upgradeUrl: parsed.upgradeUrl } : {}),
      };
    }
  } catch {
    // Ignore corrupted cache
  }
  return null;
}

function writeDiskCache(next: Rai2PlanEntitlement): void {
  const path = cacheFilePath();
  if (!path) return;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${path}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    renameSync(tmp, path);
  } catch {
    // Non-fatal
  }
}

export function configureRai2Entitlement(options: {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  onChanged?: (next: Rai2PlanEntitlement) => void;
}): void {
  runtime.dataDir = options.dataDir;
  runtime.env = options.env ?? process.env;
  runtime.fetchImpl = options.fetchImpl;
  runtime.onChanged = options.onChanged;
  runtime.cached = readDiskCache();
  runtime.inFlight = null;
}

function forceTestPlan(env: NodeJS.ProcessEnv): Rai2PlanEntitlement | null {
  const forced = env.OMB_RAI2_FORCE_PLAN?.trim().toLowerCase();
  if (!forced) return null;
  const now = Date.now();
  if (forced === "starter" || forced === "none") {
    return {
      managed: true,
      planId: forced,
      planName: forced === "starter" ? "RAI² Starter (Cá Nhân)" : "Chưa kích hoạt",
      entitlement: forced === "starter" ? "paid" : "inactive",
      enterpriseAccess: false,
      paidThrough: forced === "starter" ? now + 30 * 86_400_000 : 0,
      trialThrough: 0,
      checkedAt: now,
      upgradeUrl: defaultUpgradeUrl(env) ?? "https://app.rai2.si/?plan=vip&checkout=1",
    };
  }
  if (forced === "trial") {
    return {
      managed: true,
      planId: "trial",
      planName: "Dùng Thử 14 Ngày (Full 2 Chế Độ)",
      entitlement: "trial",
      enterpriseAccess: true,
      paidThrough: 0,
      trialThrough: now + 14 * 86_400_000,
      checkedAt: now,
      upgradeUrl: defaultUpgradeUrl(env) ?? "https://app.rai2.si/?plan=vip&checkout=1",
    };
  }
  if (forced === "vip") {
    return {
      managed: true,
      planId: "vip",
      planName: "RAI² Enterprise VIP",
      entitlement: "paid",
      enterpriseAccess: true,
      paidThrough: now + 30 * 86_400_000,
      trialThrough: 0,
      checkedAt: now,
    };
  }
  return null;
}

export function getRai2EntitlementSnapshot(env: NodeJS.ProcessEnv = runtime.env): Rai2PlanEntitlement {
  const forced = forceTestPlan(env);
  if (forced) return forced;

  if (env.OMB_RAI2_TENANT !== "1") {
    return {
      managed: false,
      planId: "local",
      planName: "RAI² Local Workspace",
      entitlement: "local",
      enterpriseAccess: true,
      paidThrough: 0,
      trialThrough: 0,
      checkedAt: Date.now(),
    };
  }

  if (!runtime.cached) {
    runtime.cached = readDiskCache();
  }
  if (runtime.cached) {
    return {
      ...runtime.cached,
      ...(runtime.cached.upgradeUrl ? {} : { upgradeUrl: defaultUpgradeUrl(env) }),
    };
  }

  // Fail closed for managed SaaS tenants until SaaS control plane confirms trial or VIP.
  return {
    managed: true,
    planId: "starter",
    planName: "RAI² Starter (Cá Nhân)",
    entitlement: "inactive",
    enterpriseAccess: false,
    paidThrough: 0,
    trialThrough: 0,
    checkedAt: 0,
    upgradeUrl: defaultUpgradeUrl(env),
  };
}

function updateCached(next: Rai2PlanEntitlement): Rai2PlanEntitlement {
  const prev = runtime.cached;
  runtime.cached = next;
  writeDiskCache(next);
  if (
    runtime.onChanged &&
    (!prev ||
      prev.planId !== next.planId ||
      prev.entitlement !== next.entitlement ||
      prev.enterpriseAccess !== next.enterpriseAccess)
  ) {
    try {
      runtime.onChanged(next);
    } catch {
      // Non-fatal
    }
  }
  return next;
}

export function applyHandoffEntitlement(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const p = payload as Record<string, unknown>;
  if (typeof p.enterpriseAccess !== "boolean" || typeof p.planId !== "string") return;
  const next: Rai2PlanEntitlement = {
    managed: true,
    planId: p.planId as Rai2PlanId,
    planName: typeof p.planName === "string" ? p.planName : "RAI² Starter (Cá Nhân)",
    entitlement: (p.entitlement as Rai2EntitlementStatus) ?? "inactive",
    enterpriseAccess: p.enterpriseAccess,
    paidThrough: typeof p.paidThrough === "number" ? p.paidThrough : 0,
    trialThrough: typeof p.trialThrough === "number" ? p.trialThrough : 0,
    checkedAt: Date.now(),
    upgradeUrl: defaultUpgradeUrl(runtime.env),
  };
  updateCached(next);
}

export async function refreshRai2Entitlement(force = false): Promise<Rai2PlanEntitlement> {
  const forced = forceTestPlan(runtime.env);
  if (forced) return forced;
  if (runtime.env.OMB_RAI2_TENANT !== "1") return getRai2EntitlementSnapshot(runtime.env);

  const now = Date.now();
  if (!force && runtime.cached && now - runtime.cached.checkedAt < CACHE_TTL_MS) {
    return runtime.cached;
  }
  if (runtime.inFlight) return runtime.inFlight;

  const portalOrigin = runtime.env.OMB_SIGNIN_TENANT_URL ?? "";
  const slug = runtime.env.OMB_SIGNIN_TENANT_SLUG ?? "";
  const token = runtime.env.OMB_SIGNIN_TENANT_TOKEN ?? "";
  if (!portalOrigin || !slug || !token) {
    return getRai2EntitlementSnapshot(runtime.env);
  }

  runtime.inFlight = (async () => {
    try {
      const target = new URL("/api/tenant-auth/entitlement", portalOrigin);
      const response = await (runtime.fetchImpl ?? fetch)(target, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        return getRai2EntitlementSnapshot(runtime.env);
      }
      const data = (await response.json()) as Record<string, unknown>;
      if (typeof data.enterpriseAccess !== "boolean" || typeof data.planId !== "string") {
        return getRai2EntitlementSnapshot(runtime.env);
      }
      return updateCached({
        managed: true,
        planId: data.planId as Rai2PlanId,
        planName: typeof data.planName === "string" ? data.planName : "RAI² Starter (Cá Nhân)",
        entitlement: (data.entitlement as Rai2EntitlementStatus) ?? "inactive",
        enterpriseAccess: data.enterpriseAccess,
        paidThrough: typeof data.paidThrough === "number" ? data.paidThrough : 0,
        trialThrough: typeof data.trialThrough === "number" ? data.trialThrough : 0,
        checkedAt: Date.now(),
        upgradeUrl: defaultUpgradeUrl(runtime.env),
      });
    } catch {
      return getRai2EntitlementSnapshot(runtime.env);
    } finally {
      runtime.inFlight = null;
    }
  })();

  return runtime.inFlight;
}

export function isEnterpriseVipAllowed(): boolean {
  const snap = getRai2EntitlementSnapshot(runtime.env);
  if (snap.managed && Date.now() - snap.checkedAt >= CACHE_TTL_MS && !runtime.inFlight) {
    void refreshRai2Entitlement(false).catch(() => {});
  }
  return snap.enterpriseAccess === true;
}

export function requireEnterpriseVip(
  res: ServerResponse,
  jsonFn: (res: ServerResponse, status: number, body: unknown) => void,
): boolean {
  if (isEnterpriseVipAllowed()) return false;
  const snap = getRai2EntitlementSnapshot(runtime.env);
  jsonFn(res, 403, {
    error: "Chế độ Enterprise OS chỉ dành cho gói Enterprise VIP (hoặc tài khoản đang trong 14 ngày dùng thử).",
    code: "ENTERPRISE_VIP_REQUIRED",
    planId: snap.planId,
    upgradeUrl: snap.upgradeUrl ?? "https://app.rai2.si/?plan=vip&checkout=1",
  });
  return true;
}

