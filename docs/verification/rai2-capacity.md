# RAI2 capacity fixture

Run the benchmark only against its disposable SQLite database and loopback
server:

```sh
pnpm benchmark:rai2-capacity
```

It plans 20 fleet workspaces, verifies 40 unique runtime/webhook ports, a 2 GB
systemd limit per workspace and a fence entry per tenant. It then sends 1,000
health and unauthenticated-account requests to a temporary control plane at
concurrency 25. A p95 above one second fails the fixture.

Observed on 2026-11-13 with Node 24.22.1 on the local Windows fixture:

```json
{
  "workspacesPlanned": 20,
  "isolatedPortsPlanned": 40,
  "memoryLimitPerWorkspace": "2G",
  "planningMs": 161.91,
  "requests": 1000,
  "concurrency": 25,
  "latencyMs": { "p50": 98.18, "p95": 302.72, "p99": 469.7, "max": 513.01 },
  "processRssDeltaMiB": 41.97
}
```

This qualifies control-plane request handling and deterministic fleet planning,
not 20 running agent processes. VPS capacity still requires the Linux fleet
fixture plus CPU, resident memory, storage, connection and model-workload
measurements on that exact disposable host. Do not infer a customer limit from
this benchmark alone.
