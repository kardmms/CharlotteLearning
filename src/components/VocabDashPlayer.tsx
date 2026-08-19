"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Rocket, XCircle } from "lucide-react";

type QuestionPayload = {
  termId: string;
  word: string;
  choices: string[];
};

type GamePayload = {
  status: "WAITING" | "PLAYING" | "COMPLETED";
  streak: number;
  termCount: number;
  progress?: number;
  finishRank?: number | null;
  accuracy?: number;
  correct?: boolean;
  correctDefinition?: string;
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
    setFeedback(next.correct ? "Correct. Keep the streak going." : `Not quite. The right definition was: ${next.correctDefinition}`);
    window.setTimeout(() => {
      setFeedback("");
      setPayload(next);
      setSelected("");
    }, next.correct ? 650 : 1300);
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
          <span>Streak: {payload.streak}/{payload.termCount}</span>
          <div><i style={{ width: `${progress}%` }} /></div>
        </div>

        {payload.status === "WAITING" && (
          <div className="vocab-player-waiting">
            <Clock3 size={34} />
            <h2>Waiting for the teacher to start</h2>
            <p>Stay on this screen. Your first word will appear when the game begins.</p>
          </div>
        )}

        {payload.status === "COMPLETED" && (
          <div className="vocab-player-waiting complete">
            <CheckCircle2 size={38} />
            <h2>You finished Vocab Dash.</h2>
            <p>{payload.finishRank ? `Final place: #${payload.finishRank}.` : "Your result is on the teacher screen."}</p>
          </div>
        )}

        {payload.status === "PLAYING" && payload.question && (
          <div className="vocab-question-panel">
            <span>Choose the correct definition</span>
            <h2>{payload.question.word}</h2>
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
