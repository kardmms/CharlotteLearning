"use client";

export type ResourceMode = "standard" | "constrained" | "offline";

const resourceModeEvent = "charlotte-resource-mode";

type NetworkInformationLike = EventTarget & {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

function connection() {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  }).connection || (navigator as Navigator & {
    mozConnection?: NetworkInformationLike;
  }).mozConnection || (navigator as Navigator & {
    webkitConnection?: NetworkInformationLike;
  }).webkitConnection || null;
}

export function detectedResourceMode() {
  if (typeof navigator === "undefined") return "standard" satisfies ResourceMode;
  if (!navigator.onLine) return "offline" satisfies ResourceMode;

  const info = connection();
  if (!info) return "standard" satisfies ResourceMode;
  const effectiveType = info.effectiveType || "";
  if (
    info.saveData ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    (typeof info.downlink === "number" && info.downlink > 0 && info.downlink < 1.2) ||
    (typeof info.rtt === "number" && info.rtt > 700)
  ) {
    return "constrained" satisfies ResourceMode;
  }
  return "standard" satisfies ResourceMode;
}

export function currentResourceMode() {
  if (typeof document === "undefined") return detectedResourceMode();
  const mode = document.documentElement.dataset.resourceMode;
  return mode === "offline" || mode === "constrained" || mode === "standard"
    ? mode
    : detectedResourceMode();
}

export function applyResourceMode(mode: ResourceMode) {
  if (typeof document === "undefined") return;
  const previous = currentResourceMode();
  document.documentElement.dataset.resourceMode = mode;
  if (previous !== mode) {
    window.dispatchEvent(new CustomEvent(resourceModeEvent, { detail: { mode } }));
  }
}

export function noteNetworkResult(durationMs: number, ok: boolean) {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    applyResourceMode("offline");
    return;
  }
  if (!ok || durationMs > 3_500) {
    applyResourceMode("constrained");
    return;
  }
  if (durationMs < 1_800 && detectedResourceMode() === "standard") {
    applyResourceMode("standard");
  }
}

export function onResourceModeChange(callback: (mode: ResourceMode) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ mode?: ResourceMode }>).detail;
    if (detail?.mode) callback(detail.mode);
  };
  window.addEventListener(resourceModeEvent, listener);
  return () => window.removeEventListener(resourceModeEvent, listener);
}

export function connectionTarget() {
  return connection();
}
