"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, CircleHelp, LogOut, X } from "lucide-react";
import { logoutTeacher } from "@/app/teacher/actions";

type GuideStep = {
  number: number;
  title: string;
  description: string;
  tasks: string[];
  target?: string;
  action?: { href: string; label: string };
};

type ShowcaseGuideProps = {
  classroomId?: string;
  materialId?: string;
  studentCount?: number;
  simulationStarted?: boolean;
  simulationCompleted?: boolean;
};

const checklistLabels = [
  "Create a classroom",
  "Generate and approve the roster",
  "Create an assignment",
  "Run the class simulation",
  "Explore student results"
];

function isResultsPage(pathname: string) {
  return pathname.endsWith("/progress") || pathname.includes("/responses") || pathname.endsWith("/stats");
}

function guideStep(pathname: string, props: ShowcaseGuideProps): GuideStep {
  const { classroomId, materialId, studentCount = 0, simulationStarted, simulationCompleted } = props;
  if (!classroomId) {
    const onClassForm = pathname === "/teacher" || pathname.endsWith("/classes/new");
    return {
      number: 1,
      title: "Create your showcase classroom",
      description: "Use the real classroom setup form. Charlotte will take you directly to the roster when it is ready.",
      tasks: onClassForm
        ? ["Enter a class name", "Choose the grade", "Click Create class"]
        : ["Click New class", "Enter a name and grade", "Click Create class"],
      target: onClassForm ? "create-class" : "new-class",
      action: onClassForm ? undefined : { href: "/teacher/classes/new", label: "New class" }
    };
  }

  if (studentCount === 0) {
    const onRosterPage = pathname.endsWith("/roster");
    return {
      number: 2,
      title: "Generate your demo class list",
      description: "Use the fictional sample sheet so you can try Charlotte's AI-assisted roster flow without using real student information.",
      tasks: [
        "Download the sample roster",
        "Choose that file in Student spreadsheet",
        "Click Have Charlotte generate the class list",
        "Review the 12 names, then click Approve and add"
      ],
      target: onRosterPage ? "showcase-roster-import" : undefined,
      action: onRosterPage
        ? undefined
        : { href: `/teacher/classes/${classroomId}/roster`, label: "Open student roster" }
    };
  }

  if (!materialId) {
    const onNewMaterialPage = pathname.endsWith("/materials/new");
    return {
      number: 3,
      title: "Create an assignment",
      description: "Upload lesson material exactly as a teacher would. Charlotte will turn it into an editable draft.",
      tasks: [
        "Open Create assignment",
        "Add a title and source file",
        "Click Create draft with Charlotte"
      ],
      target: onNewMaterialPage ? "create-assignment" : undefined,
      action: onNewMaterialPage
        ? undefined
        : { href: `/teacher/classes/${classroomId}/materials/new`, label: "Create assignment" }
    };
  }

  if (!simulationStarted) {
    const onReviewPage = pathname.includes(`/materials/${materialId}`) && pathname.endsWith("/review");
    return {
      number: 4,
      title: "Run the class simulation",
      description: "Review the generated questions, then start the simulation. All approved fictional students will complete the assignment.",
      tasks: ["Review the questions", "Click Start Simulation", "Wait for the live student activity to finish"],
      target: onReviewPage ? "start-simulation" : undefined,
      action: onReviewPage
        ? undefined
        : { href: `/teacher/classes/${classroomId}/materials/${materialId}/review`, label: "Review assignment" }
    };
  }

  const onResultsPage = isResultsPage(pathname);
  return {
    number: 5,
    title: simulationCompleted ? "Explore the class results" : "Watch the class complete the assignment",
    description: simulationCompleted
      ? "The demo class is finished. Open progress, a numbered question, or an individual response to inspect the results."
      : "Fictional students are completing the assignment now. Open progress to watch their work appear live.",
    tasks: [
      "Open live progress",
      "Click a numbered question to compare answers",
      "Open an individual student response",
      "Review class trends and completion"
    ],
    action: onResultsPage
      ? { href: `/teacher/classes/${classroomId}/materials/${materialId}/review?tab=responses`, label: "View response summary" }
      : { href: `/teacher/classes/${classroomId}/progress`, label: "Open live progress" }
  };
}

export function ShowcaseGuide(props: ShowcaseGuideProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const step = guideStep(pathname, props);

  useEffect(() => {
    setDismissed(window.sessionStorage.getItem("charlotte_showcase_guide_hidden") === "1");
  }, []);

  useEffect(() => {
    if (dismissed || !step.target) return;
    const targets = document.querySelectorAll<HTMLElement>(`[data-showcase-target="${step.target}"]`);
    targets.forEach((target) => target.classList.add("showcase-target-highlight"));
    return () => targets.forEach((target) => target.classList.remove("showcase-target-highlight"));
  }, [dismissed, step.target, pathname]);

  const completed = [
    Boolean(props.classroomId),
    (props.studentCount ?? 0) > 0,
    Boolean(props.materialId),
    Boolean(props.simulationStarted),
    isResultsPage(pathname)
  ];

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
        <CircleHelp size={18} /> Showcase checklist
      </button>
    );
  }

  return (
    <aside className="showcase-guide" aria-live="polite">
      <div className="showcase-guide-heading">
        <span>Showcase checklist · Step {step.number} of 5</span>
        <button
          type="button"
          aria-label="Hide showcase checklist"
          onClick={() => {
            window.sessionStorage.setItem("charlotte_showcase_guide_hidden", "1");
            setDismissed(true);
          }}
        ><X size={17} /></button>
      </div>

      <ol className="showcase-progress-list" aria-label="Showcase progress">
        {checklistLabels.map((label, index) => (
          <li
            className={completed[index] ? "complete" : index + 1 === step.number ? "current" : ""}
            key={label}
            aria-current={index + 1 === step.number ? "step" : undefined}
          >
            {completed[index] ? <CheckCircle2 size={17} /> : <Circle size={17} />}
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className="showcase-current-step">
        <strong>{step.title}</strong>
        <p>{step.description}</p>
        <ul>
          {step.tasks.map((task) => <li key={task}>{task}</li>)}
        </ul>
      </div>

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
