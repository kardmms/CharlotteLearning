import { ActivityKind, MaterialStatus, SessionStatus } from "@prisma/client";
import { auditEventData } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TEST_CLASSROOM_ID = "cmt0du0mo0001jx04delpsdnr";
const TEST_MATERIAL_ID = "cmt0fcpi4000jl3045lxslupo";
const TEST_ASSIGNMENT_TITLE = "Admin Realtime Test Assignment";

function pointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / questionCount);
  return base + (sortOrder <= 100 % questionCount ? 1 : 0);
}

async function completeRealtimeTestAssignment() {
  "use server";

  const admin = await requireAdmin();
  const material = await prisma.material.findFirst({
    where: {
      id: TEST_MATERIAL_ID,
      classroomId: TEST_CLASSROOM_ID,
      title: TEST_ASSIGNMENT_TITLE,
      status: MaterialStatus.PUBLISHED
    },
    include: { questions: { orderBy: { sortOrder: "asc" } } }
  });

  if (!material) throw new Error("Test assignment not found");

  const students = await prisma.student.findMany({
    where: {
      classroomId: TEST_CLASSROOM_ID,
      active: true,
      accountId: { not: null },
      email: { endsWith: "@example.test" }
    },
    orderBy: { displayName: "asc" }
  });

  if (!students.length || !material.questions.length) throw new Error("No test data found");

  const questionPoints = new Map(
    material.questions.map((question) => [
      question.id,
      material.activityKind === ActivityKind.AT_HOME
        ? 10
        : pointValue(question.sortOrder, material.questions.length)
    ])
  );
  const totalPoints = Array.from(questionPoints.values()).reduce((sum, points) => sum + points, 0);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    let answerCount = 0;

    for (const student of students) {
      const session =
        (await transaction.studentSession.findFirst({
          where: { studentId: student.id, materialId: material.id },
          orderBy: { signInAt: "desc" }
        })) ||
        (await transaction.studentSession.create({
          data: {
            schoolId: material.schoolId,
            studentId: student.id,
            materialId: material.id,
            signInAt: now,
            lastSeenAt: now
          }
        }));

      for (const question of material.questions) {
        const pointsEarned = questionPoints.get(question.id) || 0;
        await transaction.studentAnswer.upsert({
          where: { sessionId_questionId: { sessionId: session.id, questionId: question.id } },
          create: {
            schoolId: material.schoolId,
            sessionId: session.id,
            questionId: question.id,
            answerText: `Test completion response from ${student.displayName}.`,
            isCorrect: question.choicesJson ? true : null,
            attemptCount: 1,
            firstTryCorrect: question.choicesJson ? true : null,
            pointsEarned,
            revealedAnswer: false
          },
          update: {
            answerText: `Test completion response from ${student.displayName}.`,
            isCorrect: question.choicesJson ? true : null,
            attemptCount: 1,
            firstTryCorrect: question.choicesJson ? true : null,
            pointsEarned,
            revealedAnswer: false
          }
        });
        answerCount += 1;
      }

      await transaction.studentSession.update({
        where: { id: session.id },
        data: {
          signedOutAt: now,
          lastSeenAt: now,
          completedAt: now,
          status: SessionStatus.COMPLETED,
          openedBook: true,
          foundChapter: true,
          heardVocabulary: true,
          answeredPrompt: true,
          madePrediction: material.questions.some((question) => question.type === "PREDICTION"),
          completedCharlotte: true,
          understoodStory: true,
          pointsEarned: totalPoints
        }
      });
    }

    await transaction.auditEvent.create({
      data: auditEventData({
        schoolId: material.schoolId,
        actorType: "admin",
        actorId: admin.id,
        action: "test_assignment.completed",
        targetType: "material",
        targetId: material.id,
        metadata: {
          classroomId: TEST_CLASSROOM_ID,
          studentCount: students.length,
          answerCount
        }
      })
    });
  });
}

export default async function AdminRealtimeRunPage() {
  await requireAdmin();

  return (
    <main style={{ color: "#0f172a", fontFamily: "system-ui, sans-serif", padding: 48 }}>
      <h1>Complete Admin Realtime Test Assignment</h1>
      <form action={completeRealtimeTestAssignment}>
        <button
          type="submit"
          style={{
            background: "#2563eb",
            border: 0,
            borderRadius: 8,
            color: "white",
            font: "inherit",
            fontWeight: 700,
            padding: "14px 20px"
          }}
        >
          Complete 12 test students
        </button>
      </form>
    </main>
  );
}
