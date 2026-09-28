"use client";

import { useEffect, useState } from "react";
import { FilePenLine, FileUp, Send, ShieldCheck, Sparkles } from "lucide-react";
import { createMaterial, draftTopicReading, reviseTopicReading } from "@/app/teacher/actions";
import { SaveReadingPdfButton } from "@/components/SaveReadingPdfButton";

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
  gradeLevel,
  isShowcase = false
}: {
  classroomId: string;
  gradeLevel: string;
  isShowcase?: boolean;
}) {
  const [creationMode, setCreationMode] = useState<"ai" | "manual">("ai");
  const [assessmentMode, setAssessmentMode] = useState<"adaptive" | "standard">("adaptive");
  const [sourceMode, setSourceMode] = useState<"topic" | "book">("topic");
  const suggestedWords = Number(gradeLevel) <= 6 ? 250 : Number(gradeLevel) <= 7 ? 350 : Number(gradeLevel) <= 8 ? 450 : Number(gradeLevel) <= 9 ? 500 : 600;
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState<"fiction" | "nonfiction">("nonfiction");
  const [targetWords, setTargetWords] = useState(suggestedWords);
  const [focus, setFocus] = useState("");
  const [reading, setReading] = useState("");
  const [feedback, setFeedback] = useState("");
  const [readingMessages, setReadingMessages] = useState<Array<{ role: "teacher" | "charlotte"; text: string }>>([]);
  const [readingBusy, setReadingBusy] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`charlotte-reading-draft:${classroomId}`);
      if (saved) {
        const draft = JSON.parse(saved) as Record<string, unknown>;
        if (typeof draft.title === "string") setTitle(draft.title);
        if (typeof draft.topic === "string") setTopic(draft.topic);
        if (draft.genre === "fiction" || draft.genre === "nonfiction") setGenre(draft.genre);
        if (typeof draft.targetWords === "number") setTargetWords(draft.targetWords);
        if (typeof draft.focus === "string") setFocus(draft.focus);
        if (typeof draft.reading === "string") setReading(draft.reading);
        if (typeof draft.feedback === "string") setFeedback(draft.feedback);
        if (Array.isArray(draft.readingMessages)) setReadingMessages(draft.readingMessages.filter((message) =>
          message && typeof message.text === "string" && (message.role === "teacher" || message.role === "charlotte")));
      }
    } catch { /* A damaged browser draft should not block assignment creation. */ }
    setDraftRestored(true);
  }, [classroomId]);

  useEffect(() => {
    if (!draftRestored) return;
    try {
      sessionStorage.setItem(`charlotte-reading-draft:${classroomId}`, JSON.stringify({ title, topic, genre, targetWords, focus, reading, feedback, readingMessages }));
    } catch { /* Browser storage may be disabled. The current form still works. */ }
  }, [classroomId, draftRestored, title, topic, genre, targetWords, focus, reading, feedback, readingMessages]);

  function clearReading() {
    setReading("");
    setReadingMessages([]);
    setReadingError("");
  }

  async function generateReading() {
    setReadingError("");
    setReadingBusy(true);
    try {
      const result = await draftTopicReading({ classroomId, topic, genre, focus, targetWords });
      setReading(result.text);
      setReadingMessages([{ role: "teacher", text: `Write a ${genre} reading about ${topic}${focus ? `, focusing on ${focus}` : ""}.` }, { role: "charlotte", text: "Here is a draft. Read it below, edit it directly, or tell me what to change." }]);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : "Charlotte could not write the reading. Please try again.");
    } finally {
      setReadingBusy(false);
    }
  }

  async function reviseReading() {
    const request = feedback.trim();
    if (!request || !reading.trim()) return;
    setReadingError("");
    setReadingBusy(true);
    setReadingMessages((messages) => [...messages, { role: "teacher", text: request }]);
    setFeedback("");
    try {
      const result = await reviseTopicReading({ classroomId, text: reading, feedback: request, genre, targetWords });
      setReading(result.text);
      setReadingMessages((messages) => [...messages, { role: "charlotte", text: "I revised the reading using your feedback. Review the new version below." }]);
    } catch (error) {
      setReadingMessages((messages) => messages.slice(0, -1));
      setFeedback(request);
      setReadingError(error instanceof Error ? error.message : "Charlotte could not revise the reading. Please try again.");
    } finally {
      setReadingBusy(false);
    }
  }

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
      onSubmit={(event) => {
        if (creationMode === "ai" && sourceMode === "topic" && (reading.trim().length < 500 || readingBusy)) {
          event.preventDefault();
          setReadingError("Review Charlotte's reading before generating questions. Keep at least 500 characters in the final text.");
          return;
        }
        if (creationMode === "ai") {
          setGenerationStep(0);
          setIsGenerating(true);
        }
      }}
    >
      <input type="hidden" name="classroomId" value={classroomId} />
      {creationMode === "ai" && sourceMode === "topic" && <input type="hidden" name="approvedReading" value={reading} />}

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
        <input name="title" placeholder="Chapter 4 activity" maxLength={180} required value={title} onChange={(event) => setTitle(event.target.value)} />
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

      {(creationMode === "manual" || sourceMode === "book") && <label>
        Reading limit for generated questions
        <input name="readingScope" placeholder="Example: Chapters 1-2 or pages 1-8" />
        <span className="help-text">Charlotte uses only this section for in-class questions and at-home follow-up. For unusual chapter layouts, use exact PDF pages.</span>
      </label>}

      {creationMode === "ai" && (
        <>
          <fieldset className="creation-mode-fieldset">
            <legend>Where should the reading come from?</legend>
            <div className="choice-card-grid">
              <label className={`choice-card ${sourceMode === "topic" ? "selected" : ""}`}>
                <input name="sourceMode" type="radio" value="topic" checked={sourceMode === "topic"} onChange={() => setSourceMode("topic")} />
                <span><strong>Charlotte writes a reading</strong><small>Enter a topic and choose fiction or nonfiction.</small></span>
              </label>
              <label className={`choice-card ${sourceMode === "book" ? "selected" : ""}`}>
                <input name="sourceMode" type="radio" value="book" checked={sourceMode === "book"} onChange={() => setSourceMode("book")} />
                <span><strong>Upload a book or reading</strong><small>Generate questions from the chapters or pages you assign.</small></span>
              </label>
            </div>
          </fieldset>
          {sourceMode === "topic" && <>
            <label>Topic<input name="topic" placeholder="Example: Medieval Europe" maxLength={160} required value={topic} onChange={(event) => { setTopic(event.target.value); clearReading(); }} /></label>
            <div className="grid two">
              <label>Reading style<select name="genre" value={genre} onChange={(event) => { setGenre(event.target.value as "fiction" | "nonfiction"); clearReading(); }}><option value="nonfiction">Nonfiction article</option><option value="fiction">Fiction story</option></select></label>
              <label>Reading length<select name="targetWords" value={targetWords} onChange={(event) => { setTargetWords(Number(event.target.value)); clearReading(); }}>{[250, 350, 450, 500, 600, 750].filter((count) => count <= (Number(gradeLevel) <= 6 ? 350 : Number(gradeLevel) <= 8 ? 500 : Number(gradeLevel) <= 9 ? 600 : 750)).map((count) => <option key={count} value={count}>About {count} words</option>)}</select></label>
            </div>
            <label>Optional focus<input name="topicFocus" placeholder="Example: markets, crafts, and daily life" maxLength={240} value={focus} onChange={(event) => { setFocus(event.target.value); clearReading(); }} /></label>
            <section className="reading-draft-workspace" aria-label="Review Charlotte's reading">
              <div className="reading-draft-heading">
                <div><span className="eyebrow">Step 1 · Reading</span><h2>Write it with Charlotte</h2><p>Review the full text before Charlotte creates questions. You can edit it or ask for a rewrite.</p></div>
                {reading && <SaveReadingPdfButton text={reading} />}
              </div>
              <div className="reading-chat" aria-live="polite">
                {readingMessages.length ? readingMessages.map((message, index) => (
                  <div className={`reading-chat-message ${message.role}`} key={`${message.role}-${index}`}>
                    <strong>{message.role === "teacher" ? "You" : "Charlotte"}</strong>
                    <p>{message.text}</p>
                  </div>
                )) : <div className="reading-chat-message charlotte"><strong>Charlotte</strong><p>Tell me the topic above, then I’ll write a reading for your class.</p></div>}
              </div>
              {!reading && <button className="button" type="button" onClick={generateReading} disabled={readingBusy || topic.trim().length < 3}><Sparkles size={18} /> {readingBusy ? "Writing reading…" : "Generate reading"}</button>}
              {reading && <>
                <label className="reading-text-label">Full reading · editable
                  <textarea value={reading} onChange={(event) => setReading(event.target.value)} rows={17} maxLength={12000} aria-label="Full reading" />
                </label>
                <label>Tell Charlotte what to change
                  <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} maxLength={1200} placeholder="Make the ending more surprising, use simpler words, and add a paragraph about market stalls…" aria-label="Tell Charlotte what to change" />
                </label>
                <div className="reading-draft-actions"><button className="ghost-button" type="button" onClick={reviseReading} disabled={readingBusy || feedback.trim().length < 4}><Send size={17} /> {readingBusy ? "Revising…" : "Send feedback"}</button><span>Charlotte will revise the reading. Questions will use only the version you approve.</span></div>
              </>}
              {readingError && <p className="form-error" role="alert">{readingError}</p>}
            </section>
          </>}
          <fieldset className="creation-mode-fieldset">
            <legend>Step 2 · Question plan</legend>
            <div className="choice-card-grid">
              <label className={`choice-card ${assessmentMode === "adaptive" ? "selected" : ""}`}>
                <input name="assessmentMode" type="radio" value="adaptive" checked={assessmentMode === "adaptive"} onChange={() => setAssessmentMode("adaptive")} />
                <span><strong>Five adaptive tests</strong><small>Five difficulty levels. Each has two questions in Understanding, Evidence, Thinking deeper, Language, and Written analysis. Students begin at level 3 in every category.</small></span>
              </label>
              <label className={`choice-card ${assessmentMode === "standard" ? "selected" : ""}`}>
                <input name="assessmentMode" type="radio" value="standard" checked={assessmentMode === "standard"} onChange={() => setAssessmentMode("standard")} />
                <span><strong>One shared question set</strong><small>Charlotte creates 8–9 questions for everyone in the class.</small></span>
              </label>
            </div>
          </fieldset>
          <p className="help-text">Review and edit every question before publishing. Adaptive tests generate 50 draft questions; each student receives 10 based on their category ranks.</p>

          {sourceMode === "book" && <label>
            In-class source file
            <input name="sourceFile" type="file" accept=".pdf,.docx,.txt,application/pdf" required />
            <span className="help-text">Use this upload when Charlotte should create the in-class activity. PDF, DOCX, or TXT, up to 4 MB.</span>
          </label>}
        </>
      )}

      <button
        className="button"
        type="submit"
        disabled={creationMode === "ai" && sourceMode === "topic" && (reading.trim().length < 500 || readingBusy)}
        data-showcase-target={isShowcase ? "create-assignment" : undefined}
      >
        {creationMode === "ai" ? <FileUp size={18} /> : <FilePenLine size={18} />}
        {creationMode === "ai" && sourceMode === "topic" ? "Approve reading & generate questions" : creationMode === "ai" ? "Create activity with Charlotte" : "Create blank activity"}
      </button>

      {isGenerating && (
        <div className="assignment-loading-overlay" role="status" aria-live="polite">
          <div className="assignment-loading-card">
            <div className="loading-orbit" aria-hidden="true">
              <Sparkles size={28} />
            </div>
            <span>Charlotte is building your activity</span>
            <h2>{generationSteps[generationStep]}</h2>
            <p>{assessmentMode === "adaptive" ? "Charlotte is building 50 questions across five tests. You’ll review each difficulty before publishing." : "You’ll land on an editable draft as soon as the questions are ready."}</p>
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
