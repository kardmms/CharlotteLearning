"use client";

import { useEffect, useState } from "react";
import { FilePenLine, FileUp, ShieldCheck, Sparkles } from "lucide-react";
import { createMaterial } from "@/app/teacher/actions";
import {
  DEFAULT_IN_CLASS_QUESTION_COUNT,
  MAX_IN_CLASS_QUESTION_COUNT,
  MIN_IN_CLASS_QUESTION_COUNT,
  clampMultipleChoiceCount,
  clampQuestionCount,
  defaultMultipleChoiceCount
} from "@/lib/quiz-plan";

const generationSteps = [
  "Looking through the material…",
  "Finding the most important ideas…",
  "Generating student-friendly questions…",
  "Choosing the correct answers…",
  "Checking for repeated question ideas…",
  "Checking grade-level fit…",
  "Getting your editable activity ready…"
];

export function AssignmentCreationForm({
  classroomId,
  isShowcase = false
}: {
  classroomId: string;
  isShowcase?: boolean;
}) {
  const [creationMode, setCreationMode] = useState<"ai" | "manual">("ai");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [questionCount, setQuestionCount] = useState(DEFAULT_IN_CLASS_QUESTION_COUNT);
  const [multipleChoiceCount, setMultipleChoiceCount] = useState(
    defaultMultipleChoiceCount(DEFAULT_IN_CLASS_QUESTION_COUNT)
  );
  const freeResponseCount = questionCount - multipleChoiceCount;

  useEffect(() => {
    if (!isGenerating) return;
    const interval = window.setInterval(() => {
      setGenerationStep((current) => (current + 1) % generationSteps.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  function updateQuestionCount(value: number) {
    const nextQuestionCount = clampQuestionCount(value);
    const currentRatio = questionCount > 0 ? multipleChoiceCount / questionCount : 0.75;
    setQuestionCount(nextQuestionCount);
    setMultipleChoiceCount(clampMultipleChoiceCount(Math.round(nextQuestionCount * currentRatio), nextQuestionCount));
  }

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
        <div className="assignment-ai-disclaimer">
          <ShieldCheck size={17} />
          <span>AI does not interact directly with students in any way.</span>
        </div>
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
              <strong><Sparkles size={18} /> Charlotte generates an activity</strong>
              <small>Charlotte is an AI that can create activities by analyzing the material you give it.</small>
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
              <strong><FilePenLine size={18} /> Create your own activity</strong>
              <small>Start with a blank five-question activity and write it yourself.</small>
            </span>
          </label>
        </div>
      </fieldset>

      <label>
        Activity title
        <input name="title" placeholder="Chapter 4 activity" maxLength={180} required />
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
        <>
          <section className="quiz-plan-controls" aria-label="Question plan">
            <label className="quiz-question-count-slider">
              <span>
                <strong>Number of questions</strong>
                <output>{questionCount}</output>
              </span>
              <input
                name="questionCount"
                type="range"
                min={MIN_IN_CLASS_QUESTION_COUNT}
                max={MAX_IN_CLASS_QUESTION_COUNT}
                step={1}
                value={questionCount}
                onChange={(event) => updateQuestionCount(Number(event.target.value))}
              />
              <small>{MIN_IN_CLASS_QUESTION_COUNT} minimum - {MAX_IN_CLASS_QUESTION_COUNT} maximum</small>
            </label>

            <div className="quiz-mix-slider">
              <input type="hidden" name="freeResponseCount" value={freeResponseCount} />
              <div className="quiz-mix-readout">
                <span>
                  <strong>Free response</strong>
                  <output>{freeResponseCount}</output>
                </span>
                <span>
                  <strong>Multiple choice</strong>
                  <output>{multipleChoiceCount}</output>
                </span>
              </div>
              <input
                name="multipleChoiceCount"
                type="range"
                min={0}
                max={questionCount}
                step={1}
                value={multipleChoiceCount}
                onChange={(event) => setMultipleChoiceCount(clampMultipleChoiceCount(Number(event.target.value), questionCount))}
                aria-label="Question format mix"
              />
              <div className="quiz-mix-scale" aria-hidden="true">
                <span>More free response</span>
                <span>More multiple choice</span>
              </div>
            </div>
          </section>

          <label>
            In-class source file
            <input name="sourceFile" type="file" accept=".pdf,.docx,.txt,application/pdf" required />
            <span className="help-text">Use this upload when Charlotte should create the in-class activity. PDF, DOCX, or TXT, up to 4 MB.</span>
          </label>
        </>
      )}

      <button
        className="button"
        type="submit"
        data-showcase-target={isShowcase ? "create-assignment" : undefined}
      >
        {creationMode === "ai" ? <FileUp size={18} /> : <FilePenLine size={18} />}
        {creationMode === "ai" ? "Create activity with Charlotte" : "Create blank activity"}
      </button>

      {isGenerating && (
        <div className="assignment-loading-overlay" role="status" aria-live="polite">
          <div className="assignment-loading-card">
            <div className="loading-orbit" aria-hidden="true">
              <Sparkles size={28} />
            </div>
            <span>Charlotte is building your activity</span>
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
