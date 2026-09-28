export const vocabDashCharacters = [
  { key: "runner", label: "Alien", glyph: "👽" }
];

export const vocabDashColors = [
  { key: "blue", label: "Blue", hex: "#64b5ff" },
  { key: "pink", label: "Pink", hex: "#ff86ca" },
  { key: "green", label: "Green", hex: "#75ed35" },
  { key: "orange", label: "Orange", hex: "#ffb35b" }
] as const;

export type CosmeticSlot = "hat" | "eyes" | "extra";
export type AlienCosmetic = {
  key: string;
  label: string;
  cost: number;
  slot: CosmeticSlot;
  artwork?: string;
  hidesEyes?: boolean;
  image?: string;
  width?: number;
  height?: number;
  viewBox?: string;
  placement?: { x: number; y: number; width: number; height: number };
};

export const vocabDashAccessories: readonly AlienCosmetic[] = [
  { key: "sport-headband", label: "Team Headband", cost: 0, slot: "hat", artwork: "sport-headband" },
  { key: "star-bow", label: "Starlight Bow", cost: 0, slot: "hat", artwork: "star-bow" },
  { key: "bandana", label: "Comet Bandana", cost: 0, slot: "extra", artwork: "bandana" },
  { key: "pixel-shades", label: "Pixel Power", cost: 20, slot: "eyes", artwork: "pixel-shades" },
  { key: "star-shades", label: "Superstar Shades", cost: 30, slot: "eyes", artwork: "star-shades" },
  { key: "orbit-visor", label: "Orbit Visor", cost: 35, slot: "eyes", artwork: "orbit-visor" },
  { key: "explorer-goggles", label: "Explorer Goggles", cost: 25, slot: "eyes", artwork: "explorer-goggles", hidesEyes: false },
  { key: "space-crown", label: "Galaxy Crown", cost: 60, slot: "hat", artwork: "space-crown" },
  { key: "headphones", label: "Star Beats", cost: 40, slot: "hat", artwork: "headphones" },
  { key: "comet-scarf", label: "Comet Scarf", cost: 15, slot: "extra", artwork: "comet-scarf" },
  { key: "bucket-hat", label: "Sunny Bucket", cost: 8, slot: "hat", image: "/game-avatars/bucket-hat.png", width: 1536, height: 1024, viewBox: "62 116 1412 776", placement: { x: 31, y: 8, width: 178, height: 82 } },
  { key: "beanie", label: "Cozy Beanie", cost: 8, slot: "hat", image: "/game-avatars/beanie.png", width: 1536, height: 1024, viewBox: "183 13 1163 972", placement: { x: 43, y: 2, width: 154, height: 82 } },
  { key: "space-cap", label: "Cosmic Cap", cost: 8, slot: "hat", image: "/game-avatars/space-cap.png", width: 1536, height: 1024, viewBox: "57 77 1423 824", placement: { x: 43, y: 9, width: 154, height: 62 } },
  { key: "cap", label: "Blue Baseball Cap", cost: 6, slot: "hat", image: "/game-avatars/cap.png", width: 1509, height: 1042, viewBox: "88 73 1363 851" },
  { key: "sunglasses", label: "Classic Shades", cost: 10, slot: "eyes", image: "/game-avatars/sunglasses.png", width: 1918, height: 820, viewBox: "44 115 1829 586" },
  { key: "sunglasses-pink", label: "Candy Pink", cost: 10, slot: "eyes", image: "/game-avatars/sunglasses-pink.png", width: 1774, height: 887, viewBox: "11 157 1753 562" },
  { key: "sunglasses-sport", label: "Turbo Cyan", cost: 10, slot: "eyes", image: "/game-avatars/sunglasses-sport.png", width: 1983, height: 793, viewBox: "26 108 1932 584" }
] as const;

export const cosmeticSlots: { key: CosmeticSlot; label: string }[] = [
  { key: "hat", label: "Headwear" }, { key: "eyes", label: "Eyewear" }, { key: "extra", label: "Extras" }
];

// Legacy accounts store a single key. New looks store a JSON array in that same field.
export function equippedCosmetics(value?: string | null): string[] {
  if (!value) return [];
  let keys: unknown = [value];
  if (value.startsWith("[")) {
    try { keys = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(keys)) return [];
  const slots = new Set<CosmeticSlot>();
  return keys.filter((key): key is string => {
    const item = vocabDashAccessories.find((item) => item.key === key);
    if (!item || slots.has(item.slot)) return false;
    slots.add(item.slot);
    return true;
  });
}

export function ownedCosmetics(value: string): string[] {
  try {
    const keys: unknown = JSON.parse(value);
    return Array.isArray(keys) ? [...new Set(keys.filter((key): key is string => typeof key === "string"))] : [];
  } catch { return []; }
}

export function cosmeticPurchase(value: string, owned: string[], stars: number) {
  let requested: unknown;
  try { requested = value.startsWith("[") ? JSON.parse(value) : value ? [value] : []; }
  catch { throw new Error("Choose a valid look."); }
  if (!Array.isArray(requested) || requested.length > cosmeticSlots.length) throw new Error("Choose one item per category.");
  const keys = equippedCosmetics(value);
  if (keys.length !== requested.length) throw new Error("Choose an available item in each category.");
  const items = keys.map((key) => vocabDashAccessories.find((item) => item.key === key)!);
  const newItems = items.filter((item) => item.cost > 0 && !owned.includes(item.key));
  const cost = newItems.reduce((sum, item) => sum + item.cost, 0);
  if (stars < cost) throw new Error(`You need ${cost - stars} more stars to unlock this look.`);
  return { keys, cost, owned: [...new Set([...owned, ...newItems.map((item) => item.key)])] };
}

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
