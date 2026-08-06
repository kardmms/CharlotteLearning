"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Compass, MousePointerClick, X } from "lucide-react";

const steps = [
  {
    title: "Welcome to Charlotte",
    body: "This quick tour shows where the main teacher actions live.",
    icon: Compass,
    target: "teacher-workspace"
  },
  {
    title: "Create a class",
    body: "Use the class setup panel to name the class and choose the grade level.",
    icon: MousePointerClick,
    target: "create-class"
  },
  {
    title: "Open a dashboard",
    body: "Class cards take you into roster, assignments, progress, and stats.",
    icon: ArrowRight,
    target: "class-dashboards"
  },
  {
    title: "Use the sidebar",
    body: "The sidebar keeps classes, assignments, analytics, and the public website one click away.",
    icon: CheckCircle2,
    target: "teacher-sidebar"
  }
];

const tourStorageKey = "charlotte-teacher-spotlight-tour-complete";

export function TeacherTutorial() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.localStorage.getItem(tourStorageKey) !== "1") {
      const timer = window.setTimeout(() => setOpen(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const target = document.querySelector<HTMLElement>(`[data-tour="${steps[index].target}"]`);
    if (!target) return;
    target.classList.add("tour-target-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    return () => {
      target.classList.remove("tour-target-highlight");
    };
  }, [index, open]);

  function close() {
    window.localStorage.setItem(tourStorageKey, "1");
    setOpen(false);
  }

  if (!open) return null;

  const step = steps[index];
  const Icon = step.icon;

  return (
    <aside className="tour-card" aria-label="Teacher setup tour">
        <button className="tour-close" type="button" onClick={close} aria-label="Close tutorial">
          <X size={18} />
        </button>
        <div className="tour-icon">
          <Icon size={24} />
        </div>
        <div className="eyebrow">Step {index + 1} of {steps.length}</div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-progress" aria-hidden="true">
          {steps.map((_, dotIndex) => (
            <span className={dotIndex <= index ? "active" : ""} key={dotIndex} />
          ))}
        </div>
        <div className="actions">
          {index > 0 && (
            <button className="ghost-button" type="button" onClick={() => setIndex((value) => value - 1)}>
              Back
            </button>
          )}
          {index < steps.length - 1 ? (
            <button className="button" type="button" onClick={() => setIndex((value) => value + 1)}>
              Next
              <ArrowRight size={18} />
            </button>
          ) : (
            <button className="button" type="button" onClick={close}>
              Finish
              <CheckCircle2 size={18} />
            </button>
          )}
        </div>
    </aside>
  );
}
