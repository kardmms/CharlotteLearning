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

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function TeacherTutorial() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (window.localStorage.getItem(tourStorageKey) !== "1") {
      const timer = window.setTimeout(() => setOpen(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const target = document.querySelector<HTMLElement>(`[data-tour="${steps[index].target}"]`);
    if (!target) {
      setRect(null);
      return;
    }
    const targetElement = target;

    targetElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    function updateRect() {
      const box = targetElement.getBoundingClientRect();
      setRect({
        top: Math.max(14, box.top - 10),
        left: Math.max(14, box.left - 10),
        width: Math.min(window.innerWidth - 28, box.width + 20),
        height: Math.min(window.innerHeight - 28, box.height + 20)
      });
    }

    const timers = [window.setTimeout(updateRect, 80), window.setTimeout(updateRect, 520)];
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });
    updateRect();

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [index, open]);

  function close() {
    window.localStorage.setItem(tourStorageKey, "1");
    setOpen(false);
  }

  if (!open) return null;

  const step = steps[index];
  const Icon = step.icon;
  const maxCardLeft = typeof window === "undefined" ? 18 : Math.max(18, window.innerWidth - 486);
  const maxCardTop = typeof window === "undefined" ? 18 : Math.max(18, window.innerHeight - 330);
  const cardStyle = rect
    ? {
        top: Math.min(
          maxCardTop,
          Math.max(18, rect.top + rect.height + 18 > maxCardTop ? rect.top - 304 : rect.top + rect.height + 18)
        ),
        left: Math.min(maxCardLeft, Math.max(18, rect.left))
      }
    : undefined;

  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true" aria-label="Teacher setup tour">
      <div
        className="tour-spotlight"
        style={
          rect
            ? {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            : undefined
        }
      />
      <div className="tour-card" style={cardStyle}>
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
      </div>
    </div>
  );
}
