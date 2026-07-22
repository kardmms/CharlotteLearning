import { NextResponse } from "next/server";
import { generateQuestionsFromText } from "@/lib/ai";
import { extractTextFromUpload } from "@/lib/extract-text";
import { showcaseQuestions, type ShowcaseQuestion } from "@/lib/showcase-data";
import { disabledShowcaseResponse, showcaseRuntimeEnabled } from "@/lib/showcase-runtime";

export const dynamic = "force-dynamic";

function fallbackMultipleChoice(question: ShowcaseQuestion, index: number): ShowcaseQuestion {
  if (question.choices.length) return question;
  const answers = [
    "Use one clear detail from the excerpt",
    "Guess without rereading",
    "Write about a different part",
    "Leave the answer blank"
  ];
  return {
    ...question,
    id: `${question.id}-mc`,
    type: index % 2 === 0 ? "COMPREHENSION" : "VOCAB",
    prompt: question.prompt.replace(/use one clue\.?/i, "which answer uses the best clue?"),
    choices: answers,
    correctAnswer: answers[0],
    explanation: "The best response uses a detail from the excerpt."
  };
}

function normalizeQuestion(question: Partial<ShowcaseQuestion>, index: number): ShowcaseQuestion {
  const fallback = showcaseQuestions[index % showcaseQuestions.length];
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice) => String(choice).trim()).filter(Boolean).slice(0, 4)
    : fallback.choices;
  return {
    id: `generated-${index + 1}`,
    type: question.type || fallback.type,
    prompt: String(question.prompt || fallback.prompt).slice(0, 500),
    choices,
    correctAnswer: choices.includes(String(question.correctAnswer || ""))
      ? String(question.correctAnswer)
      : fallback.correctAnswer || choices[0] || "",
    contextExcerpt: String(question.contextExcerpt || fallback.contextExcerpt || "").slice(0, 900),
    sourcePage: String(question.sourcePage || fallback.sourcePage || "Uploaded source").slice(0, 80),
    skillTag: String(question.skillTag || fallback.skillTag).slice(0, 80),
    standardCode: String(question.standardCode || fallback.standardCode).slice(0, 80),
    rubric: String(question.rubric || fallback.rubric || "").slice(0, 900),
    explanation: String(question.explanation || fallback.explanation || "").slice(0, 500),
    difficulty: Math.min(5, Math.max(1, Number(question.difficulty || fallback.difficulty || 3)))
  };
}

export async function POST(request: Request) {
  if (!showcaseRuntimeEnabled()) return disabledShowcaseResponse();

  const formData = await request.formData();
  const title = String(formData.get("title") || "Showcase reading activity").slice(0, 180);
  const gradeLevel = String(formData.get("gradeLevel") || "3").slice(0, 12);
  const multipleChoiceOnly = String(formData.get("multipleChoiceOnly") || "") === "true";
  const file = formData.get("sourceFile");

  try {
    if (!(file instanceof File) || file.size === 0) {
      const questions = multipleChoiceOnly
        ? showcaseQuestions.map(fallbackMultipleChoice).slice(0, 6)
        : showcaseQuestions;
      return NextResponse.json({
        title,
        notes: "Showcase activity loaded from Charlotte's demo reading.",
        questions
      });
    }

    const extracted = await extractTextFromUpload(file);
    const generated = await generateQuestionsFromText({
      title,
      gradeLevel,
      estimatedMinutes: 15,
      text: extracted.text,
      activityLabel: multipleChoiceOnly ? "Multiple-choice follow-up" : "Showcase in-class activity",
      activityFocus: multipleChoiceOnly ? "Multiple-choice follow-up after the first simulation" : ""
    });
    let questions = generated.questions.map(normalizeQuestion);
    if (multipleChoiceOnly) questions = questions.map(fallbackMultipleChoice).filter((question) => question.choices.length);
    return NextResponse.json({
      title,
      sourceName: extracted.sourceName,
      notes: generated.notes || "Charlotte generated this showcase activity from the uploaded text.",
      questions: questions.slice(0, 8)
    });
  } catch (error) {
    const questions = multipleChoiceOnly
      ? showcaseQuestions.map(fallbackMultipleChoice).slice(0, 6)
      : showcaseQuestions;
    return NextResponse.json({
      title,
      notes: error instanceof Error
        ? `Showcase fallback used: ${error.message}`
        : "Showcase fallback activity loaded.",
      questions
    });
  }
}
