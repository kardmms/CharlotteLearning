export const vocabDashCharacters = [
  { key: "rocket", label: "Rocket", glyph: "R" },
  { key: "star", label: "Star", glyph: "S" },
  { key: "bolt", label: "Bolt", glyph: "B" },
  { key: "comet", label: "Comet", glyph: "C" },
  { key: "spark", label: "Spark", glyph: "P" },
  { key: "compass", label: "Compass", glyph: "M" }
];

export type VocabDashTerm = {
  id: string;
  word: string;
  definition: string;
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

function shuffle<T>(values: T[]) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

export function buildVocabDashQuestion(input: {
  terms: VocabDashTerm[];
  streakTermIds: string[];
}) {
  const unanswered = input.terms.filter((term) => !input.streakTermIds.includes(term.id));
  const pool = unanswered.length ? unanswered : input.terms;
  const term = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffle(input.terms.filter((item) => item.id !== term.id))
    .slice(0, 3)
    .map((item) => item.definition);
  const choices = shuffle([term.definition, ...distractors]);

  return {
    termId: term.id,
    word: term.word,
    choices
  };
}

export function joinCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}
