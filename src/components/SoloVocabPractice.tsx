"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

type Term = { id: string; word: string; definition: string };

function shuffle<T>(values: T[]) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export function SoloVocabPractice({ terms }: { terms: Term[] }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "">("");
  const order = useMemo(() => shuffle(terms), [terms, round]);
  const term = order[Math.min(index, order.length - 1)];
  const choices = useMemo(() => shuffle([
    term.word,
    ...shuffle(terms.filter((item) => item.id !== term.id)).slice(0, 3).map((item) => item.word)
  ]), [term, terms, round]);
  const complete = index >= order.length;

  function answer(choice: string) {
    if (feedback || complete) return;
    const isCorrect = choice === term.word;
    setFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) setCorrect((value) => value + 1);
    window.setTimeout(() => {
      setFeedback("");
      setIndex((value) => value + 1);
    }, 700);
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
      <div className="solo-vocab-progress"><span>{index + 1} of {terms.length}</span><i style={{ width: `${(index / terms.length) * 100}%` }} /></div>
      <div className="solo-vocab-question"><span>Choose the vocabulary word</span><h2>{term.definition}</h2></div>
      <div className="vocab-choice-grid">
        {choices.map((choice) => <button type="button" disabled={Boolean(feedback)} onClick={() => answer(choice)} key={choice}>{choice}</button>)}
      </div>
      {feedback && <div className={`vocab-player-feedback ${feedback === "correct" ? "correct" : "wrong"}`}>{feedback === "correct" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{feedback === "correct" ? "Correct." : "Incorrect."}</div>}
    </section>
  );
}
