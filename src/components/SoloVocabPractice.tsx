"use client";
import { ReadAloud } from "./ReadAloud";
import { AccessibilityMenu } from "./StudentAccessibility";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

type Term = { id: string; word: string; definition: string };

function shuffle<T>(values: T[], seed: string) {
  // Stable on server and client; each round gets a new order without hydration drift.
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function SoloVocabPractice({ terms }: { terms: Term[] }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "">("");
  const order = useMemo(() => shuffle(terms, `${terms.map(term => term.id).join("|")}:${round}`), [terms, round]);
  const term = order[Math.min(index, order.length - 1)];
  const choices = useMemo(() => shuffle([
    term.word,
    ...shuffle(terms.filter((item) => item.id !== term.id), `${term.id}:${round}:distractors`).slice(0, 3).map((item) => item.word)
  ], `${term.id}:${round}:choices`), [term, terms, round]);
  const complete = index >= order.length;

  function answer(choice: string) {
    if (feedback || complete) return;
    const isCorrect = choice === term.word;
    setFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) setCorrect((value) => value + 1);

  }

  function restart() {
    setRound((value) => value + 1);
    setIndex(0);
    setCorrect(0);
    setFeedback("");
  }

  if (complete) {
    return (
      <section className="solo-vocab-complete">
        <CheckCircle2 size={38} />
        <h2>Practice complete</h2>
        <p>{correct} of {terms.length} correct ({Math.round((correct / terms.length) * 100)}%).</p>
        <button className="button" type="button" onClick={restart}><RotateCcw size={18} /> Practice again</button>
      </section>
    );
  }

  return (
    <section className="solo-vocab-player">
      <AccessibilityMenu />
      <div className="solo-vocab-progress"><span>{index + 1} of {terms.length}</span><i style={{ width: `${(index / terms.length) * 100}%` }} /></div>
      <div className="solo-vocab-question"><span>Choose the vocabulary word</span><ReadAloud text={term.definition} questionId={`${round}-${index}-${term.id}`} choices={choices} /></div>
      <div className="vocab-choice-grid">
        {choices.map((choice) => <button type="button" disabled={Boolean(feedback)} onClick={() => answer(choice)} key={choice}>{choice}</button>)}
      </div>
      {feedback && <button className="button" type="button" onClick={() => { setFeedback(""); setIndex(value => value + 1); }}>Next question</button>}
      {feedback && <div role="status" className={`vocab-player-feedback ${feedback === "correct" ? "correct" : "wrong"}`}>{feedback === "correct" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{feedback === "correct" ? "Correct." : "Incorrect."}</div>}
    </section>
  );
}
