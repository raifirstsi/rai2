import { useSyncExternalStore } from "react";
import type { Rai2PlanStatus } from "@/state/config-status";

export type Rai2OperatingMode = "creator" | "enterprise";

export const RAI2_OPERATING_MODE_KEY = "rai2-operating-mode";

let sessionChoice: Rai2OperatingMode | undefined;
let planSnapshot: Rai2PlanStatus | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function getRai2PlanSnapshot(): Rai2PlanStatus | null {
  return planSnapshot;
}

export function isEnterpriseVipEntitled(plan: Rai2PlanStatus | null = planSnapshot): boolean {
  if (!plan) return true; // Keep standalone/uninitialized tests non-breaking until managed plan lands
  if (!plan.managed) return true;
  return plan.enterpriseAccess === true;
}

export function syncRai2PlanSnapshot(next: Rai2PlanStatus | null | undefined): void {
  const normalized = next ?? null;
  const same =
    planSnapshot?.planId === normalized?.planId &&
    planSnapshot?.entitlement === normalized?.entitlement &&
    planSnapshot?.enterpriseAccess === normalized?.enterpriseAccess &&
    planSnapshot?.managed === normalized?.managed &&
    planSnapshot?.trialThrough === normalized?.trialThrough &&
    planSnapshot?.paidThrough === normalized?.paidThrough;
  if (same) return;
  planSnapshot = normalized;
  if (normalized && normalized.managed && !normalized.enterpriseAccess) {
    sessionChoice = "creator";
  }
  notify();
}

export function readRai2Mode(): Rai2OperatingMode {
  if (planSnapshot?.managed && !planSnapshot.enterpriseAccess) {
    return "creator";
  }
  if (sessionChoice !== undefined) return sessionChoice;
  try {
    const store = storage();
    const stored = store?.getItem(RAI2_OPERATING_MODE_KEY);
    if (stored === "creator" || stored === "enterprise") return stored;
    return "enterprise";
  } catch {
    return "enterprise";
  }
}

export function setRai2Mode(mode: Rai2OperatingMode): void {
  if (mode === "enterprise" && planSnapshot?.managed && !planSnapshot.enterpriseAccess) {
    sessionChoice = "creator";
    notify();
    return;
  }
  sessionChoice = mode;
  try {
    storage()?.setItem(RAI2_OPERATING_MODE_KEY, mode);
  } catch {
    // Non-blocking for environments without storage
  }
  notify();
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore listener error
    }
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key !== RAI2_OPERATING_MODE_KEY && event.key !== null) return;
  if (event.storageArea && event.storageArea !== storage()) return;
  sessionChoice = undefined;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getServerModeSnapshot(): string {
  return "enterprise|1|none";
}

function getClientSnapshot(): string {
  const mode = readRai2Mode();
  const allowed = isEnterpriseVipEntitled(planSnapshot) ? "1" : "0";
  const planKey = planSnapshot ? `${planSnapshot.planId}:${planSnapshot.trialThrough}` : "none";
  return `${mode}|${allowed}|${planKey}`;
}

export function useRai2Mode(): {
  mode: Rai2OperatingMode;
  setMode: (mode: Rai2OperatingMode) => void;
  isEnterprise: boolean;
  isCreator: boolean;
  enterpriseAllowed: boolean;
  plan: Rai2PlanStatus | null;
  trialDaysLeft: number | null;
} {
  useSyncExternalStore(subscribe, getClientSnapshot, getServerModeSnapshot);
  const enterpriseAllowed = isEnterpriseVipEntitled(planSnapshot);
  const mode: Rai2OperatingMode = enterpriseAllowed ? readRai2Mode() : "creator";
  const trialDaysLeft =
    planSnapshot?.planId === "trial" && planSnapshot.trialThrough > Date.now()
      ? Math.max(1, Math.ceil((planSnapshot.trialThrough - Date.now()) / 86_400_000))
      : null;

  return {
    mode,
    setMode: setRai2Mode,
    isEnterprise: enterpriseAllowed && mode === "enterprise",
    isCreator: !enterpriseAllowed || mode === "creator",
    enterpriseAllowed,
    plan: planSnapshot,
    trialDaysLeft,
  };
}

