"use client";

import { useEffect } from "react";
import {
  applyResourceMode,
  connectionTarget,
  detectedResourceMode
} from "@/lib/resource-mode";

export function NetworkResourceMode() {
  useEffect(() => {
    const syncMode = () => applyResourceMode(detectedResourceMode());
    const connection = connectionTarget();

    syncMode();
    window.addEventListener("online", syncMode);
    window.addEventListener("offline", syncMode);
    connection?.addEventListener("change", syncMode);

    return () => {
      window.removeEventListener("online", syncMode);
      window.removeEventListener("offline", syncMode);
      connection?.removeEventListener("change", syncMode);
    };
  }, []);

  return null;
}
