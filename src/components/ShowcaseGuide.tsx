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
  if (pathname.endsWith("/progress") || pathname.includes("/responses")) {
    return {
      number: 5,
      title: "Explore live student progress",
      description: "Open any numbered question or student response to inspect exactly how the class performed.",
      action: materialId && classroomId
        ? { href: `/teacher/classes/${classroomId}/materials/${materialId}/review?tab=responses`, label: "View responses" }
        : undefined
    };
  }
  if (pathname.includes("/materials/") && pathname.endsWith("/review")) {
    return {
      number: 4,
      title: "Run the class simulation",
      description: "Review or edit the questions, then click Start Simulation at the top. Every fictional student will complete the assignment."
    };
  }
  if (pathname.endsWith("/materials/new")) {
    return {
      number: 3,
      title: "Create a real assignment",
      description: "Upload or paste material exactly as a teacher would. Charlotte will generate questions and the short reading excerpts students see."
    };
  }
  if (pathname.endsWith("/materials")) {
    return {
      number: 3,
      title: materialId ? "Review your assignment" : "Create your first assignment",
      description: materialId
        ? "Open the assignment to review its questions and student reading excerpts."
        : "Use the same assignment creator teachers use with their own classes.",
      action: materialId && classroomId
        ? { href: `/teacher/classes/${classroomId}/materials/${materialId}/review`, label: "Open assignment" }
        : classroomId
          ? { href: `/teacher/classes/${classroomId}/materials/new`, label: "Create assignment" }
          : undefined
    };
  }
  if (pathname.endsWith("/roster") && classroomId) {
    return {
      number: 2,
      title: "Meet your demo class",
      description: "Your classroom now has 12 private fictional student accounts. Next, create an assignment for them.",
      action: { href: `/teacher/classes/${classroomId}/materials/new`, label: "Create assignment" }
    };
  }
  if (classroomId) {
    return {
      number: 2,
      title: "Explore the classroom",
      description: "This is the real classroom dashboard. Your fictional roster is ready; continue by creating an assignment.",
      action: { href: `/teacher/classes/${classroomId}/materials/new`, label: "Create assignment" }
    };
  }
  return {
    number: 1,
    title: "Create your first classroom",
    description: "Start at the beginning of the real teacher experience: name a class and choose its grade level.",
    action: pathname === "/teacher/classes"
      ? { href: "/teacher/classes/new", label: "Create classroom" }
      : undefined
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
        <span>Showcase guide · Step {step.number} of 5</span>
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
