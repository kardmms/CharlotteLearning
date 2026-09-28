export const QUESTION_CATEGORIES = [
  "UNDERSTANDING",
  "EVIDENCE",
  "THINKING_DEEPER",
  "LANGUAGE",
  "WRITTEN_ANALYSIS"
] as const;

export type AssessmentCategory = (typeof QUESTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  UNDERSTANDING: "Understanding",
  EVIDENCE: "Evidence",
  THINKING_DEEPER: "Thinking deeper",
  LANGUAGE: "Language",
  WRITTEN_ANALYSIS: "Written analysis"
};

export type BankQuestion = {
  id: string;
  category: AssessmentCategory | null;
  difficulty: number;
  prompt?: string;
};

export function validateQuestionBank(questions: BankQuestion[]) {
  if (questions.length !== 50) return false;
  const prompts = new Set<string>();
  for (const level of [1, 2, 3, 4, 5]) {
    for (const category of QUESTION_CATEGORIES) {
      const pair = questions.filter((question) => question.difficulty === level && question.category === category);
      if (pair.length !== 2) return false;
    }
  }
  for (const question of questions) {
    if (!question.category || !QUESTION_CATEGORIES.includes(question.category)) return false;
    if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 5) return false;
    if (question.prompt) {
      const normalized = question.prompt.toLocaleLowerCase().replace(/\s+/g, " ").trim();
      if (prompts.has(normalized)) return false;
      prompts.add(normalized);
    }
  }
  return true;
}

export function validatePublishedQuestionBank(questions: Array<BankQuestion & {
  choicesJson: string | null;
  correctAnswer: string | null;
  rubric: string | null;
}>) {
  if (!validateQuestionBank(questions)) return false;
  return questions.every((question) => {
    let choices: unknown;
    try { choices = question.choicesJson ? JSON.parse(question.choicesJson) : []; }
    catch { return false; }
    if (!Array.isArray(choices)) return false;
    if (question.category === "WRITTEN_ANALYSIS") {
      return choices.length === 0 && Boolean(question.rubric?.trim());
    }
    return choices.length === 4 &&
      choices.every((choice) => typeof choice === "string" && choice.trim()) &&
      new Set(choices).size === 4 && choices.includes(question.correctAnswer);
  });
}

export function assignedQuestionIds(
  questions: BankQuestion[],
  ranks: Partial<Record<AssessmentCategory, number>> = {}
) {
  if (!validateQuestionBank(questions)) throw new Error("The five-test question bank is incomplete.");
  return QUESTION_CATEGORIES.flatMap((category) => {
    const level = Math.min(5, Math.max(1, Math.round(ranks[category] ?? 3)));
    return questions.filter((question) => question.category === category && question.difficulty === level)
      .map((question) => question.id);
  });
}

export function selectedQuestions<T extends BankQuestion>(questions: T[], assignedIdsJson: string | null) {
  if (!assignedIdsJson) throw new Error("The student's question set was not saved.");
  let ids: unknown;
  try { ids = JSON.parse(assignedIdsJson); } catch { throw new Error("The student's question set is invalid."); }
  if (!Array.isArray(ids) || ids.length !== 10 || ids.some((id) => typeof id !== "string")) {
    throw new Error("The student's question set is incomplete.");
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  const chosen = ids.map((id) => byId.get(id));
  if (new Set(ids).size !== 10 || chosen.some((question) => !question)) {
    throw new Error("The student's question set no longer matches this assignment.");
  }
  const complete = chosen as T[];
  for (const category of QUESTION_CATEGORIES) {
    if (complete.filter((question) => question.category === category).length !== 2) {
      throw new Error("The student's question categories are incomplete.");
    }
  }
  return complete;
}

export function nextCategoryLevel(level: number, results: boolean[]) {
  if (results.length !== 2) throw new Error("A category needs two graded answers.");
  const current = Math.min(5, Math.max(1, Math.round(level)));
  const correct = results.filter(Boolean).length;
  return correct === 2 ? Math.min(5, current + 1) : correct === 0 ? Math.max(1, current - 1) : current;
}

export function deriveCategoryRanks(sessions: Array<{
  questions: BankQuestion[];
  assignedQuestionIdsJson: string | null;
  answers: Array<{ questionId: string; isCorrect: boolean | null }>;
}>) {
  const levels = Object.fromEntries(QUESTION_CATEGORIES.map((category) => [category, 3])) as Record<AssessmentCategory, number>;
  const counts = Object.fromEntries(QUESTION_CATEGORIES.map((category) => [category, 0])) as Record<AssessmentCategory, number>;
  for (const session of sessions) {
    let assigned: BankQuestion[];
    try { assigned = selectedQuestions(session.questions, session.assignedQuestionIdsJson); }
    catch { continue; }
    const answers = new Map(session.answers.map((answer) => [answer.questionId, answer.isCorrect]));
    for (const category of QUESTION_CATEGORIES) {
      const pair = assigned.filter((question) => question.category === category);
      const results = pair.map((question) => answers.get(question.id));
      if (results.some((result) => result === null || result === undefined)) continue;
      levels[category] = nextCategoryLevel(levels[category], results as boolean[]);
      counts[category] += 1;
    }
  }
  return { levels, counts };
}
