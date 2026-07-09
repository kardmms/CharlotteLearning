"use client";

import type { Question } from "@prisma/client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try { return JSON.parse(choicesJson) as string[]; } catch { return []; }
}

export function QuestionReviewFields({ question, index }: { question: Question; index: number }) {
  const initialChoices = parseChoices(question.choicesJson);
  const initialCorrect =
    initialChoices.find((choice) => choice === question.correctAnswer) ||
    initialChoices.find((choice) => choice.toLowerCase() === question.correctAnswer?.toLowerCase()) ||
    question.correctAnswer ||
    "";
  const [format, setFormat] = useState(initialChoices.length ? "MULTIPLE_CHOICE" : "PARAGRAPH");
  const [choices, setChoices] = useState([...initialChoices, "", "", ""].slice(0, Math.max(4, initialChoices.length)));
  const [correctAnswer, setCorrectAnswer] = useState(initialCorrect);
  const isMultipleChoice = format === "MULTIPLE_CHOICE";

  return (
    <div className="question-editor simplified-question-editor">
      <h2>Question {index + 1}</h2>
      <input type="hidden" name={`type-${question.id}`} value={question.type} />
      <input type="hidden" name={`skill-${question.id}`} value={question.skillTag || ""} />
      <input type="hidden" name={`difficulty-${question.id}`} value={question.difficulty} />
      <input type="hidden" name={`standard-${question.id}`} value={question.standardCode || ""} />
      <input type="hidden" name={`rubric-${question.id}`} value={question.rubric || ""} />
      {question.randomizeChoices && <input type="hidden" name={`randomize-${question.id}`} value="on" />}

      <div className="question-simple-controls">
        <label>
          Question type
          <select name={`format-${question.id}`} value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="SHORT_ANSWER">Short answer</option>
            <option value="PARAGRAPH">Paragraph response</option>
          </select>
        </label>
        <label>
          Question timer
          <select name={`timeLimit-${question.id}`} defaultValue={question.timeLimitSeconds || 0}>
            <option value="0">No question limit</option>
            <option value="30">30 seconds</option><option value="45">45 seconds</option>
            <option value="60">1 minute</option><option value="90">1 minute 30 seconds</option>
            <option value="120">2 minutes</option><option value="180">3 minutes</option>
          </select>
        </label>
      </div>

      <label>
        Prompt
        <textarea name={`prompt-${question.id}`} defaultValue={question.prompt} required />
      </label>

      {isMultipleChoice && (
        <div className="options-editor simple-options-editor">
          <div className="answers-editor-heading">
            <h3>Answers</h3>
            {correctAnswer ? (
              <span><CheckCircle2 size={16} /> Charlotte selected the correct answer</span>
            ) : (
              <span className="needs-answer">Choose the correct answer before publishing</span>
            )}
          </div>
          {choices.map((choice, choiceIndex) => (
            <label className="option-row" key={choiceIndex}>
              <span>{String.fromCharCode(65 + choiceIndex)}</span>
              <input
                name={`choice-${question.id}`}
                value={choice}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setChoices((current) => current.map((item, itemIndex) => itemIndex === choiceIndex ? nextValue : item));
                  if (choice && correctAnswer === choice) setCorrectAnswer(nextValue);
                }}
                placeholder={`Option ${choiceIndex + 1}`}
              />
            </label>
          ))}
          <label>
            Correct answer
            <select
              name={`correct-${question.id}`}
              value={correctAnswer}
              onChange={(event) => setCorrectAnswer(event.target.value)}
            >
              <option value="">Select the correct answer</option>
              {choices.filter(Boolean).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
            <span className="help-text">Charlotte fills this in for AI drafts. Change it only if you disagree.</span>
          </label>
        </div>
      )}
    </div>
  );
}
