"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CircleHelp, LogOut, X } from "lucide-react";
import { logoutTeacher } from "@/app/teacher/actions";

type GuideStep = {
  number: number;
  title: string;
  description: string;
  action?: { href: string; label: string };
};

function guideStep(pathname: string, classroomId?: string, materialId?: string): GuideStep {
  if (pathname.endsWith("/progress")) {
    return {
      number: 4,
      title: "Explore live student progress",
      description: "Open any numbered question or student response to inspect exactly how the class performed.",
      action: materialId && classroomId
        ? { href: `/teacher/classes/${classroomId}/materials/${materialId}/review?tab=responses`, label: "View responses" }
        : undefined
    };
  }
  if (pathname.includes("/materials/") && pathname.endsWith("/review")) {
    return {
      number: 3,
      title: "Run the class simulation",
      description: "Review or edit the questions, then click Start Simulation at the top. Every fictional student will complete the assignment."
    };
  }
  if (pathname.endsWith("/materials/new")) {
    return {
      number: 2,
      title: "Create a real assignment",
      description: "Upload or create material exactly as a teacher would. After reviewing it, Start Simulation will appear on the assignment."
    };
  }
  if (pathname.endsWith("/materials")) {
    return {
      number: 2,
      title: "Choose an assignment",
      description: "Open the pre-generated assignment, or create your own, to review questions and simulate the class.",
      action: materialId && classroomId
        ? { href: `/teacher/classes/${classroomId}/materials/${materialId}/review`, label: "Open demo assignment" }
        : undefined
    };
  }
  return {
    number: 1,
    title: "Welcome to the teacher workspace",
    description: "This is the real dashboard with a private fictional class. Begin with Assignments to see the teacher workflow.",
    action: classroomId
      ? { href: `/teacher/classes/${classroomId}/materials`, label: "View assignments" }
      : { href: "/teacher/classes", label: "View classes" }
  };
}

export function ShowcaseGuide({ classroomId, materialId }: { classroomId?: string; materialId?: string }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem("charlotte_showcase_guide_hidden") === "1");
  }, []);

  const step = guideStep(pathname, classroomId, materialId);
  if (dismissed) {
    return (
      <button
        className="showcase-guide-reopen"
        type="button"
        onClick={() => {
          window.sessionStorage.removeItem("charlotte_showcase_guide_hidden");
          setDismissed(false);
        }}
      >
        <CircleHelp size={18} /> Showcase guide
      </button>
    );
  }

  return (
    <aside className="showcase-guide" aria-live="polite">
      <div className="showcase-guide-heading">
        <span>Showcase guide · Step {step.number} of 4</span>
        <button
          type="button"
          aria-label="Hide showcase guide"
          onClick={() => {
            window.sessionStorage.setItem("charlotte_showcase_guide_hidden", "1");
            setDismissed(true);
          }}
        ><X size={17} /></button>
      </div>
      <strong>{step.title}</strong>
      <p>{step.description}</p>
      <div className="showcase-guide-actions">
        {step.action && (
          <Link href={step.action.href}>{step.action.label}<ArrowRight size={16} /></Link>
        )}
        <form action={logoutTeacher}>
          <button type="submit"><LogOut size={15} /> Exit showcase</button>
        </form>
      </div>
    </aside>
  );
}
