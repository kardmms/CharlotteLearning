"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const tickDelayMs = 5_000;

function shouldRefreshPage(pathname: string, responseTab: boolean) {
  return pathname === "/teacher/classes" ||
    pathname === "/teacher/analytics" ||
    /^\/teacher\/classes\/[^/]+$/.test(pathname) ||
    pathname.endsWith("/progress") ||
    pathname.endsWith("/materials") ||
    pathname.includes("/questions/") && pathname.endsWith("/responses") ||
    responseTab;
}

function teacherIsEditing() {
  const active = document.activeElement;
  return active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    active instanceof HTMLButtonElement;
}

export function ShowcaseSimulationPulse() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function advance() {
      try {
        const response = await fetch("/api/showcase/tick", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        if (cancelled || response.status === 401 || response.status === 403) return;
        if (response.ok) {
          const result = await response.json() as { advanced?: boolean };
          const responseTab = pathname.includes("/review") &&
            new URLSearchParams(window.location.search).get("tab") === "responses";
          if (result.advanced && shouldRefreshPage(pathname, responseTab) && !teacherIsEditing()) {
            router.refresh();
          }
        }
      } catch {
        // A later pulse retries. The real teacher workspace remains usable if simulation pauses.
      }
      if (!cancelled) timer = window.setTimeout(advance, tickDelayMs);
    }

    timer = window.setTimeout(advance, 1_200);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname, router]);

  return null;
}
