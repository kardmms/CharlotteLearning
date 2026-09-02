export const MIN_IN_CLASS_QUESTION_COUNT = 5;
export const MAX_IN_CLASS_QUESTION_COUNT = 12;
export const DEFAULT_IN_CLASS_QUESTION_COUNT = 8;

export type QuizQuestionPlan = {
  questionCount: number;
  multipleChoiceCount: number;
  freeResponseCount: number;
};

function numericValue(value: FormDataEntryValue | number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clampQuestionCount(value: FormDataEntryValue | number | string | null | undefined) {
  const parsed = numericValue(value);
  return Math.min(
    MAX_IN_CLASS_QUESTION_COUNT,
    Math.max(MIN_IN_CLASS_QUESTION_COUNT, Math.round(parsed ?? DEFAULT_IN_CLASS_QUESTION_COUNT))
  );
}

export function defaultMultipleChoiceCount(questionCount: number) {
  return Math.min(questionCount, Math.max(0, Math.round(questionCount * 0.75)));
}

export function clampMultipleChoiceCount(
  value: FormDataEntryValue | number | string | null | undefined,
  questionCount: number
) {
  const parsed = numericValue(value);
  return Math.min(questionCount, Math.max(0, Math.round(parsed ?? defaultMultipleChoiceCount(questionCount))));
}

export function normalizeQuizQuestionPlan(input: {
  questionCount?: FormDataEntryValue | number | string | null;
  multipleChoiceCount?: FormDataEntryValue | number | string | null;
  freeResponseCount?: FormDataEntryValue | number | string | null;
} = {}): QuizQuestionPlan {
  const questionCount = clampQuestionCount(input.questionCount);
  const providedMultipleChoice = numericValue(input.multipleChoiceCount);
  const providedFreeResponse = numericValue(input.freeResponseCount);
  const multipleChoiceCount = clampMultipleChoiceCount(
    providedMultipleChoice === null && providedFreeResponse !== null
      ? questionCount - providedFreeResponse
      : input.multipleChoiceCount,
    questionCount
  );

  return {
    questionCount,
    multipleChoiceCount,
    freeResponseCount: questionCount - multipleChoiceCount
  };
}
