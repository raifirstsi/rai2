import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnterpriseGovernanceStore,
  employeeNamespaces,
  evaluateDataAccess,
  resolveSensitivityModelRoute,
} from "./enterprise-governance.ts";
import { scanAndRedactText } from "./enterprise-dlp.ts";
import { applyEnterpriseInboundDlp, checkEnterpriseTurnPolicy } from "./enterprise-runtime-hooks.ts";

describe("Enterprise Phase 1 Governance, ABAC, DLP & Sensitivity Routing", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("enforces ABAC tiers, cross-zone isolation, offboarding lock, and private-personal namespace isolation", () => {
    const empSales = {
      email: "an@company.vn",
      role: "member" as const,
      zone: "Zone 3",
      maxDataTier: "zone" as const,
      status: "active" as const,
    };

    expect(evaluateDataAccess({ employee: null, targetTier: "public" }).allowed).toBe(true);
    expect(evaluateDataAccess({ employee: null, targetTier: "internal" }).allowed).toBe(false);
    expect(evaluateDataAccess({ employee: empSales, targetTier: "zone", targetZone: "Zone 3" }).allowed).toBe(true);
    expect(evaluateDataAccess({ employee: empSales, targetTier: "zone", targetZone: "Zone 6" }).allowed).toBe(false);
    expect(evaluateDataAccess({ employee: empSales, targetTier: "confidential" }).allowed).toBe(false);
    expect(
      evaluateDataAccess({
        employee: empSales,
        targetTier: "internal",
        targetNamespace: "private-personal",
        targetOwnerEmail: "binh@company.vn",
      }).allowed,
    ).toBe(false);
    expect(
      evaluateDataAccess({
        employee: { ...empSales, status: "offboarded" },
        targetTier: "public",
      }).allowed,
    ).toBe(false);
  });

  it("enforces Local LLM routing or blocks when confidential data requires on-premise inference", () => {
    const strictPolicy = { requireLocalLlmForConfidential: true, localLlmEngineHint: "ollama" };
    const rerouted = resolveSensitivityModelRoute({
      constitution: strictPolicy,
      dataTier: "confidential",
      currentEngineId: "claude",
      availableLocalEngineIds: ["claude", "ollama-qwen"],
    });
    expect(rerouted.route).toBe("local_enforced");
    expect(rerouted.targetEngineId).toBe("ollama-qwen");

    const blocked = resolveSensitivityModelRoute({
      constitution: strictPolicy,
      dataTier: "confidential",
      currentEngineId: "chatgpt",
      availableLocalEngineIds: ["chatgpt", "gemini"],
    });
    expect(blocked.route).toBe("blocked_no_local_llm");
  });

  it("masks API keys, bearer tokens, cards, and blocks/censors forbidden company terms", () => {
    const res = scanAndRedactText("Key: sk-proj-abc12345678901234567890 và giảm giá 50% cho khách", {
      dlpEnabled: true,
      censorshipEnabled: true,
      forbiddenTopics: ["giảm giá 50%"],
      blockOnForbiddenTopic: true,
    });
    expect(res.sanitizedText).toContain("[REDACTED_API_KEY]");
    expect(res.sanitizedText).toContain("[CENSORED_POLICY]");
    expect(res.blocked).toBe(true);
    expect(res.redactions.some((r) => r.type === "api_key")).toBe(true);
    expect(res.redactions.some((r) => r.type === "forbidden_term")).toBe(true);
  });

  it("provisions employees with isolated namespaces and records verifiable Merkle audit trail", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-gov-"));
    dirs.push(dir);
    const store = new EnterpriseGovernanceStore(dir);
    const prof = store.upsertEmployee({ email: "Lan.Nguyen@Company.vn", name: "Lan", role: "manager", zone: "Zone 2" }, "ceo@company.vn");
    expect(prof.namespaces).toEqual(employeeNamespaces("lan.nguyen@company.vn"));
    expect(prof.maxDataTier).toBe("zone");

    store.updateGovernance({ constitution: { requireLocalLlmForConfidential: true, forbiddenTopics: ["lương nội bộ"] } }, "ceo@company.vn");
    const trail = store.queryAuditTrail({ limit: 10 });
    expect(trail.integrity.valid).toBe(true);
    expect(trail.records.some((r) => r.action === "employee_provisioned")).toBe(true);
    expect(trail.records.some((r) => r.action === "governance_updated")).toBe(true);
  });

  it("redacts JWT tokens, AWS keys, and DB connection strings", () => {
    const res = scanAndRedactText(
      "jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456 aws=AKIAIOSFODNN7EXAMPLE db=postgres://admin:secret123@db.internal:5432/prod",
      { dlpEnabled: true },
    );
    expect(res.sanitizedText).toContain("[REDACTED_JWT]");
    expect(res.sanitizedText).toContain("[REDACTED_API_KEY]");
    expect(res.sanitizedText).toContain("[REDACTED_DB_URI]");
  });

  it("offboards employee, revokes access, and evaluates checkEnterpriseTurnPolicy", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-off-"));
    dirs.push(dir);
    const store = new EnterpriseGovernanceStore(dir);
    store.upsertEmployee({ email: "minh@company.vn", name: "Minh", role: "member", zone: "Zone 6" }, "admin");
    const off = store.offboardEmployee("minh@company.vn", "admin");
    expect(off?.status).toBe("offboarded");
    expect(evaluateDataAccess({ employee: off, targetTier: "public" }).allowed).toBe(false);
    const trail = store.queryAuditTrail({ action: "employee_offboarded" });
    expect(trail.records.length).toBeGreaterThan(0);

    const policyCheck = checkEnterpriseTurnPolicy({ botSection: "Zone 3", currentEngineId: "claude" });
    expect(policyCheck.allowed).toBe(true);
  });

  it("scrubs secrets on inbound prompt via applyEnterpriseInboundDlp", () => {
    const res = applyEnterpriseInboundDlp("Hãy kiểm tra key sk-ant-api03-1234567890abcdef12345", "an@company.vn");
    expect(res.sanitizedText).toContain("[REDACTED_API_KEY]");
    expect(res.redactions.length).toBeGreaterThan(0);
  });
});
