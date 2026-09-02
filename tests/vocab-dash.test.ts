import assert from "node:assert/strict";
import test from "node:test";
import {
  accuracyPercent,
  buildVocabDashQuestion,
  joinCode,
  nextVocabDashTerm,
  progressPercent,
  rankedParticipants,
  reshuffledTermIds,
  resolveVocabDashAnswer,
  starsForPlacement,
  type VocabDashTerm
} from "../src/lib/vocab-dash.ts";

const terms: VocabDashTerm[] = [
  { id: "one", word: "habitat", definition: "The natural home of a living thing." },
  { id: "two", word: "adaptation", definition: "A trait that helps an organism survive." },
  { id: "three", word: "ecosystem", definition: "Living and nonliving things interacting." },
  { id: "four", word: "producer", definition: "An organism that makes its own food." },
  { id: "five", word: "consumer", definition: "An organism that eats other organisms." }
];

test("uses the saved question order and skips answered terms", () => {
  const order = ["three", "one", "five", "two", "four"];
  assert.equal(nextVocabDashTerm({ terms, answeredTermIds: [], questionOrderIds: order })?.id, "three");
  assert.equal(nextVocabDashTerm({ terms, answeredTermIds: ["three", "one"], questionOrderIds: order })?.id, "five");
  assert.equal(nextVocabDashTerm({ terms, answeredTermIds: order, questionOrderIds: order }), null);
});

test("builds one correct choice and three unique distractors", () => {
  const question = buildVocabDashQuestion({
    terms,
    answeredTermIds: [],
    questionOrderIds: terms.map((term) => term.id)
  });
  assert.ok(question);
  assert.equal(question.termId, "one");
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes("habitat"));
});

test("returns no question after the term set is complete", () => {
  assert.equal(buildVocabDashQuestion({
    terms,
    answeredTermIds: terms.map((term) => term.id),
    questionOrderIds: terms.map((term) => term.id)
  }), null);
});

test("polling and reconnects keep the same choices in the same positions", () => {
  const input = { terms, answeredTermIds: [], questionOrderIds: ["three", "one", "five", "two", "four"] };
  const first = buildVocabDashQuestion(input);
  for (let poll = 0; poll < 20; poll += 1) assert.deepEqual(buildVocabDashQuestion(input), first);
});

test("legacy rooms without a saved order have a stable current question", () => {
  assert.equal(nextVocabDashTerm({ terms, answeredTermIds: [] })?.id, "one");
  assert.equal(nextVocabDashTerm({ terms, answeredTermIds: ["one"] })?.id, "two");
});

test("correct vocab dash answers advance the current streak", () => {
  const order = terms.map((term) => term.id);
  const result = resolveVocabDashAnswer({
    terms,
    answeredTermIds: [],
    questionOrderIds: order,
    termId: "one",
    answerText: " habitat "
  });

  assert.ok(result);
  assert.equal(result.correct, true);
  assert.equal(result.currentStreak, 1);
  assert.deepEqual(result.answeredTermIds, ["one"]);
  assert.deepEqual(result.questionOrderIds, order);
  assert.equal(result.completed, false);
});

test("wrong vocab dash answers reset progress and reshuffle the next run", () => {
  const order = terms.map((term) => term.id);
  const result = resolveVocabDashAnswer({
    terms,
    answeredTermIds: ["one", "two"],
    questionOrderIds: order,
    termId: "three",
    answerText: "producer",
    random: () => 0.99
  });

  assert.ok(result);
  assert.equal(result.correct, false);
  assert.equal(result.currentStreak, 0);
  assert.deepEqual(result.answeredTermIds, []);
  assert.notDeepEqual(result.questionOrderIds, order);
  assert.equal(result.questionOrderIds.length, terms.length);
  assert.notEqual(result.questionOrderIds[0], order[0]);
  assert.equal(result.completed, false);
});

test("reshuffled retry orders keep every term but avoid the previous sequence", () => {
  const order = ["three", "one", "five", "two", "four"];
  const reshuffled = reshuffledTermIds(terms, order, () => 0.99);

  assert.notDeepEqual(reshuffled, order);
  assert.deepEqual([...reshuffled].sort(), [...order].sort());
  assert.notEqual(reshuffled[0], order[0]);
});

test("ranks finishers first and active players by progress", () => {
  const ranked = rankedParticipants([
    { id: "b", displayName: "Bailey", characterKey: "runner", currentStreak: 4, totalCorrect: 4, totalAttempts: 5 },
    { id: "c", displayName: "Casey", characterKey: "runner", currentStreak: 5, totalCorrect: 3, totalAttempts: 5 },
    { id: "a", displayName: "Alex", characterKey: "runner", currentStreak: 5, totalCorrect: 5, totalAttempts: 5, finishRank: 1 }
  ]);
  assert.deepEqual(ranked.map((participant) => participant.id), ["a", "c", "b"]);
});

test("calculates progress, accuracy, placement rewards, and clean join codes", () => {
  assert.equal(progressPercent(5, 10), 50);
  assert.equal(progressPercent(20, 10), 100);
  assert.equal(accuracyPercent(7, 8), 88);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(starsForPlacement), [10, 8, 6, 4, 2, 1]);
  assert.equal(joinCode("12 3-45x67"), "123456");
});
