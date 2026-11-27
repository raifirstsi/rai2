import { ownerOrAdmin } from "../request-auth.ts";
import { getRai2EntitlementSnapshot, refreshRai2Entitlement } from "../rai2-entitlement.ts";
import { PASS, type RouteHandler } from "./table.ts";

export interface Rai2BillingDeps {
  env?: NodeJS.ProcessEnv;
  onEntitlementChanged?: () => void;
}

export const createRai2BillingRoute = (envOrDeps: NodeJS.ProcessEnv | Rai2BillingDeps = process.env): RouteHandler => {
  const deps: Rai2BillingDeps =
    "env" in envOrDeps || "onEntitlementChanged" in envOrDeps
      ? (envOrDeps as Rai2BillingDeps)
      : { env: envOrDeps as NodeJS.ProcessEnv };
  const env = deps.env ?? process.env;

  return async ({ res, path, method, auth, json }) => {
    if (path === "/api/rai2/entitlement" && method === "GET") {
      if (!ownerOrAdmin(auth)) return json(res, 403, { error: "admin scope required" });
      return json(res, 200, { ok: true, plan: getRai2EntitlementSnapshot(env) });
    }
    if (path === "/api/rai2/entitlement/refresh" && method === "POST") {
      if (!ownerOrAdmin(auth)) return json(res, 403, { error: "admin scope required" });
      const plan = await refreshRai2Entitlement(true);
      deps.onEntitlementChanged?.();
      return json(res, 200, { ok: true, plan });
    }
    if (path !== "/api/rai2/billing-link" || method !== "GET") return PASS;
    if (env.OMB_RAI2_TENANT !== "1" || !ownerOrAdmin(auth)) return json(res, 404, { error: "not found" });
    let portal: URL;
    try { portal = new URL(env.OMB_SIGNIN_TENANT_URL ?? ""); }
    catch { return json(res, 503, { error: "billing portal unavailable" }); }
    if (portal.protocol !== "https:" || portal.origin !== env.OMB_SIGNIN_TENANT_URL || portal.username || portal.password) {
      return json(res, 503, { error: "billing portal unavailable" });
    }
    return json(res, 200, { url: `${portal.origin}/?billing=1` });
  };
};
