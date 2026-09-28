import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_CATEGORIES,
  assignedQuestionIds,
  deriveCategoryRanks,
  nextCategoryLevel,
  selectedQuestions,
  validateQuestionBank,
  validatePublishedQuestionBank
} from "../src/lib/adaptive-assessment.ts";

const bank = [1, 2, 3, 4, 5].flatMap((difficulty) =>
  QUESTION_CATEGORIES.flatMap((category) => [1, 2].map((number) => ({
    id: `${category}-${difficulty}-${number}`,
    category,
    difficulty,
    prompt: `${category} level ${difficulty} question ${number}`
  })))
);

test("five tests require exactly two questions in each category and level", () => {
  assert.equal(validateQuestionBank(bank), true);
  assert.equal(validateQuestionBank(bank.slice(1)), false);
  assert.equal(validateQuestionBank([...bank.slice(1), bank[1]]), false);
});

test("publishing requires complete answers and written scoring guides", () => {
  const ready = bank.map((question) => ({
    ...question,
    choicesJson: question.category === "WRITTEN_ANALYSIS" ? null : JSON.stringify(["A", "B", "C", "D"]),
    correctAnswer: question.category === "WRITTEN_ANALYSIS" ? null : "B",
    rubric: question.category === "WRITTEN_ANALYSIS" ? "Explain with a relevant detail." : null
  }));
  assert.equal(validatePublishedQuestionBank(ready), true);
  assert.equal(validatePublishedQuestionBank(ready.map((question, index) => index === 0 ? { ...question, correctAnswer: "missing" } : question)), false);
  assert.equal(validatePublishedQuestionBank(ready.map((question) => question.category === "WRITTEN_ANALYSIS" ? { ...question, rubric: null } : question)), false);
});

test("a student receives ten stable questions at independent category levels", () => {
  const ids = assignedQuestionIds(bank, { UNDERSTANDING: 1, EVIDENCE: 5 });
  assert.equal(ids.length, 10);
  assert.deepEqual(ids.slice(0, 2), ["UNDERSTANDING-1-1", "UNDERSTANDING-1-2"]);
  assert.deepEqual(ids.slice(2, 4), ["EVIDENCE-5-1", "EVIDENCE-5-2"]);
  assert.deepEqual(ids.slice(4, 6), ["THINKING_DEEPER-3-1", "THINKING_DEEPER-3-2"]);
  assert.deepEqual(selectedQuestions(bank, JSON.stringify(ids)).map((question) => question.id), ids);
  assert.throws(() => selectedQuestions(bank, JSON.stringify([...ids.slice(0, 9), ids[0]])));
});

test("two graded answers move one level up or down and stay in bounds", () => {
  assert.equal(nextCategoryLevel(3, [true, true]), 4);
  assert.equal(nextCategoryLevel(3, [false, false]), 2);
  assert.equal(nextCategoryLevel(3, [true, false]), 3);
  assert.equal(nextCategoryLevel(5, [true, true]), 5);
  assert.equal(nextCategoryLevel(1, [false, false]), 1);
  assert.throws(() => nextCategoryLevel(3, [true]));
});

test("category profiles start at three and wait for both written answers to be graded", () => {
  const ids = assignedQuestionIds(bank);
  const answers = ids.map((id) => ({
    questionId: id,
    isCorrect: id.startsWith("UNDERSTANDING") ? false : id.startsWith("WRITTEN_ANALYSIS") ? null : true
  }));
  const first = deriveCategoryRanks([{ questions: bank, assignedQuestionIdsJson: JSON.stringify(ids), answers }]);
  assert.equal(first.levels.UNDERSTANDING, 2);
  assert.equal(first.levels.EVIDENCE, 4);
  assert.equal(first.levels.WRITTEN_ANALYSIS, 3);
  assert.equal(first.counts.WRITTEN_ANALYSIS, 0);
  const graded = deriveCategoryRanks([{ questions: bank, assignedQuestionIdsJson: JSON.stringify(ids), answers: answers.map((answer) => ({ ...answer, isCorrect: answer.isCorrect ?? true })) }]);
  assert.equal(graded.levels.WRITTEN_ANALYSIS, 4);
  assert.equal(graded.counts.WRITTEN_ANALYSIS, 1);
});
