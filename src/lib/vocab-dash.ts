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

export function shuffle<T>(values: T[]) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

export function shuffledTermIds(terms: VocabDashTerm[]) {
  return shuffle(terms.map((term) => term.id));
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

export function buildVocabDashQuestion(input: {
  terms: VocabDashTerm[];
  answeredTermIds: string[];
  questionOrderIds?: string[];
}) {
  const orderedTerms = (input.questionOrderIds?.length
    ? input.questionOrderIds.map((id) => input.terms.find((term) => term.id === id)).filter(Boolean)
    : shuffle(input.terms)) as VocabDashTerm[];
  const term = orderedTerms.find((item) => !input.answeredTermIds.includes(item.id)) || orderedTerms[0];
  const distractors = shuffle(input.terms.filter((item) => item.id !== term.id))
    .slice(0, 3)
    .map((item) => item.word);
  const choices = shuffle([term.word, ...distractors]);

  return {
    termId: term.id,
    definition: term.definition,
    choices
  };
}

export function joinCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}
