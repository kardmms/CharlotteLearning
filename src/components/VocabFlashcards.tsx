"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

type Term = { id: string; word: string; definition: string; alternateDefinition?: string | null };

export function VocabFlashcards({ terms }: { terms: Term[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const term = terms[index];

  function move(direction: number) {
    setIndex((current) => (current + direction + terms.length) % terms.length);
    setFlipped(false);
  }

  return (
    <div className="flashcard-tool">
      <button
        className={`vocab-flashcard ${flipped ? "flipped" : ""}`}
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? "Show vocabulary word" : "Show definition"}
      >
        <span className="vocab-flashcard-front"><small>Vocabulary word</small><strong>{term.word}</strong><em>Tap to flip</em></span>
        <span className="vocab-flashcard-back">
          <small>Definition</small>
          <strong>{term.definition}</strong>
          {term.alternateDefinition && <span><b>Another meaning:</b> {term.alternateDefinition}</span>}
          <em>Tap to flip</em>
        </span>
      </button>
      <div className="flashcard-controls">
        <button className="icon-button" type="button" onClick={() => move(-1)} aria-label="Previous card" title="Previous card"><ArrowLeft size={20} /></button>
        <span>{index + 1} / {terms.length}</span>
        <button className="icon-button" type="button" onClick={() => setFlipped(false)} aria-label="Reset card" title="Reset card"><RotateCcw size={19} /></button>
        <button className="icon-button" type="button" onClick={() => move(1)} aria-label="Next card" title="Next card"><ArrowRight size={20} /></button>
      </div>
    </div>
  );
}
