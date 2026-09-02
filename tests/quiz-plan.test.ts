import assert from "node:assert/strict";
import test from "node:test";
import {
  clampQuestionCount,
  defaultMultipleChoiceCount,
  normalizeQuizQuestionPlan
} from "../src/lib/quiz-plan.ts";

test("clamps in-class question count to the supported assignment range", () => {
  assert.equal(clampQuestionCount(1), 5);
  assert.equal(clampQuestionCount(9), 9);
  assert.equal(clampQuestionCount(30), 12);
});

test("defaults to roughly three quarters multiple choice", () => {
  assert.equal(defaultMultipleChoiceCount(8), 6);
  assert.deepEqual(normalizeQuizQuestionPlan(), {
    questionCount: 8,
    multipleChoiceCount: 6,
    freeResponseCount: 2
  });
});

test("normalizes the selected response mix against the selected total", () => {
  assert.deepEqual(
    normalizeQuizQuestionPlan({
      questionCount: "10",
      multipleChoiceCount: "3",
      freeResponseCount: "7"
    }),
    {
      questionCount: 10,
      multipleChoiceCount: 3,
      freeResponseCount: 7
    }
  );
  assert.deepEqual(
    normalizeQuizQuestionPlan({
      questionCount: "6",
      multipleChoiceCount: "20"
    }),
    {
      questionCount: 6,
      multipleChoiceCount: 6,
      freeResponseCount: 0
    }
  );
});
