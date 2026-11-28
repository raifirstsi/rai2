import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetEnterpriseBrainStoreForTest, getEnterpriseBrainStore } from "./enterprise-brain.ts";
import { resetEnterpriseGovernanceStoreForTest, getEnterpriseGovernanceStore } from "./enterprise-governance.ts";
import { resetEnterpriseOmnichannelGatewayForTest } from "./enterprise-omnichannel.ts";
import { EnterpriseSovereigntyManager, resetEnterpriseSovereigntyManagerForTest } from "./enterprise-sovereignty.ts";
import { resetEnterpriseTeamOrchestratorForTest, getEnterpriseTeamOrchestrator } from "./enterprise-team.ts";

describe("Enterprise Phase 5: Envelope Encryption, Key Rotation, Open Export & CEO Console", () => {
  const dirs: string[] = [];
  afterEach(() => {
    resetEnterpriseSovereigntyManagerForTest();
    resetEnterpriseGovernanceStoreForTest();
    resetEnterpriseBrainStoreForTest();
    resetEnterpriseTeamOrchestratorForTest();
    resetEnterpriseOmnichannelGatewayForTest();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("seals tenant secrets via Envelope DEK and rotates DEK without data loss", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-sov-"));
    dirs.push(dir);
    process.env.RAI2_DATA_DIR = dir;

    const mgr = new EnterpriseSovereigntyManager(dir);
    mgr.sealTenantSecret("tenant-acme", "openai_api_key", "sk-super-secret-999", "ceo@acme.vn");
    expect(mgr.unsealTenantSecret("tenant-acme", "openai_api_key")).toBe("sk-super-secret-999");

    const diskBefore = readFileSync(join(dir, "enterprise-keys.json"), "utf8");
    expect(diskBefore).not.toContain("sk-super-secret-999");
    expect(diskBefore).toContain("enc:dek:v1:");

    const rot = mgr.rotateTenantDek("tenant-acme", "ceo@acme.vn");
    expect(rot.keyVersion).toBe(2);
    expect(rot.reencryptedSecrets).toBe(1);
    expect(mgr.unsealTenantSecret("tenant-acme", "openai_api_key")).toBe("sk-super-secret-999");

    const diskAfter = readFileSync(join(dir, "enterprise-keys.json"), "utf8");
    expect(diskAfter).toContain("enc:dek:v2:");
    expect(diskAfter).not.toContain("sk-super-secret-999");
  });

  it("builds accurate CEO Governance Console snapshot and multi-format Open Export bundle", () => {
    const dir = mkdtempSync(join(tmpdir(), "rai2-ceo-"));
    dirs.push(dir);
    process.env.RAI2_DATA_DIR = dir;
    resetEnterpriseGovernanceStoreForTest();
    resetEnterpriseBrainStoreForTest();
    resetEnterpriseTeamOrchestratorForTest();
    resetEnterpriseOmnichannelGatewayForTest();

    getEnterpriseGovernanceStore().upsertEmployee({ email: "a@co.vn", name: "An", role: "manager", zone: "Zone 3" }, "ceo");
    getEnterpriseBrainStore().proposeDecision({ title: "Chuẩn Margin 20%", summary: "Áp dụng Q4", scopeZone: "Zone 3", autoApprove: true }, "ceo");
    const task = getEnterpriseTeamOrchestrator().createTask({ title: "Chốt KPI", assignedBotId: "bot-3", zone: "Zone 3" }, "ceo");
    getEnterpriseTeamOrchestrator().reviewTeamTask(task.id, "approved", "Tốt", "ceo");

    const mgr = new EnterpriseSovereigntyManager(dir);
    const snap = mgr.buildCeoConsoleSnapshot("default");
    expect(snap.organization.activeEmployees).toBe(1);
    expect(snap.productivity.completedTasks).toBe(1);
    expect(snap.productivity.completionRatePct).toBe(100);
    expect(snap.knowledge.approvedDecisions).toBe(1);

    const exp = mgr.buildOpenExportBundle("default", "ceo@co.vn");
    expect(exp.markdownBundle).toContain("Chuẩn Margin 20%");
    expect(exp.encryptedBackupPackage.format).toBe("rai2-envelope-backup-v1");
    expect(exp.encryptedBackupPackage.ciphertext).toContain("enc:dek:v1:");
    expect(JSON.stringify(exp.jsonBundle)).not.toContain("wrappedDek");
    expect(mgr.verifyEncryptedBackupPackage(exp.encryptedBackupPackage).valid).toBe(true);
    // Tampered ciphertext must fail AES-GCM authTag verification
    const tampered = { ...exp.encryptedBackupPackage, ciphertext: exp.encryptedBackupPackage.ciphertext.slice(0, -4) + "ffff" };
    expect(mgr.verifyEncryptedBackupPackage(tampered).valid).toBe(false);
    // Rotate DEK from v1 -> v2: v1 backup must STILL verify cleanly after rotation!
    mgr.rotateTenantDek("default", "ceo@co.vn");
    expect(mgr.verifyEncryptedBackupPackage(exp.encryptedBackupPackage).valid).toBe(true);
    expect(() => mgr.sealTenantSecret("default", "__proto__", "bad", "ceo@co.vn")).toThrow();
    expect(() => mgr.sealTenantSecret("default", "too_big", "x".repeat(16_385), "ceo@co.vn")).toThrow();
    expect(exp.csvBundle.startsWith("\uFEFF")).toBe(true);
    expect(exp.csvBundle).toContain("Chuẩn Margin 20%");
    const decrypted = mgr.decryptBackupBundle(exp.encryptedBackupPackage, "ceo@co.vn");
    expect(decrypted?.schema).toBe("rai2-enterprise-open-export-v1");
    expect(mgr.decryptBackupBundle(tampered, "ceo@co.vn")).toBeNull();
  });
});
