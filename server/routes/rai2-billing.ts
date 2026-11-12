import { ownerOrAdmin } from "../request-auth.ts";
import { PASS, type RouteHandler } from "./table.ts";

export const createRai2BillingRoute = (env: NodeJS.ProcessEnv = process.env): RouteHandler =>
  async ({ res, path, method, auth, json }) => {
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
