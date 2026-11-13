import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { createSaasServer } from "../saas/server.ts";
import { SaasStore } from "../saas/store.ts";
import { createPlan, emptyRegistry, fenceRules } from "../server/fleet.ts";

const workspaceCount = 20;
const requestCount = 1_000;
const concurrency = 25;
const started = performance.now();
const rssBefore = process.memoryUsage().rss;
let registry = emptyRegistry("fixture.test");
const plannedPorts = new Set();

for (let index = 0; index < workspaceCount; index++) {
  const slug = `tenant-${String(index + 1).padStart(2, "0")}`;
  const plan = createPlan({
    registry,
    slug,
    seed: { admins: [`owner-${index + 1}@example.test`], members: [] },
    memoryMax: "2G",
  });
  assert(!plannedPorts.has(plan.workspace.port));
  assert(!plannedPorts.has(plan.workspace.webhookPort));
  plannedPorts.add(plan.workspace.port);
  plannedPorts.add(plan.workspace.webhookPort);
  assert(plan.steps.some((step) => step.kind === "write" && step.path.endsWith("limits.conf") && step.content.includes("MemoryMax=2G")));
  registry = plan.registry;
}

assert.equal(Object.keys(registry.workspaces).length, workspaceCount);
assert.equal(plannedPorts.size, workspaceCount * 2);
const fence = fenceRules(Object.values(registry.workspaces), 8812);
for (const workspace of Object.values(registry.workspaces)) assert(fence.includes(`omb-${workspace.slug}`));
const planningMs = performance.now() - started;

const scratch = mkdtempSync(join(tmpdir(), "rai2-capacity-"));
const store = new SaasStore(join(scratch, "capacity.db"));
const fixturePort = await new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    assert(address && typeof address === "object");
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const server = createSaasServer({
  store,
  trialEnabled: false,
  paymentsEnabled: false,
  config: {
    publicOrigin: `http://127.0.0.1:${fixturePort}`,
    tenantDomain: "fixture.test",
    bankAccount: "1234567890",
    bankName: "Fixture Bank",
    sepayApiKey: randomBytes(32).toString("hex"),
    otpPepper: randomBytes(32).toString("hex"),
    tenantSigningKey: randomBytes(32).toString("hex"),
    maxWorkspaces: workspaceCount,
  },
  mailer: { sendCode: async () => {} },
});

const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
const latencies = [];
try {
  await new Promise((resolve) => server.listen(fixturePort, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < requestCount) {
      const index = next++;
      const requestStarted = performance.now();
      const path = index % 2 === 0 ? "/healthz" : "/api/me";
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(5_000) });
      assert.equal(response.status, path === "/healthz" ? 200 : 401);
      await response.arrayBuffer();
      latencies.push(performance.now() - requestStarted);
    }
  }));
} finally {
  await new Promise((resolve) => server.close(resolve));
  store.close();
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

latencies.sort((a, b) => a - b);
const report = {
  qualification: "isolated control-plane and fleet-planning benchmark; not a production runtime capacity certificate",
  workspacesPlanned: workspaceCount,
  isolatedPortsPlanned: plannedPorts.size,
  memoryLimitPerWorkspace: "2G",
  planningMs: Number(planningMs.toFixed(2)),
  requests: requestCount,
  concurrency,
  latencyMs: {
    p50: Number(percentile(latencies, 0.50).toFixed(2)),
    p95: Number(percentile(latencies, 0.95).toFixed(2)),
    p99: Number(percentile(latencies, 0.99).toFixed(2)),
    max: Number(latencies.at(-1).toFixed(2)),
  },
  processRssDeltaMiB: Number(((process.memoryUsage().rss - rssBefore) / 1024 / 1024).toFixed(2)),
};
assert(report.latencyMs.p95 < 1_000, `control-plane p95 exceeded 1 second: ${report.latencyMs.p95} ms`);
console.log(JSON.stringify(report, null, 2));
