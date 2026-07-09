import { notFound, redirect } from "next/navigation";
import { StudentStation } from "@/components/StudentStation";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentBandClass } from "@/lib/grade";

export const dynamic = "force-dynamic";

function parseChoices(choicesJson?: string | null) {
  if (!choicesJson) return [];
  try {
    return JSON.parse(choicesJson) as string[];
  } catch {
    return [];
  }
}

function shuffledChoices(choices: string[], seed: string) {
  const output = [...choices];
  let state = [...seed].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

export default async function StationPage({
  params
}: {
  params: Promise<{ materialId: string }>;
}) {
  const student = await requireStudent();
  const { materialId } = await params;
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      classroomId: student.classroomId,
      status: "PUBLISHED",
      OR: [{ targetStudentId: null }, { targetStudentId: student.id }]
    },
    include: {
      questions: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!material) notFound();

  const finishedSession = await prisma.studentSession.findFirst({
    where: {
      studentId: student.id,
      materialId,
      status: { in: ["COMPLETED", "PARTIAL"] }
    },
    orderBy: { completedAt: "desc" }
  });
  if (finishedSession) redirect(`/student/results/${materialId}`);

  let session = await prisma.studentSession.findFirst({
    where: {
      studentId: student.id,
      materialId,
      status: "IN_PROGRESS"
    },
    include: { answers: true }
  });

  if (!session) {
    session = await prisma.studentSession.create({
      data: {
        studentId: student.id,
        materialId
      },
      include: { answers: true }
    });
  } else {
    session = await prisma.studentSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
      include: { answers: true }
    });
  }

  return (
    <div className={`student-shell ${studentBandClass(student.classroom.gradeLevel)}`}>
      <header className="topbar locked-student-topbar">
        <div className="brand">
          <img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" />
          <span>Charlotte AI</span>
        </div>
        <strong>{student.displayName}</strong>
      </header>
      <main className="page narrow-page">
        <StudentStation
          material={{
            id: material.id,
            title: material.title,
            estimatedMinutes: material.estimatedMinutes,
            activityKind: material.activityKind,
            dueAt: material.dueAt?.toISOString() || null
          }}
          session={{
            id: session.id,
            signInAt: session.signInAt.toISOString(),
            pointsEarned: session.pointsEarned,
            focusViolationCount: session.focusViolationCount
          }}
          questions={material.questions.map((question) => ({
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            choices: question.randomizeChoices
              ? shuffledChoices(parseChoices(question.choicesJson), `${session.id}:${question.id}`)
              : parseChoices(question.choicesJson),
            skillTag: question.skillTag,
            standardCode: question.standardCode,
            explanation: question.explanation,
            timeLimitSeconds: question.timeLimitSeconds,
            existingAnswer:
              session.answers.find((answer) => answer.questionId === question.id)?.answerText || "",
            existingIsCorrect:
              session.answers.find((answer) => answer.questionId === question.id)?.isCorrect ?? null,
            existingAttemptCount:
              session.answers.find((answer) => answer.questionId === question.id)?.attemptCount || 0,
            existingPointsEarned:
              session.answers.find((answer) => answer.questionId === question.id)?.pointsEarned || 0,
            existingRevealed:
              session.answers.find((answer) => answer.questionId === question.id)?.revealedAnswer || false
          }))}
        />
      </main>
    </div>
  );
}
