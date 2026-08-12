"use client";

import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  currentResourceMode,
  noteNetworkResult,
  onResourceModeChange,
  type ResourceMode
} from "@/lib/resource-mode";

const tickDelayMs = 1_600;
const constrainedTickDelayMs = 5_000;
const offlineTickDelayMs = 12_000;

type SimulationState = {
  running?: boolean;
  simulationCompleted?: boolean;
  advanced?: boolean;
  title?: string;
  materialId?: string;
  classroomId?: string;
  completedStudents?: number;
  totalStudents?: number;
};

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

export function ShowcaseSimulationPulse({ expiresAt }: { expiresAt?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [resourceMode, setResourceMode] = useState<ResourceMode>("standard");

  useEffect(() => {
    setResourceMode(currentResourceMode());
    return onResourceModeChange(setResourceMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let expirationTimer: number | undefined;

    const returnToShowcaseStart = () => {
      window.location.replace("/api/showcase/expire");
    };

    if (expiresAt) {
      expirationTimer = window.setTimeout(
        returnToShowcaseStart,
        Math.max(0, new Date(expiresAt).getTime() - Date.now())
      );
    }

    async function advance() {
      const mode = currentResourceMode();
      if (mode === "offline") {
        if (!cancelled) timer = window.setTimeout(advance, offlineTickDelayMs);
        return;
      }
      const startedAt = performance.now();
      try {
        const response = await fetch("/api/showcase/tick", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        noteNetworkResult(performance.now() - startedAt, response.ok);
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          returnToShowcaseStart();
          return;
        }
        if (response.ok) {
          const result = await response.json() as SimulationState;
          if (result.running || result.simulationCompleted) setSimulation(result);
          else setSimulation(null);
          const responseTab = pathname.includes("/review") &&
            new URLSearchParams(window.location.search).get("tab") === "responses";
          if (result.simulationCompleted && result.classroomId && result.materialId) {
            router.push(`/teacher/classes/${result.classroomId}/progress?materialId=${result.materialId}`);
            return;
          }
          if (
            currentResourceMode() === "standard" &&
            result.advanced &&
            shouldRefreshPage(pathname, responseTab) &&
            !teacherIsEditing()
          ) {
            router.refresh();
          }
        }
      } catch {
        noteNetworkResult(performance.now() - startedAt, false);
        // A later pulse retries. The real teacher workspace remains usable if simulation pauses.
      }
      if (!cancelled) {
        timer = window.setTimeout(
          advance,
          currentResourceMode() === "constrained" ? constrainedTickDelayMs : tickDelayMs
        );
      }
    }

    timer = window.setTimeout(
      advance,
      resourceMode === "offline" ? offlineTickDelayMs : resourceMode === "constrained" ? constrainedTickDelayMs : 1_200
    );
    const scheduleClose = () => {
      navigator.sendBeacon(
        "/api/showcase/close",
        new Blob(["{}"], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", scheduleClose);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (expirationTimer) window.clearTimeout(expirationTimer);
      window.removeEventListener("pagehide", scheduleClose);
    };
  }, [expiresAt, pathname, resourceMode, router]);

  if (!simulation?.running && !simulation?.simulationCompleted) return null;
  return (
    <aside className={`showcase-simulation-status ${simulation.simulationCompleted ? "complete" : ""}`}>
      {simulation.simulationCompleted
        ? <CheckCircle2 size={21} />
        : <LoaderCircle className="showcase-spinner" size={21} />}
      <div>
        <strong>{simulation.simulationCompleted ? "Simulation complete" : "Simulation is running"}</strong>
        <span>
          {simulation.completedStudents ?? 0} of {simulation.totalStudents ?? "all"} students finished
        </span>
      </div>
    </aside>
  );
}
