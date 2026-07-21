"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpenText, CheckCircle2, Clock3, Eye, PencilLine, Send, Sparkles, Star } from "lucide-react";
import { shortResponseFeedback } from "@/lib/student-feedback";

type Question = {
  id: string;
  type: string;
  prompt: string;
  choices: string[];
  skillTag?: string | null;
  standardCode?: string | null;
  explanation?: string | null;
  contextExcerpt?: string | null;
  sourcePage?: string | null;
  timeLimitSeconds?: number | null;
  correctAnswer?: string | null;
  existingAnswer: string;
  existingIsCorrect?: boolean | null;
  existingAttemptCount: number;
  existingPointsEarned: number;
  existingRevealed: boolean;
};

type QuestionResult = {
  isCorrect: boolean | null;
  attemptCount: number;
  pointsEarned: number;
  revealedAnswer: boolean;
  correctAnswer?: string | null;
  explanation?: string | null;
  locked: boolean;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function resultClass(result?: QuestionResult) {
  if (!result?.locked) return "";
  if (result.isCorrect && result.attemptCount === 1) return "first-try";
  if (result.isCorrect) return "second-try";
  if (result.isCorrect === null) return "teacher-review";
  return "missed";
}

function attemptTone(result?: QuestionResult) {
  if (!result?.attemptCount) return "";
  if (result.locked && result.isCorrect === true && result.attemptCount === 1) return "attempt-first";
  if (result.locked && result.isCorrect === true && result.attemptCount === 2) return "attempt-second";
  if (result.locked || result.attemptCount >= 3) return "attempt-third";
  return "attempt-second";
}

export function StudentStation({
  material,
  session,
  questions,
  preview = false
}: {
  material: {
    id: string;
    title: string;
    estimatedMinutes: number;
    activityKind: "IN_CLASS" | "AT_HOME";
    dueAt?: string | null;
  };
  session: { id: string; signInAt: string; pointsEarned: number; focusViolationCount: number };
  questions: Question[];
  preview?: boolean;
}) {
  const initialResults = Object.fromEntries(
    questions
      .filter((question) => question.existingAttemptCount > 0)
      .map((question) => [
        question.id,
        {
          isCorrect: question.existingIsCorrect ?? null,
          attemptCount: question.existingAttemptCount,
          pointsEarned: question.existingPointsEarned,
          revealedAnswer: question.existingRevealed,
          explanation: question.explanation,
          locked:
            question.existingIsCorrect === true ||
            question.existingRevealed ||
            (question.choices.length === 0 && Boolean(question.existingAnswer))
        } satisfies QuestionResult
      ])
  );
  const firstOpen = Math.max(
    0,
    questions.findIndex((question) => !initialResults[question.id]?.locked)
  );
  const [questionList, setQuestionList] = useState(questions);
  const [current, setCurrent] = useState(firstOpen);
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((question) => [question.id, question.existingAnswer]))
  );
  const [results, setResults] = useState<Record<string, QuestionResult>>(initialResults);
  const [points, setPoints] = useState(session.pointsEarned);
  const elapsed = Math.floor((Date.now() - new Date(session.signInAt).getTime()) / 1000);
  const [setSeconds, setSetSeconds] = useState(Math.max(0, material.estimatedMinutes * 60 - elapsed));
  const [questionSeconds, setQuestionSeconds] = useState<number | null>(
    preview ? null : questions[firstOpen]?.timeLimitSeconds || null
  );
  const [status, setStatus] = useState(
    preview ? "Preview freely — nothing here is saved or scored." : "Choose your best answer."
  );
  const [focusWarning, setFocusWarning] = useState(
    !preview && material.activityKind === "IN_CLASS" && session.focusViolationCount === 1
  );
  const [submitting, setSubmitting] = useState(false);
  const [needsContinue, setNeedsContinue] = useState<string | null>(null);
  const [responseReviewOpen, setResponseReviewOpen] = useState(false);
  const finishingRef = useRef(false);
  const extensionPromiseRef = useRef<Promise<Question[]> | null>(null);
  const extensionRetryAfterRef = useRef(0);
  const focusArmedRef = useRef(false);
  const awayRef = useRef(false);
  const question = questionList[current];

  const completedCount = useMemo(
    () => questionList.filter((item) => results[item.id]?.locked).length,
    [questionList, results]
  );
  const percent = questionList.length ? Math.round((completedCount / questionList.length) * 100) : 0;

  async function loadMoreQuestions() {
    if (preview || material.activityKind !== "AT_HOME") return [];
    if (Date.now() < extensionRetryAfterRef.current) return [];
    if (extensionPromiseRef.current) return extensionPromiseRef.current;
    extensionPromiseRef.current = (async () => {
      try {
        const response = await fetch(`/api/student/sessions/${session.id}/extend`, { method: "POST" });
        if (!response.ok) {
          extensionRetryAfterRef.current = Date.now() + 15_000;
          return [];
        }
        const payload = (await response.json()) as { questions?: Question[] };
        const added = payload.questions || [];
        if (added.length) {
          extensionRetryAfterRef.current = 0;
          setQuestionList((previous) => {
            const ids = new Set(previous.map((item) => item.id));
            return [...previous, ...added.filter((item) => !ids.has(item.id))];
          });
        }
        if (!added.length) extensionRetryAfterRef.current = Date.now() + 15_000;
        return added;
      } catch {
        extensionRetryAfterRef.current = Date.now() + 15_000;
        return [];
      } finally {
        extensionPromiseRef.current = null;
      }
    })();
    return extensionPromiseRef.current;
  }

  useEffect(() => {
    if (preview) return;
    const heartbeat = window.setInterval(() => {
      fetch(`/api/student/sessions/${session.id}/heartbeat`, { method: "POST" }).catch(() => null);
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [preview, session.id]);

  useEffect(() => {
    if (preview || material.activityKind === "AT_HOME") return;
    const armTimer = window.setTimeout(() => {
      focusArmedRef.current = true;
    }, 1200);

    async function reportFocusLoss() {
      if (!focusArmedRef.current || awayRef.current || finishingRef.current) return;
      awayRef.current = true;
      try {
        const response = await fetch(`/api/student/sessions/${session.id}/focus`, {
          method: "POST",
          keepalive: true
        });
        if (!response.ok) return;
        const result = (await response.json()) as { violationCount: number; ended: boolean };
        if (result.ended) {
          finishingRef.current = true;
          window.location.href = `/student/results/${material.id}?ended=focus`;
        } else {
          setFocusWarning(true);
        }
      } catch {
        setStatus("Your focus status could not be saved. Stay on this screen.");
      }
    }

    function handleBlur() {
      void reportFocusLoss();
    }

    function handleVisibility() {
      if (document.hidden) void reportFocusLoss();
      else window.setTimeout(() => { awayRef.current = false; }, 350);
    }

    function handleFocus() {
      window.setTimeout(() => { awayRef.current = false; }, 350);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (finishingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [material.activityKind, material.id, preview, session.id]);

  useEffect(() => {
    if (preview) return;
    const timer = window.setInterval(() => setSetSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [preview]);

  useEffect(() => {
    setQuestionSeconds(preview ? null : question.timeLimitSeconds || null);
    setResponseReviewOpen(false);
  }, [current, preview, question.timeLimitSeconds]);

  useEffect(() => {
    if (questionSeconds === null || submitting || results[question.id]?.locked) return;
    const timer = window.setInterval(
      () => setQuestionSeconds((value) => (value === null ? null : Math.max(0, value - 1))),
      1000
    );
    return () => window.clearInterval(timer);
  }, [current, question.id, questionSeconds === null, submitting, results]);

  useEffect(() => {
    if (!preview && setSeconds === 0 && !finishingRef.current) void finishSession(true);
  }, [preview, setSeconds]);

  useEffect(() => {
    if (material.activityKind === "AT_HOME" && !preview && questionList.length - current <= 4 && setSeconds > 0) {
      void loadMoreQuestions();
    }
  }, [current, material.activityKind, preview, questionList.length, setSeconds]);

  useEffect(() => {
    if (questionSeconds === 0 && !submitting && !results[question.id]?.locked) {
      void submitAnswer(true);
    }
  }, [questionSeconds]);

  async function finishSession(timeExpired = false) {
    if (finishingRef.current) return;
    if (preview) {
      setSubmitting(false);
      setStatus("Preview complete. Close this window whenever you are ready.");
      return;
    }
    finishingRef.current = true;
    setSubmitting(true);
    setStatus(timeExpired ? "Time is up. Finishing your activity..." : "Finishing your activity...");
    const response = await fetch(`/api/student/sessions/${session.id}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeExpired })
    });
    if (response.ok) {
      await response.json();
      window.location.href = `/student/results/${material.id}`;
      return;
    }
    finishingRef.current = false;
    setSubmitting(false);
    setStatus("We could not finish yet. Please try again.");
  }

  async function moveToNextQuestion() {
    if (current < questionList.length - 1) {
      setCurrent((value) => value + 1);
      setStatus("Choose your best answer.");
      setSubmitting(false);
      return;
    }
    if (material.activityKind === "AT_HOME" && setSeconds > 0) {
      setStatus("Charlotte is preparing your next question...");
      const added = await loadMoreQuestions();
      if (added.length) {
        setCurrent((value) => value + 1);
        setStatus("Choose your best answer.");
      } else {
        setStatus("More questions are still being prepared. Select continue to try again.");
        setNeedsContinue(question.id);
      }
      setSubmitting(false);
      return;
    }
    void finishSession();
  }

  async function continueAfterExplanation() {
    setNeedsContinue(null);
    setSubmitting(true);
    await moveToNextQuestion();
  }

  function waitForContinue(message: string) {
    setStatus(message);
    setNeedsContinue(question.id);
    setSubmitting(false);
  }

  async function submitAnswer(timedOut = false, confirmedWrittenSubmit = false) {
    if (submitting || results[question.id]?.locked) return;
    const answerText = answers[question.id]?.trim() || "";
    if (!answerText && !timedOut) {
      setStatus("Choose or type an answer first.");
      return;
    }
    if (!timedOut && question.choices.length === 0 && !confirmedWrittenSubmit) {
      setResponseReviewOpen(true);
      setStatus("Check your response, then submit when you are ready.");
      return;
    }

    setSubmitting(true);
    setStatus(timedOut ? "Time is up for this question." : "Checking your answer...");

    if (preview) {
      const attemptCount = (currentResult?.attemptCount || 0) + 1;
      const normalizedAnswer = answerText.toLocaleLowerCase();
      const normalizedCorrect = question.correctAnswer?.trim().toLocaleLowerCase() || "";
      const isWrittenResponse = question.choices.length === 0;
      const isCorrect = isWrittenResponse ? null : normalizedAnswer === normalizedCorrect;
      const revealedAnswer = isCorrect === false && attemptCount >= 3;
      const locked = isCorrect === true || isWrittenResponse || revealedAnswer;
      const earnedPoints = isCorrect
        ? material.activityKind === "AT_HOME"
          ? 10
          : Math.floor(100 / questionList.length) + (current + 1 <= 100 % questionList.length ? 1 : 0)
        : 0;
      const result: QuestionResult = {
        isCorrect,
        attemptCount,
        pointsEarned: earnedPoints,
        revealedAnswer,
        correctAnswer: revealedAnswer ? question.correctAnswer : null,
        explanation: locked ? question.explanation : null,
        locked
      };
      setResults((previous) => ({ ...previous, [question.id]: result }));
      if (earnedPoints) setPoints((value) => value + earnedPoints);

      if (isCorrect === true) {
        setStatus("Correct — this is how students will see the feedback.");
        waitForContinue("Correct! Select continue when you are ready.");
      } else if (isWrittenResponse) {
        setStatus("Response saved. Read the quick checklist, then continue.");
        setNeedsContinue(question.id);
        setSubmitting(false);
      } else if (revealedAnswer) {
        setStatus(`The correct answer is: ${question.correctAnswer}`);
        waitForContinue(`The correct answer is: ${question.correctAnswer}`);
      } else {
        const triesLeft = 3 - attemptCount;
        setStatus(`Not quite. ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`);
        setSubmitting(false);
      }
      return;
    }

    const response = await fetch(`/api/student/sessions/${session.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answerText, timedOut })
    });
    if (!response.ok) {
      setSubmitting(false);
      setStatus("That did not submit. Please try again.");
      return;
    }

    const result = (await response.json()) as QuestionResult & { totalPoints: number };
    setResults((previous) => ({ ...previous, [question.id]: result }));
    setPoints(result.totalPoints);

    if (result.isCorrect === true) {
      setStatus(result.attemptCount === 1 ? "Correct on the first try!" : "Correct. Nice recovery!");
      waitForContinue(result.attemptCount === 1 ? "Correct on the first try! Select continue." : "Correct. Nice recovery! Select continue.");
    } else if (result.isCorrect === null) {
      setStatus("Response saved. Read the quick checklist, then continue.");
      setNeedsContinue(question.id);
      setSubmitting(false);
    } else if (result.revealedAnswer) {
      setStatus(`The correct answer is: ${result.correctAnswer}`);
      if (material.activityKind === "AT_HOME") {
        setNeedsContinue(question.id);
        setSubmitting(false);
      } else {
        waitForContinue(`The correct answer is: ${result.correctAnswer}`);
      }
    } else {
      const triesLeft = 3 - result.attemptCount;
      setStatus(`Not quite. ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`);
      setSubmitting(false);
    }
  }

  const currentResult = results[question.id];
  const currentAnswer = answers[question.id] || "";
  const possiblePoints = material.activityKind === "AT_HOME"
    ? 10
    : Math.floor(100 / questionList.length) + (current + 1 <= 100 % questionList.length ? 1 : 0);

  return (
    <section className="station-shell">
      {focusWarning && (
        <div className="focus-warning-layer" role="alertdialog" aria-modal="true">
          <div className="focus-warning-card">
            <div className="focus-warning-icon">!</div>
            <h2>You&apos;ve left the screen.</h2>
            <p>
              This assignment will be flagged. If you leave the page again, your test will
              automatically end.
            </p>
            <button
              className="button"
              data-no-loading="true"
              type="button"
              onClick={() => {
                setFocusWarning(false);
                window.focus();
              }}
            >
              Return to assignment
            </button>
          </div>
        </div>
      )}
      {responseReviewOpen && (
        <div className="submit-review-layer" role="dialog" aria-modal="true" aria-labelledby="submit-review-title">
          <div className="submit-review-card">
            <div className="submit-review-icon">
              <BookOpenText size={26} />
            </div>
            <div>
              <h2 id="submit-review-title">Check before you submit</h2>
              <p>Read your answer one more time. You can fix it, or send it now.</p>
            </div>
            <div className="submit-review-prompt">
              <span>Question</span>
              <strong>{question.prompt}</strong>
            </div>
            <div className="submit-review-answer">
              <span>Your answer</span>
              <p>{currentAnswer}</p>
            </div>
            <div className="submit-review-checklist">
              <strong>{shortResponseFeedback.title}</strong>
              <ul>
                {shortResponseFeedback.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="submit-review-actions">
              <button
                className="ghost-button"
                data-no-loading="true"
                type="button"
                onClick={() => {
                  setResponseReviewOpen(false);
                  setStatus("Make your changes, then submit when you are ready.");
                }}
              >
                <PencilLine size={17} />
                Keep editing
              </button>
              <button
                className="button"
                data-no-loading="true"
                type="button"
                onClick={() => {
                  setResponseReviewOpen(false);
                  void submitAnswer(false, true);
                }}
              >
                Submit response
                <Send size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="station-header">
        <div className="station-title-block">
          <div className="station-mode">
            {preview ? <Eye size={16} /> : material.activityKind === "AT_HOME" ? <Sparkles size={16} /> : <Star size={16} />}
            {preview ? "Teacher preview" : material.activityKind === "AT_HOME" ? "Home learning" : "In-class activity"}
          </div>
          <h1>{material.title}</h1>
          <p>{material.activityKind === "AT_HOME" ? "Keep going until the timer ends." : `Question ${current + 1} of ${questionList.length}`}</p>
        </div>
        <div className="station-status-panel">
          <div className="timer-row">
            {preview ? (
              <span className="timer-chip"><Eye size={16} /> No time limit in preview</span>
            ) : (
              <span className={`timer-chip ${setSeconds <= 60 ? "timer-urgent" : ""}`}>
                <Clock3 size={16} /> Set {formatTime(setSeconds)}
              </span>
            )}
            {questionSeconds !== null && (
              <span className={`timer-chip ${questionSeconds <= 10 ? "timer-urgent" : ""}`}>
                Question {formatTime(questionSeconds)}
              </span>
            )}
            <span className="points-chip"><Star size={16} /> {points}{material.activityKind === "IN_CLASS" ? "/100" : ""} pts</span>
          </div>
          {material.activityKind === "IN_CLASS" && <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>}
          {material.activityKind === "IN_CLASS" && <div className="question-progress-dots" aria-label={`${completedCount} of ${questionList.length} complete`}>
            {questionList.map((item, index) => {
              const className = `${resultClass(results[item.id])} ${index === current ? "active" : ""}`;
              return preview ? (
                <button
                  aria-label={`Preview question ${index + 1}`}
                  className={className}
                  data-no-loading="true"
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrent(index);
                    setSubmitting(false);
                    setStatus("Preview freely — nothing here is saved or scored.");
                  }}
                >
                  {index + 1}
                </button>
              ) : (
                <span className={className} key={item.id}>{index + 1}</span>
              );
            })}
          </div>}
        </div>
      </div>

      <div className="station-body">
        <div className="question-surface">
          <div className="question-kicker-row">
            <span>{question.skillTag || "Close reading"}</span>
            <span>{possiblePoints} points</span>
          </div>

          {question.contextExcerpt && (
            <aside className="question-context-card">
              <div>
                <BookOpenText size={18} />
                <strong>Read this part first</strong>
                {question.sourcePage && <span>{question.sourcePage}</span>}
              </div>
              <p>{question.contextExcerpt}</p>
            </aside>
          )}

          <h2>{question.prompt}</h2>

          {question.choices.length > 0 ? (
            <div className="choice-grid">
              {question.choices.map((choice, index) => (
                <button
                  className={`choice-button ${currentAnswer === choice ? "selected" : ""}`}
                  data-no-loading="true"
                  disabled={submitting || currentResult?.locked}
                  key={choice}
                  type="button"
                  onClick={() => {
                    setAnswers((previous) => ({ ...previous, [question.id]: choice }));
                    setStatus("Ready to submit.");
                  }}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <label className="response-field">
              Your response
              <textarea
                value={currentAnswer}
                disabled={submitting || currentResult?.locked}
                onChange={(event) => setAnswers((previous) => ({
                  ...previous,
                  [question.id]: event.target.value
                }))}
                placeholder="Use evidence from what you read."
              />
            </label>
          )}

          {currentResult?.revealedAnswer && currentResult.correctAnswer && (
            <div className="answer-feedback answer-feedback-missed">
              <strong>Here&apos;s the answer</strong>
              <p>{currentResult.correctAnswer}</p>
            </div>
          )}

          {currentResult?.locked && currentResult.explanation && (
            <div className="answer-feedback answer-feedback-teaching">
              <strong>Charlotte explains</strong>
              <p>{currentResult.explanation}</p>
            </div>
          )}

          {currentResult?.locked && question.choices.length === 0 && (
            <div className="answer-feedback answer-feedback-review student-writing-feedback">
              <strong>{shortResponseFeedback.title}</strong>
              <p>{shortResponseFeedback.note}</p>
              <ul>
                {shortResponseFeedback.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          <div className="station-submit-row">
            <div>
              {material.activityKind === "IN_CLASS" && <div className={`attempt-dots ${attemptTone(currentResult)}`} aria-label={`${currentResult?.attemptCount || 0} attempts used`}>
                {[1, 2, 3].map((attempt) => (
                  <span className={attempt <= (currentResult?.attemptCount || 0) ? "used" : ""} key={attempt} />
                ))}
              </div>}
              <p className="help-text">{status}</p>
            </div>
            <button
              className="button student-submit-button"
              data-no-loading="true"
              type="button"
              disabled={submitting || (currentResult?.locked && needsContinue !== question.id)}
              onClick={() => needsContinue === question.id ? void continueAfterExplanation() : void submitAnswer()}
            >
              {needsContinue === question.id ? "Continue" : submitting ? "Checking..." : question.choices.length ? "Submit answer" : "Submit response"}
              {needsContinue === question.id ? <ArrowRight size={18} /> : material.activityKind === "IN_CLASS" && current === questionList.length - 1 ? <CheckCircle2 size={18} /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
