export const vocabDashCharacters = [
  { key: "runner", label: "Runner", glyph: "C" }
];

export const vocabDashColors = [
  { key: "blue", label: "Blue", hex: "#2563eb" },
  { key: "pink", label: "Pink", hex: "#db2777" },
  { key: "green", label: "Green", hex: "#16a34a" },
  { key: "orange", label: "Orange", hex: "#ea580c" }
] as const;

export const vocabDashAccessories = [
  { key: "cap", label: "Cap", cost: 6 },
  { key: "sunglasses", label: "Sunglasses", cost: 10 }
] as const;

export type VocabDashTerm = {
  id: string;
  word: string;
  definition: string;
  alternateDefinition?: string | null;
};

export type VocabDashIncorrectAnswer = {
  termId: string;
  definition: string;
  answer: string;
  correctAnswer: string;
};

export type VocabDashParticipant = {
  id: string;
  displayName: string;
  characterKey: string;
  currentStreak: number;
  totalCorrect: number;
  totalAttempts: number;
  finishRank?: number | null;
  completedAt?: Date | string | null;
};

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function streakTermIds(value: string) {
  return safeJsonArray(value);
}

export function progressPercent(streak: number, termCount: number) {
  if (termCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((streak / termCount) * 100)));
}

export function accuracyPercent(correct: number, attempts: number) {
  if (attempts <= 0) return 0;
  return Math.round((correct / attempts) * 100);
}

export function characterForKey(key?: string | null) {
  return vocabDashCharacters.find((character) => character.key === key) || vocabDashCharacters[0];
}

export function rankedParticipants<T extends VocabDashParticipant>(participants: T[]) {
  return [...participants].sort((a, b) => {
    if (a.finishRank && b.finishRank) return a.finishRank - b.finishRank;
    if (a.finishRank) return -1;
    if (b.finishRank) return 1;
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function shuffle<T>(values: T[], random = Math.random) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

export function shuffledTermIds(terms: VocabDashTerm[]) {
  return shuffle(terms.map((term) => term.id));
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizedPreviousOrder(terms: VocabDashTerm[], previousOrderIds: string[]) {
  const termIds = terms.map((term) => term.id);
  if (!previousOrderIds.length) return termIds;

  const validPreviousIds = previousOrderIds.filter((id, index) =>
    termIds.includes(id) && previousOrderIds.indexOf(id) === index
  );
  const missingIds = termIds.filter((id) => !validPreviousIds.includes(id));
  return [...validPreviousIds, ...missingIds];
}

export function reshuffledTermIds(
  terms: VocabDashTerm[],
  previousOrderIds: string[] = [],
  random = Math.random
) {
  const termIds = terms.map((term) => term.id);
  if (termIds.length <= 1) return termIds;

  const previous = normalizedPreviousOrder(terms, previousOrderIds);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextOrder = shuffle(termIds, random);
    if (!sameStringArray(nextOrder, previous) && nextOrder[0] !== previous[0]) {
      return nextOrder;
    }
  }

  const shift = 1 + Math.floor(random() * (termIds.length - 1));
  return [...previous.slice(shift), ...previous.slice(0, shift)];
}

export function resolveVocabDashAnswer(input: {
  terms: VocabDashTerm[];
  answeredTermIds: string[];
  questionOrderIds: string[];
  termId: string;
  answerText: string;
  random?: () => number;
}) {
  const term = nextVocabDashTerm(input);
  if (!term || term.id !== input.termId) return null;

  const correct = term.word.trim().toLowerCase() === input.answerText.trim().toLowerCase();
  const nextAnsweredTermIds = correct ? [...input.answeredTermIds, term.id] : [];
  const nextQuestionOrderIds = correct
    ? input.questionOrderIds
    : reshuffledTermIds(input.terms, input.questionOrderIds, input.random);

  return {
    term,
    correct,
    answeredTermIds: nextAnsweredTermIds,
    questionOrderIds: nextQuestionOrderIds,
    currentStreak: nextAnsweredTermIds.length,
    completed: correct && nextAnsweredTermIds.length >= input.terms.length
  };
}

export function incorrectAnswers(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is VocabDashIncorrectAnswer => (
      item && typeof item === "object" &&
      typeof item.termId === "string" &&
      typeof item.definition === "string" &&
      typeof item.answer === "string" &&
      typeof item.correctAnswer === "string"
    ));
  } catch {
    return [];
  }
}

export function starsForPlacement(rank: number) {
  if (rank === 1) return 10;
  if (rank === 2) return 8;
  if (rank === 3) return 6;
  if (rank === 4) return 4;
  if (rank === 5) return 2;
  return 1;
}

function questionRandom(seed: string) {
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function buildVocabDashQuestion(input: {
  terms: VocabDashTerm[];
  answeredTermIds: string[];
  questionOrderIds?: string[];
}) {
  const term = nextVocabDashTerm(input);
  if (!term) return null;
  // Repeated polling must not move answer buttons beneath a student's cursor.
  const random = questionRandom(`${input.questionOrderIds?.join(",") || ""}:${term.id}`);
  const distractors = shuffle(input.terms.filter((item) => item.id !== term.id), random)
    .slice(0, 3)
    .map((item) => item.word);
  const choices = shuffle([term.word, ...distractors], random);

  return {
    termId: term.id,
    definition: term.definition,
    choices
  };
}

export function nextVocabDashTerm(input: {
  terms: VocabDashTerm[];
  answeredTermIds: string[];
  questionOrderIds?: string[];
}) {
  const orderedTerms = (input.questionOrderIds?.length
    ? input.questionOrderIds.map((id) => input.terms.find((term) => term.id === id)).filter(Boolean)
    : input.terms) as VocabDashTerm[];
  return orderedTerms.find((item) => !input.answeredTermIds.includes(item.id)) || null;
}

export function joinCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}
