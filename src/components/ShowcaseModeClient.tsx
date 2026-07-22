"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  FileUp,
  GraduationCap,
  LineChart,
  Loader2,
  Play,
  Save,
  Sheet,
  Sparkles,
  UserRound,
  UsersRound
} from "lucide-react";
import { StudentStation } from "@/components/StudentStation";
import {
  showcaseGradingMessages,
  showcaseQuestions,
  showcaseSimulationMessages,
  showcaseSteps,
  showcaseStudents,
  type ShowcaseQuestion,
  type ShowcaseStudent
} from "@/lib/showcase-data";

type ShowcaseAssignment = {
  id: string;
  title: string;
  notes: string;
  status: "DRAFT" | "PUBLISHED";
  questions: ShowcaseQuestion[];
  sourceName?: string;
  multipleChoiceOnly?: boolean;
};

type SimulatedAnswer = {
  questionId: string;
  answerText: string;
  isCorrect: boolean | null;
  pointsEarned: number;
  attemptCount: number;
  quality: "spot-on" | "solid" | "vague" | "incorrect" | "blank";
};

type SimulatedSession = {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  status: "COMPLETED" | "PARTIAL";
  answers: SimulatedAnswer[];
  score: number;
  completedAt: string;
};

type ShowcaseView = "setup" | "assignment" | "student" | "results" | "grading" | "followup" | "improvements";

const showcaseNavItems = [
  { target: "setup", label: "Classes", Icon: UsersRound },
  { target: "assignment", label: "Assignments", Icon: ClipboardList },
  { target: "student", label: "Student view", Icon: GraduationCap },
  { target: "results", label: "Stats", Icon: BarChart3 },
  { target: "grading", label: "Free response", Icon: BookOpenText },
  { target: "improvements", label: "Improvements", Icon: LineChart }
] satisfies Array<{
  target: ShowcaseView;
  label: string;
  Icon: typeof UsersRound;
}>;

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function possiblePoints(questionCount: number) {
  return Math.floor(100 / Math.max(1, questionCount));
}

function gradeAnswer(answer: SimulatedAnswer, maxPoints: number) {
  if (answer.quality === "spot-on") return maxPoints;
  if (answer.quality === "solid") return Math.round(maxPoints * 0.82);
  if (answer.quality === "vague") return Math.round(maxPoints * 0.45);
  return 0;
}

function metricSnapshot(sessions: SimulatedSession[], questions: ShowcaseQuestion[]) {
  const total = sessions.length;
  const finished = sessions.filter((session) => session.status === "COMPLETED").length;
  const eightyPlus = sessions.filter((session) => session.score >= 80).length;
  const average = total ? Math.round(sessions.reduce((sum, session) => sum + session.score, 0) / total) : 0;
  const gradedAnswers = sessions.flatMap((session) =>
    session.answers.filter((answer) => answer.isCorrect !== null)
  );
  const firstTry = gradedAnswers.filter((answer) => answer.isCorrect === true && answer.attemptCount <= 1).length;
  const pendingFreeResponses = sessions.flatMap((session) =>
    session.answers.filter((answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      return question?.choices.length === 0 && answer.isCorrect === null && answer.answerText !== "No response";
    })
  ).length;
  return {
    finished,
    completionRate: percent(finished, total),
    eightyPlus,
    eightyPlusRate: percent(eightyPlus, total),
    average,
    firstTryRate: percent(firstTry, gradedAnswers.length),
    pendingFreeResponses
  };
}

function GlowWrap({
  active,
  children,
  className = ""
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${className} ${active ? "showcase-glow" : ""}`}>{children}</div>;
}

function FloatingGuide({
  completed,
  activeIndex
}: {
  completed: boolean[];
  activeIndex: number;
}) {
  return (
    <aside className="showcase-guide" aria-label="Showcase steps">
      <div>
        <Sparkles size={17} />
        <strong>Showcase steps</strong>
      </div>
      <ol>
        {showcaseSteps.map((step, index) => (
          <li
            className={`${completed[index] ? "done" : ""} ${index === activeIndex ? "active" : ""}`}
            key={step}
          >
            <span>{completed[index] ? <CheckCircle2 size={14} /> : index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function BusyOverlay({
  title,
  note,
  messages,
  index
}: {
  title: string;
  note?: string;
  messages: string[];
  index: number;
}) {
  return (
    <div className="showcase-busy-layer" role="status" aria-live="polite">
      <div className="assignment-loading-card showcase-busy-card">
        <div className="loading-orbit" aria-hidden="true">
          <Loader2 size={28} />
        </div>
        <span>{title}</span>
        <h2>{messages[index % messages.length]}</h2>
        {note && <p>{note}</p>}
        <div className="loading-step-list" aria-hidden="true">
          {messages.slice(0, 4).map((message, messageIndex) => (
            <i className={messageIndex <= index % messages.length ? "active" : ""} key={message} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StudentPreview({ assignment }: { assignment: ShowcaseAssignment }) {
  return (
    <div className="showcase-student-preview">
      <StudentStation
        preview
        material={{
          id: assignment.id,
          title: assignment.title,
          estimatedMinutes: 15,
          activityKind: "IN_CLASS"
        }}
        session={{
          id: "showcase-preview-session",
          signInAt: new Date().toISOString(),
          pointsEarned: 0,
          focusViolationCount: 0
        }}
        questions={assignment.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          choices: question.choices,
          correctAnswer: question.correctAnswer,
          skillTag: question.skillTag,
          standardCode: question.standardCode,
          explanation: question.explanation,
          contextExcerpt: question.contextExcerpt,
          sourcePage: question.sourcePage,
          timeLimitSeconds: null,
          existingAnswer: "",
          existingAttemptCount: 0,
          existingPointsEarned: 0,
          existingRevealed: false
        }))}
      />
    </div>
  );
}

export function ShowcaseModeClient() {
  const [view, setView] = useState<ShowcaseView>("setup");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("3");
  const [classCreated, setClassCreated] = useState(false);
  const [students, setStudents] = useState<ShowcaseStudent[]>([]);
  const [rosterFileName, setRosterFileName] = useState("");
  const [rosterBusy, setRosterBusy] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [followUpSourceFile, setFollowUpSourceFile] = useState<File | null>(null);
  const [assignment, setAssignment] = useState<ShowcaseAssignment | null>(null);
  const [followUpAssignment, setFollowUpAssignment] = useState<ShowcaseAssignment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [simulationBusy, setSimulationBusy] = useState(false);
  const [simulationMessageIndex, setSimulationMessageIndex] = useState(0);
  const [gradingBusy, setGradingBusy] = useState(false);
  const [gradingMessageIndex, setGradingMessageIndex] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [sessions, setSessions] = useState<SimulatedSession[]>([]);
  const [followUpSessions, setFollowUpSessions] = useState<SimulatedSession[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const currentAssignment = followUpAssignment && view === "followup" ? followUpAssignment : assignment;
  const completed = [
    classCreated,
    students.length > 0,
    Boolean(assignment),
    assignment?.status === "PUBLISHED",
    sessions.length > 0,
    view === "results" || view === "grading" || view === "followup" || view === "improvements",
    sessions.length > 0 && metricSnapshot(sessions, assignment?.questions || []).pendingFreeResponses === 0,
    Boolean(followUpAssignment),
    followUpSessions.length > 0,
    view === "improvements"
  ];
  const activeIndex = Math.max(0, completed.findIndex((item) => !item));
  const metrics = metricSnapshot(sessions, assignment?.questions || []);
  const followUpMetrics = metricSnapshot(followUpSessions, followUpAssignment?.questions || []);
  const selectedSession = sessions.find((session) => session.studentId === selectedStudentId) || sessions[0];

  const choiceSummaries = useMemo(() => {
    if (!assignment) return [];
    return assignment.questions.map((question) => {
      const counts = question.choices.map((choice) => ({
        choice,
        count: sessions.filter((session) =>
          session.answers.find((answer) => answer.questionId === question.id)?.answerText === choice
        ).length
      }));
      const writtenCount = sessions.filter((session) =>
        session.answers.find((answer) => answer.questionId === question.id)?.answerText !== "No response"
      ).length;
      return { question, counts, writtenCount };
    });
  }, [assignment, sessions]);

  function createClass() {
    setClassCreated(true);
    setClassName(className.trim() || "3rd Grade Showcase Class");
  }

  async function importRoster(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRosterBusy(true);
    const formData = new FormData();
    formData.set("studentFile", file);
    const response = await fetch("/api/showcase/roster", { method: "POST", body: formData });
    const payload = await response.json() as { fileName: string; rows: ShowcaseStudent[] };
    setStudents(payload.rows.map((row, index) => ({
      id: row.id || `student-${index + 1}`,
      displayName: row.displayName,
      email: row.email
    })));
    setRosterFileName(payload.fileName);
    setRosterBusy(false);
  }

  async function generateAssignment(multipleChoiceOnly = false) {
    setGenerating(true);
    const formData = new FormData();
    formData.set("title", multipleChoiceOnly ? "Evidence Follow-up Check" : "Tide Pool Reading Activity");
    formData.set("gradeLevel", gradeLevel);
    if (multipleChoiceOnly) formData.set("multipleChoiceOnly", "true");
    const file = multipleChoiceOnly ? followUpSourceFile : sourceFile;
    if (file) formData.set("sourceFile", file);
    const response = await fetch("/api/showcase/generate-assignment", {
      method: "POST",
      body: formData
    });
    const payload = await response.json() as {
      title: string;
      notes: string;
      sourceName?: string;
      questions: ShowcaseQuestion[];
    };
    const nextAssignment: ShowcaseAssignment = {
      id: multipleChoiceOnly ? "showcase-follow-up" : "showcase-assignment",
      title: payload.title,
      notes: payload.notes,
      sourceName: payload.sourceName,
      status: "DRAFT",
      multipleChoiceOnly,
      questions: payload.questions.length ? payload.questions : showcaseQuestions
    };
    if (multipleChoiceOnly) {
      setFollowUpAssignment(nextAssignment);
      setView("followup");
    } else {
      setAssignment(nextAssignment);
      setView("assignment");
    }
    setGenerating(false);
  }

  function publishCurrentAssignment() {
    if (!assignment) return;
    setAssignment({ ...assignment, status: "PUBLISHED" });
    setView("student");
  }

  function publishFollowUpAssignment() {
    if (!followUpAssignment) return;
    setFollowUpAssignment({ ...followUpAssignment, status: "PUBLISHED" });
  }

  async function runSimulation(improvementRun = false) {
    const simulatedAssignment = improvementRun ? followUpAssignment : assignment;
    if (!simulatedAssignment) return;
    setSimulationBusy(true);
    setSimulationMessageIndex(0);
    const timer = window.setInterval(() => {
      setSimulationMessageIndex((current) => current + 1);
    }, 1600);
    await new Promise((resolve) => window.setTimeout(resolve, 7200));
    const response = await fetch("/api/showcase/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        students,
        questions: simulatedAssignment.questions,
        gradeLevel,
        improvementRun
      })
    });
    const payload = await response.json() as { sessions: SimulatedSession[] };
    window.clearInterval(timer);
    if (improvementRun) {
      setFollowUpSessions(payload.sessions);
      setView("improvements");
    } else {
      setSessions(payload.sessions);
      setSelectedStudentId(payload.sessions[0]?.studentId || "");
      setView("results");
    }
    setSimulationBusy(false);
  }

  async function gradeWithAi() {
    if (!assignment) return;
    setGradingBusy(true);
    setGradingMessageIndex(0);
    const timer = window.setInterval(() => setGradingMessageIndex((current) => current + 1), 1600);
    await new Promise((resolve) => window.setTimeout(resolve, 5600));
    window.clearInterval(timer);
    const maxPoints = possiblePoints(assignment.questions.length);
    setSessions((previous) => previous.map((session) => {
      const answers = session.answers.map((answer) => {
        const question = assignment.questions.find((item) => item.id === answer.questionId);
        if (!question || question.choices.length > 0 || answer.isCorrect !== null) return answer;
        const pointsEarned = gradeAnswer(answer, maxPoints);
        return {
          ...answer,
          pointsEarned,
          isCorrect: pointsEarned >= Math.round(maxPoints * 0.75)
        };
      });
      return {
        ...session,
        answers,
        score: Math.min(100, answers.reduce((sum, answer) => sum + answer.pointsEarned, 0))
      };
    }));
    setGradingBusy(false);
    setView("followup");
  }

  function gradeOne(sessionId: string, questionId: string, pointsEarned: number) {
    if (!assignment) return;
    setSessions((previous) => previous.map((session) => {
      if (session.id !== sessionId) return session;
      const answers = session.answers.map((answer) =>
        answer.questionId === questionId
          ? { ...answer, pointsEarned, isCorrect: pointsEarned >= possiblePoints(assignment.questions.length) * 0.75 }
          : answer
      );
      return {
        ...session,
        answers,
        score: Math.min(100, answers.reduce((sum, answer) => sum + answer.pointsEarned, 0))
      };
    }));
  }

  return (
    <>
      {simulationBusy && (
        <BusyOverlay
          title="Running student simulation"
          messages={showcaseSimulationMessages}
          index={simulationMessageIndex}
        />
      )}
      {gradingBusy && (
        <BusyOverlay
          title="Grading"
          note="Note: this is only for the sake of the demonstration. Free response grading is done manually in the real application."
          messages={showcaseGradingMessages}
          index={gradingMessageIndex}
        />
      )}

      <FloatingGuide completed={completed} activeIndex={activeIndex} />

      <header className="topbar teacher-topbar showcase-topbar">
        <a className="brand" href="/showcase">
          <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte AI</span>
        </a>
        <nav className="teacher-topbar-nav" aria-label="Showcase navigation">
          {showcaseNavItems.map(({ target, label, Icon }) => (
            <button
              className={view === target ? "active" : ""}
              data-no-loading="true"
              key={target}
              type="button"
              onClick={() => setView(target)}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <span className="status-pill status-blue">Showcase mode</span>
      </header>

      <main className="showcase-page">
        <section className="workspace-heading showcase-heading">
          <div>
            <div className="eyebrow">Local demo workspace</div>
            <h1>Showcase Mode</h1>
            <p>
              A guided classroom simulation for teachers and investors. No real student data is
              saved, and the full showcase stays off production until you are ready.
            </p>
          </div>
        </section>

        {view === "setup" && (
          <section className="grid two showcase-section-grid">
            <GlowWrap active={activeIndex === 0} className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Step 1</div>
                  <h2>Create a class</h2>
                  <p>Same first action a real teacher takes before adding students.</p>
                </div>
                <UsersRound color="#2563EB" />
              </div>
              <div className="form-grid">
                <label>
                  Class name
                  <input
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="3rd Grade Showcase Class"
                  />
                </label>
                <label>
                  Grade level
                  <select value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)}>
                    {["K", "1", "2", "3", "4", "5", "6", "7", "8"].map((grade) => (
                      <option key={grade} value={grade}>{grade === "K" ? "Kindergarten" : `Grade ${grade}`}</option>
                    ))}
                  </select>
                </label>
                <button className="button" data-no-loading="true" type="button" onClick={createClass}>
                  <Save size={18} />
                  Create showcase class
                </button>
              </div>
            </GlowWrap>

            <GlowWrap active={activeIndex === 1} className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Step 2</div>
                  <h2>Import students</h2>
                  <p>Use the intentionally messy roster to show Charlotte cleaning it up.</p>
                </div>
                <Sheet color="#14B8A6" />
              </div>
              <div className="form-grid">
                <a className="ghost-button" href="/showcase/charlotte-showcase-roster.csv" download>
                  <Sheet size={18} />
                  Download messy roster
                </a>
                <label>
                  Student spreadsheet
                  <input
                    type="file"
                    accept=".csv,.tsv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={!classCreated || rosterBusy}
                    onChange={importRoster}
                  />
                </label>
                {rosterBusy && <p className="form-note">Charlotte is reading the spreadsheet and finding the student rows...</p>}
                {rosterFileName && <p className="form-note">Imported from {rosterFileName}</p>}
              </div>
            </GlowWrap>

            {students.length > 0 && (
              <section className="panel showcase-roster-panel">
                <div className="panel-header">
                  <div>
                    <h2>Charlotte found {students.length} students</h2>
                    <p>Review before adding, just like the real roster workflow.</p>
                  </div>
                  <CheckCircle2 color="#22C55E" />
                </div>
                <div className="student-entry-fields spreadsheet-review-fields">
                  <div className="student-entry-head" aria-hidden="true">
                    <span>Student name</span>
                    <span>Student email</span>
                  </div>
                  {students.map((student) => (
                    <div className="student-entry-row" key={student.id}>
                      <label>
                        <span>Student name</span>
                        <input
                          value={student.displayName}
                          onChange={(event) => setStudents((previous) => previous.map((row) =>
                            row.id === student.id ? { ...row, displayName: event.target.value } : row
                          ))}
                        />
                      </label>
                      <label>
                        <span>Student email</span>
                        <input
                          value={student.email}
                          onChange={(event) => setStudents((previous) => previous.map((row) =>
                            row.id === student.id ? { ...row, email: event.target.value } : row
                          ))}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <button className="button" data-no-loading="true" type="button" onClick={() => setView("assignment")}>
                  Confirm students
                  <ArrowRight size={18} />
                </button>
              </section>
            )}
          </section>
        )}

        {view === "assignment" && (
          <section className="grid two showcase-section-grid">
            <GlowWrap active={activeIndex === 2} className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Step 3</div>
                  <h2>Create the AI assignment</h2>
                  <p>Upload any classroom reading, or skip the file to use the showcase reading.</p>
                </div>
                <FileUp color="#2563EB" />
              </div>
              <div className="form-grid">
                <label>
                  In-class source file
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf"
                    onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                  />
                  <span className="help-text">PDF, DOCX, or TXT. If the upload cannot be read, Charlotte uses the demo reading.</span>
                </label>
                <button className="button" data-no-loading="true" disabled={generating || !students.length} type="button" onClick={() => void generateAssignment(false)}>
                  <Sparkles size={18} />
                  {generating ? "Charlotte is generating..." : "Create draft with Charlotte"}
                </button>
              </div>
            </GlowWrap>

            {assignment && (
              <GlowWrap active={activeIndex === 3} className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Editable draft</div>
                    <h2>{assignment.title}</h2>
                    <p>{assignment.notes}</p>
                  </div>
                  <span className={`status-pill ${assignment.status === "PUBLISHED" ? "status-green" : "status-yellow"}`}>
                    {assignment.status.toLowerCase()}
                  </span>
                </div>
                <div className="form-question-stack showcase-question-stack">
                  {assignment.questions.map((question, index) => (
                    <article className="question-editor" key={question.id}>
                      <div className="question-editor-head">
                        <span>Question {index + 1}</span>
                        <strong>{question.choices.length ? "Multiple choice" : "Free response"}</strong>
                      </div>
                      <h3>{question.prompt}</h3>
                      {question.contextExcerpt && <p>{question.contextExcerpt}</p>}
                      {question.choices.length > 0 && (
                        <div className="showcase-choice-list">
                          {question.choices.map((choice) => (
                            <span className={choice === question.correctAnswer ? "correct" : ""} key={choice}>
                              {choice}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <button className="button" data-no-loading="true" type="button" onClick={publishCurrentAssignment}>
                  <CheckCircle2 size={18} />
                  Publish
                </button>
              </GlowWrap>
            )}
          </section>
        )}

        {view === "student" && assignment && (
          <section className="grid two showcase-section-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Student side</div>
                  <h2>Preview the station</h2>
                  <p>This uses Charlotte&apos;s real student station component in preview mode.</p>
                </div>
                <GraduationCap color="#2563EB" />
              </div>
              <StudentPreview assignment={assignment} />
            </section>
            <GlowWrap active={activeIndex === 4} className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Step 5</div>
                  <h2>Run simulation</h2>
                  <p>Each student gets a different outcome: strong, average, struggling, partial, and incorrect.</p>
                </div>
                <Play color="#14B8A6" />
              </div>
              <button className="button" data-no-loading="true" type="button" onClick={() => void runSimulation(false)}>
                <Play size={18} />
                Run Simulation
              </button>
            </GlowWrap>
          </section>
        )}

        {view === "results" && assignment && (
          <section className="responses-dashboard">
            <GlowWrap active={activeIndex === 5} className="response-summary-grid">
              <MetricTile label="Completion" value={`${metrics.completionRate}%`} detail={`${metrics.finished} students finished`} />
              <MetricTile label="Class average" value={`${metrics.average}%`} detail="Auto-graded questions so far" />
              <MetricTile label="80%+ scores" value={metrics.eightyPlus} detail="Students at or above goal" />
              <MetricTile label="Needs grading" value={metrics.pendingFreeResponses} detail="Written responses pending" />
            </GlowWrap>

            <section className="form-response-card response-questions-section">
              <div className="panel-header">
                <div>
                  <h2>Response summary</h2>
                  <p>Start broad, then open individual work like a real teacher would.</p>
                </div>
                <button className="button" data-no-loading="true" type="button" onClick={() => setView("grading")}>
                  View free responses
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="response-question-list">
                {choiceSummaries.map(({ question, counts, writtenCount }, index) => (
                  <article className="response-question-card" key={question.id}>
                    <div className="response-question-heading">
                      <span>Question {index + 1}</span>
                      <h3>{question.prompt}</h3>
                    </div>
                    {question.choices.length ? (
                      <div className="answer-bar-chart">
                        {counts.map((item) => (
                          <div key={item.choice}>
                            <span>{item.choice}</span>
                            <div className="bar">
                              <span style={{ width: `${percent(item.count, sessions.length)}%` }} />
                            </div>
                            <strong>{item.count}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="free-response-summary">
                        <p>{writtenCount} written responses · {metrics.pendingFreeResponses} still need grading</p>
                        <button className="ghost-button" data-no-loading="true" type="button" onClick={() => setView("grading")}>
                          View individual responses
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {selectedSession && (
              <section className="panel individual-response-workspace showcase-individual-panel">
                <div className="individual-response-toolbar">
                  <div>
                    <strong>Closer overview</strong>
                    <span>Pick a student to inspect their submitted work.</span>
                  </div>
                  <select value={selectedSession.studentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.studentId}>{session.studentName}</option>
                    ))}
                  </select>
                </div>
                <article className="individual-respondent-card">
                  <div className="individual-respondent-heading">
                    <span><UserRound size={20} /></span>
                    <div>
                      <small>Respondent</small>
                      <h2>{selectedSession.studentName}</h2>
                      <p>{selectedSession.email}</p>
                    </div>
                  </div>
                  <div className="individual-response-score">
                    <strong>{selectedSession.score}/100</strong>
                    <span>points</span>
                  </div>
                </article>
              </section>
            )}
          </section>
        )}

        {view === "grading" && assignment && (
          <GlowWrap active={activeIndex === 6} className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Free response grading</div>
                <h2>Grade written responses</h2>
                <p>Teachers can grade manually in the real app. The AI button exists here only to speed up the demo story.</p>
              </div>
              <BookOpenText color="#2563EB" />
            </div>
            <div className="actions">
              <button className="ghost-button" data-no-loading="true" type="button" onClick={() => setManualMode((value) => !value)}>
                Grade all on my own
              </button>
              <button className="button" data-no-loading="true" type="button" onClick={() => void gradeWithAi()}>
                <Sparkles size={18} />
                Let AI finish grading for showcase
              </button>
            </div>
            <div className="individual-answer-list">
              {sessions.flatMap((session) =>
                session.answers
                  .filter((answer) => assignment.questions.find((question) => question.id === answer.questionId)?.choices.length === 0)
                  .map((answer) => {
                    const question = assignment.questions.find((item) => item.id === answer.questionId);
                    const maxPoints = possiblePoints(assignment.questions.length);
                    return (
                      <article className="individual-answer-card" key={`${session.id}-${answer.questionId}`}>
                        <div className="individual-answer-heading">
                          <div>
                            <span>{session.studentName}</span>
                            <h3>{question?.prompt}</h3>
                          </div>
                          <strong>{answer.pointsEarned} / {maxPoints}</strong>
                        </div>
                        <div className={`individual-answer-value ${answer.answerText === "No response" ? "unanswered" : ""}`}>
                          <span>Student answer</span>
                          <p>{answer.answerText}</p>
                        </div>
                        {manualMode && (
                          <div className="showcase-grade-buttons">
                            {[0, Math.round(maxPoints * 0.5), maxPoints].map((points) => (
                              <button
                                className="ghost-button"
                                data-no-loading="true"
                                key={points}
                                type="button"
                                onClick={() => gradeOne(session.id, answer.questionId, points)}
                              >
                                {points} pts
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })
              )}
            </div>
          </GlowWrap>
        )}

        {view === "followup" && (
          <section className="grid two showcase-section-grid">
            <GlowWrap active={activeIndex === 7} className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Follow-up quiz</div>
                  <h2>Generate a multiple-choice quiz</h2>
                  <p>For the showcase, guide the teacher to publish a quick check with only multiple-choice questions.</p>
                </div>
                <Sparkles color="#2563EB" />
              </div>
              <div className="form-grid">
                <label>
                  Optional source file
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf"
                    onChange={(event) => setFollowUpSourceFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button className="button" data-no-loading="true" disabled={generating} type="button" onClick={() => void generateAssignment(true)}>
                  Create multiple-choice follow-up
                </button>
              </div>
            </GlowWrap>

            {followUpAssignment && (
              <GlowWrap active={activeIndex === 8} className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Draft ready</div>
                    <h2>{followUpAssignment.title}</h2>
                    <p>{followUpAssignment.questions.length} multiple-choice questions</p>
                  </div>
                  <span className={`status-pill ${followUpAssignment.status === "PUBLISHED" ? "status-green" : "status-yellow"}`}>
                    {followUpAssignment.status.toLowerCase()}
                  </span>
                </div>
                <div className="actions">
                  <button className="ghost-button" data-no-loading="true" type="button" onClick={publishFollowUpAssignment}>
                    Publish follow-up
                  </button>
                  <button
                    className="button"
                    data-no-loading="true"
                    disabled={followUpAssignment.status !== "PUBLISHED"}
                    type="button"
                    onClick={() => void runSimulation(true)}
                  >
                    <Play size={18} />
                    Run Simulation
                  </button>
                </div>
              </GlowWrap>
            )}
          </section>
        )}

        {view === "improvements" && (
          <GlowWrap active={activeIndex === 9} className="panel weekly-improvement-panel">
            <div className="weekly-improvement-heading">
              <div>
                <div className="eyebrow">Assignment improvement</div>
                <h2>This assignment vs last assignment</h2>
                <p>Simple bars students and investors can understand from across the room.</p>
              </div>
              <div className="weekly-legend">
                <span><i className="current" /> This assignment</span>
                <span><i className="previous" /> Last assignment</span>
              </div>
            </div>
            <div className="showcase-improvement-bars">
              {[
                ["Finished all", followUpMetrics.completionRate, metrics.completionRate],
                ["80%+ scores", followUpMetrics.eightyPlusRate, metrics.eightyPlusRate],
                ["Average", followUpMetrics.average, metrics.average],
                ["First try", followUpMetrics.firstTryRate, metrics.firstTryRate]
              ].map(([label, current, previous]) => (
                <div className="showcase-improvement-row" key={String(label)}>
                  <strong>{label}</strong>
                  <div>
                    <span style={{ width: `${current}%` }}><b>{current}%</b></span>
                    <span className="previous" style={{ width: `${previous}%` }}><b>{previous}%</b></span>
                  </div>
                </div>
              ))}
            </div>
          </GlowWrap>
        )}
      </main>
    </>
  );
}
