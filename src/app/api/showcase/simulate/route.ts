import { NextResponse } from "next/server";
import { showcaseQuestions, showcaseStudents, type ShowcaseQuestion, type ShowcaseStudent } from "@/lib/showcase-data";
import { disabledShowcaseResponse, showcaseRuntimeEnabled } from "@/lib/showcase-runtime";

export const dynamic = "force-dynamic";

type SimulatedAnswer = {
  questionId: string;
  answerText: string;
  isCorrect: boolean | null;
  pointsEarned: number;
  attemptCount: number;
  quality: "spot-on" | "solid" | "vague" | "incorrect" | "blank";
};

const outcomePattern = [
  "all-right",
  "strong",
  "average",
  "average",
  "vague-writer",
  "struggling",
  "all-wrong",
  "first-try",
  "second-try",
  "third-try",
  "incomplete",
  "improved"
];

function gradeName(gradeLevel: string) {
  const trimmed = gradeLevel.trim();
  if (trimmed.toUpperCase() === "K") return "kindergarten";
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return `${trimmed} grade`;
  if (parsed === 1) return "1st grade";
  if (parsed === 2) return "2nd grade";
  if (parsed === 3) return "3rd grade";
  return `${parsed}th grade`;
}

function writtenAnswer(question: ShowcaseQuestion, quality: SimulatedAnswer["quality"], gradeLevel: string) {
  const grade = gradeName(gradeLevel);
  if (quality === "spot-on") {
    return `Ms. Rivera helped the class learn safely by telling them to take quiet steps and look first. This helped because the students could study the animals without scaring them or breaking anything. This sounds like a strong ${grade} answer.`;
  }
  if (quality === "solid") {
    return "She told them to be quiet and careful near the tide pool. That helped the animals stay safe while the class learned.";
  }
  if (quality === "vague") {
    return "She helped them because she was nice and told them what to do.";
  }
  if (quality === "blank") return "No response";
  return question.type === "PREDICTION"
    ? "They will probably go home because the story is over."
    : "The class learned safely because the ocean was big.";
}

function answerFor({
  studentIndex,
  question,
  questionIndex,
  gradeLevel,
  improvementRun
}: {
  studentIndex: number;
  question: ShowcaseQuestion;
  questionIndex: number;
  gradeLevel: string;
  improvementRun: boolean;
}): SimulatedAnswer {
  const pattern = outcomePattern[studentIndex % outcomePattern.length];
  const possiblePoints = Math.floor(100 / Math.max(1, 6));
  const isWritten = question.choices.length === 0;
  const boost = improvementRun && ["average", "vague-writer", "struggling", "second-try", "third-try"].includes(pattern);
  let correct =
    pattern === "all-right" ||
    pattern === "strong" ||
    pattern === "first-try" ||
    pattern === "improved" ||
    (pattern === "average" && questionIndex % 2 === 0) ||
    (pattern === "vague-writer" && !isWritten && questionIndex % 3 !== 1) ||
    (pattern === "struggling" && questionIndex === 0);
  if (boost && !isWritten && questionIndex % 2 === 0) correct = true;
  if (pattern === "all-wrong") correct = false;
  if (pattern === "incomplete" && questionIndex > 3) {
    return {
      questionId: question.id,
      answerText: "No response",
      isCorrect: false,
      pointsEarned: 0,
      attemptCount: 0,
      quality: "blank"
    };
  }

  if (isWritten) {
    const quality: SimulatedAnswer["quality"] =
      pattern === "all-right" || pattern === "strong" || (boost && questionIndex % 2 === 0)
        ? "spot-on"
        : pattern === "average" || pattern === "improved"
          ? "solid"
          : pattern === "vague-writer" || pattern === "second-try"
            ? "vague"
            : pattern === "incomplete"
              ? "blank"
              : "incorrect";
    return {
      questionId: question.id,
      answerText: writtenAnswer(question, quality, gradeLevel),
      isCorrect: null,
      pointsEarned: 0,
      attemptCount: 1,
      quality
    };
  }

  const wrongChoices = question.choices.filter((choice) => choice !== question.correctAnswer);
  const attemptCount = pattern === "first-try" || correct ? 1 : pattern === "second-try" ? 2 : pattern === "third-try" ? 3 : 2;
  return {
    questionId: question.id,
    answerText: correct ? question.correctAnswer : wrongChoices[(studentIndex + questionIndex) % Math.max(1, wrongChoices.length)] || "No response",
    isCorrect: correct,
    pointsEarned: correct ? possiblePoints : 0,
    attemptCount,
    quality: correct ? "solid" : "incorrect"
  };
}

export async function POST(request: Request) {
  if (!showcaseRuntimeEnabled()) return disabledShowcaseResponse();

  const body = await request.json().catch(() => ({})) as {
    students?: ShowcaseStudent[];
    questions?: ShowcaseQuestion[];
    gradeLevel?: string;
    improvementRun?: boolean;
  };
  const students = Array.isArray(body.students) && body.students.length ? body.students : showcaseStudents;
  const questions = Array.isArray(body.questions) && body.questions.length ? body.questions : showcaseQuestions;
  const gradeLevel = body.gradeLevel || "3";
  const improvementRun = Boolean(body.improvementRun);
  const possiblePoints = Math.floor(100 / Math.max(1, questions.length));
  const sessions = students.map((student, studentIndex) => {
    const answers = questions.map((question, questionIndex) =>
      answerFor({ studentIndex, question, questionIndex, gradeLevel, improvementRun })
    );
    const autoPoints = answers.reduce((sum, answer) => sum + answer.pointsEarned, 0);
    return {
      id: `session-${student.id}-${improvementRun ? "followup" : "initial"}`,
      studentId: student.id,
      studentName: student.displayName,
      email: student.email,
      status: answers.some((answer) => answer.answerText === "No response") ? "PARTIAL" : "COMPLETED",
      answers,
      score: Math.min(100, autoPoints),
      possiblePoints,
      completedAt: new Date(Date.now() - studentIndex * 73_000).toISOString()
    };
  });

  return NextResponse.json({ sessions });
}
