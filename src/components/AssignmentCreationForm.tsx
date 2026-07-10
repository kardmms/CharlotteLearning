"use client";

import { useEffect, useState } from "react";
import { FilePenLine, FileUp, Sparkles } from "lucide-react";
import { createMaterial } from "@/app/teacher/actions";

const generationSteps = [
  "Looking through the material…",
  "Finding the most important ideas…",
  "Generating student-friendly questions…",
  "Choosing the correct answers…",
  "Checking grade-level fit…",
  "Getting your editable draft ready…"
];

export function AssignmentCreationForm({
  classroomId
}: {
  classroomId: string;
}) {
  const [creationMode, setCreationMode] = useState<"ai" | "manual">("ai");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = window.setInterval(() => {
      setGenerationStep((current) => (current + 1) % generationSteps.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  return (
    <form
      className="form-grid assignment-creation-form"
      action={createMaterial}
      onSubmit={() => {
        if (creationMode === "ai") {
          setGenerationStep(0);
          setIsGenerating(true);
        }
      }}
    >
      <input type="hidden" name="classroomId" value={classroomId} />

      <fieldset className="creation-mode-fieldset">
        <legend>How would you like to create it?</legend>
        <div className="choice-card-grid">
          <label className={`choice-card ${creationMode === "ai" ? "selected" : ""}`}>
            <input
              name="creationMode"
              type="radio"
              value="ai"
              checked={creationMode === "ai"}
              onChange={() => setCreationMode("ai")}
            />
            <span>
              <strong><Sparkles size={18} /> AI-assisted assignment</strong>
              <small>Upload a lesson, chapter, or reading and Charlotte will build an editable in-class quiz.</small>
            </span>
          </label>
          <label className={`choice-card ${creationMode === "manual" ? "selected" : ""}`}>
            <input
              name="creationMode"
              type="radio"
              value="manual"
              checked={creationMode === "manual"}
              onChange={() => setCreationMode("manual")}
            />
            <span>
              <strong><FilePenLine size={18} /> Create manually</strong>
              <small>Start with a blank five-question assignment and write it yourself.</small>
            </span>
          </label>
        </div>
      </fieldset>

      <label>
        Assignment title
        <input name="title" placeholder="Chapter 4 quiz" required />
      </label>

      <div className="grid two">
        <label>
          Student time target
          <select name="estimatedMinutes" defaultValue="15">
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="25">25 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </label>
        <label>
          Due date and time
          <input name="dueAt" type="datetime-local" />
        </label>
      </div>

      <label>
        Reading limit for at-home follow-up
        <input name="readingScope" placeholder="Example: Through chapter 2 or pages 1–5" />
        <span className="help-text">Charlotte will not ask about content beyond this chapter or page.</span>
      </label>

      {creationMode === "ai" && (
        <label>
          In-class source file
          <input name="sourceFile" type="file" accept=".pdf,.docx,.txt,application/pdf" required />
          <span className="help-text">Use this upload when Charlotte should create the in-class assignment. PDF, DOCX, or TXT, up to 4 MB.</span>
        </label>
      )}

      <button className="button" type="submit">
        {creationMode === "ai" ? <FileUp size={18} /> : <FilePenLine size={18} />}
        {creationMode === "ai" ? "Create draft with Charlotte" : "Create blank assignment"}
      </button>

      {isGenerating && (
        <div className="assignment-loading-overlay" role="status" aria-live="polite">
          <div className="assignment-loading-card">
            <div className="loading-orbit" aria-hidden="true">
              <Sparkles size={28} />
            </div>
            <span>Charlotte is building your assignment</span>
            <h2>{generationSteps[generationStep]}</h2>
            <p>This usually takes a few moments. You’ll land on an editable draft as soon as the questions are ready.</p>
            <div className="loading-step-list" aria-hidden="true">
              {generationSteps.slice(0, 4).map((step, index) => (
                <i className={index <= generationStep % generationSteps.length ? "active" : ""} key={step} />
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
