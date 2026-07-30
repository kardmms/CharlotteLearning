"use client";

import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

const tickDelayMs = 1_600;

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

export function ShowcaseSimulationPulse() {
  const pathname = usePathname();
  const router = useRouter();
  const [simulation, setSimulation] = useState<SimulationState | null>(null);

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
          const result = await response.json() as SimulationState;
          if (result.running || result.simulationCompleted) setSimulation(result);
          else setSimulation(null);
          const responseTab = pathname.includes("/review") &&
            new URLSearchParams(window.location.search).get("tab") === "responses";
          if (result.simulationCompleted && result.classroomId && result.materialId) {
            router.push(`/teacher/classes/${result.classroomId}/progress?materialId=${result.materialId}`);
            return;
          }
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
      window.removeEventListener("pagehide", scheduleClose);
    };
  }, [pathname, router]);

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
