import { useSyncExternalStore } from "react";

export type Rai2OperatingMode = "creator" | "enterprise";

export const RAI2_OPERATING_MODE_KEY = "rai2-operating-mode";

let sessionChoice: Rai2OperatingMode | undefined;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readRai2Mode(): Rai2OperatingMode {
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

export function useRai2Mode(): {
  mode: Rai2OperatingMode;
  setMode: (mode: Rai2OperatingMode) => void;
  isEnterprise: boolean;
  isCreator: boolean;
} {
  const mode = useSyncExternalStore(subscribe, readRai2Mode, (): Rai2OperatingMode => "enterprise");
  return {
    mode,
    setMode: setRai2Mode,
    isEnterprise: mode === "enterprise",
    isCreator: mode === "creator",
  };
}
