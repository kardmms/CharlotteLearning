"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Rocket, Star, XCircle } from "lucide-react";

type QuestionPayload = {
  termId: string;
  definition: string;
  choices: string[];
};

type IncorrectAnswer = {
  termId: string;
  definition: string;
  answer: string;
  correctAnswer: string;
};

type GamePayload = {
  status: "WAITING" | "PLAYING" | "COMPLETED";
  streak: number;
  termCount: number;
  progress?: number;
  finishRank?: number | null;
  accuracy?: number;
  totalAttempts?: number;
  totalCorrect?: number;
  starsEarned?: number;
  roomId?: string;
  incorrectAnswers?: IncorrectAnswer[];
  correct?: boolean;
  correctAnswer?: string;
  question?: QuestionPayload | null;
};

export function VocabDashPlayer({
  participantId,
  displayName,
  roomCode,
  initialStatus,
  termCount
}: {
  participantId: string;
  displayName: string;
  roomCode: string;
  initialStatus: string;
  termCount: number;
}) {
  const [payload, setPayload] = useState<GamePayload>({
    status: initialStatus === "WAITING" ? "WAITING" : "PLAYING",
    streak: 0,
    termCount
  });
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadQuestion() {
    const response = await fetch(`/api/games/vocab-dash/participants/${participantId}/question`, { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as GamePayload;
    setPayload(next);
    setSelected("");
  }

  useEffect(() => {
    void loadQuestion();
    const timer = window.setInterval(() => {
      if (payload.status === "WAITING") void loadQuestion();
    }, 2200);
    return () => window.clearInterval(timer);
  }, [participantId, payload.status]);

  async function submitAnswer(answerText: string) {
    if (!payload.question || submitting) return;
    setSelected(answerText);
    setSubmitting(true);
    const response = await fetch(`/api/games/vocab-dash/participants/${participantId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termId: payload.question.termId, answerText })
    });
    setSubmitting(false);
    if (!response.ok) {
      setFeedback("That did not submit. Try again.");
      return;
    }
    const next = await response.json() as GamePayload;
    setFeedback(next.correct ? "Correct." : "Incorrect.");
    window.setTimeout(() => {
      setFeedback("");
      setPayload(next);
      setSelected("");
    }, 750);
  }

  const progress = payload.termCount ? Math.round((payload.streak / payload.termCount) * 100) : 0;

  return (
    <main className="vocab-player-page">
      <section className="vocab-player-card">
        <div className="vocab-player-top">
          <div className="vocab-student-join-icon"><Rocket size={28} /></div>
          <div>
            <span>Vocab Dash</span>
            <h1>{displayName}</h1>
          </div>
          <div className="vocab-player-code">{roomCode}</div>
        </div>

        <div className="vocab-player-progress">
          <span>Answered: {payload.streak}/{payload.termCount}</span>
          <div><i style={{ width: `${progress}%` }} /></div>
        </div>

        {payload.status === "WAITING" && (
          <div className="vocab-player-waiting">
            <Clock3 size={34} />
            <h2>Waiting for the game to begin.</h2>
            <p>Stay on this screen. Your first word will appear when the game begins.</p>
          </div>
        )}

        {payload.status === "COMPLETED" && (
          <div className="vocab-results-panel">
            <div className="vocab-results-hero">
              <CheckCircle2 size={38} />
              <div><span>Game complete</span><h2>You finished Vocab Dash.</h2></div>
            </div>
            <div className="vocab-results-grid">
              <div><strong>{payload.totalCorrect ?? 0}/{payload.totalAttempts ?? 0}</strong><span>Correct answers</span></div>
              <div><strong>{payload.accuracy ?? 0}%</strong><span>Accuracy</span></div>
              <div><strong>#{payload.finishRank || "-"}</strong><span>Final place</span></div>
              <div className="stars"><strong>{payload.starsEarned || 0}</strong><span><Star size={15} fill="currentColor" /> Stars earned</span></div>
            </div>
            {(payload.incorrectAnswers?.length || 0) > 0 && (
              <section className="vocab-missed-list">
                <h3>Questions to review</h3>
                {payload.incorrectAnswers?.map((answer) => (
                  <article key={`${answer.termId}-${answer.answer}`}>
                    <p>{answer.definition}</p>
                    <span>Your answer: <strong>{answer.answer}</strong></span>
                    <span>Correct answer: <strong>{answer.correctAnswer}</strong></span>
                  </article>
                ))}
              </section>
            )}
            {payload.roomId && <Link className="button" href={`/student/practice/vocab/${payload.roomId}`}>More practice</Link>}
          </div>
        )}

        {payload.status === "PLAYING" && payload.question && (
          <div className="vocab-question-panel">
            <span>Choose the vocabulary word</span>
            <h2>{payload.question.definition}</h2>
            <div className="vocab-choice-grid">
              {payload.question.choices.map((choice) => (
                <button
                  className={selected === choice ? "selected" : ""}
                  key={choice}
                  type="button"
                  disabled={submitting || Boolean(feedback)}
                  onClick={() => void submitAnswer(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div className={`vocab-player-feedback ${feedback.startsWith("Correct") ? "correct" : "wrong"}`} role="status">
            {feedback.startsWith("Correct") ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {feedback}
          </div>
        )}
      </section>
    </main>
  );
}
