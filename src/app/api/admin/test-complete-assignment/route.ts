import { ActivityKind, MaterialStatus, SessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { auditEventData } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEST_CLASSROOM_ID = "cmt0du0mo0001jx04delpsdnr";
const TEST_MATERIAL_ID = "cmt0fcpi4000jl3045lxslupo";
const TEST_ASSIGNMENT_TITLE = "Admin Realtime Test Assignment";

function pointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / questionCount);
  return base + (sortOrder <= 100 % questionCount ? 1 : 0);
}

async function readRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as {
      classroomId?: string;
      materialId?: string;
    };
  }

  const formData = await request.formData().catch(() => null);
  return {
    classroomId: formData?.get("classroomId")?.toString(),
    materialId: formData?.get("materialId")?.toString()
  };
}

export async function GET() {
  await requireAdmin();

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Complete Admin Realtime Test Assignment</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 48px; color: #0f172a; }
      button { border: 0; border-radius: 8px; background: #2563eb; color: white; font: inherit; font-weight: 700; padding: 14px 20px; }
    </style>
  </head>
  <body>
    <h1>Complete Admin Realtime Test Assignment</h1>
    <form method="post" action="/api/admin/test-complete-assignment">
      <input type="hidden" name="classroomId" value="${TEST_CLASSROOM_ID}" />
      <input type="hidden" name="materialId" value="${TEST_MATERIAL_ID}" />
      <button type="submit">Complete 12 test students</button>
    </form>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const body = await readRequestBody(request);

  if (body.classroomId !== TEST_CLASSROOM_ID || body.materialId !== TEST_MATERIAL_ID) {
    return NextResponse.json({ error: "Unsupported test target" }, { status: 400 });
  }

  const material = await prisma.material.findFirst({
    where: {
      id: TEST_MATERIAL_ID,
      classroomId: TEST_CLASSROOM_ID,
      title: TEST_ASSIGNMENT_TITLE,
      status: MaterialStatus.PUBLISHED
    },
    include: {
      questions: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!material) {
    return NextResponse.json({ error: "Test assignment not found" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: {
      classroomId: TEST_CLASSROOM_ID,
      active: true,
      accountId: { not: null },
      email: { endsWith: "@example.test" }
    },
    orderBy: { displayName: "asc" }
  });

  if (!students.length || !material.questions.length) {
    return NextResponse.json({ error: "No test students or questions found" }, { status: 409 });
  }

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

  const result = await prisma.$transaction(async (transaction) => {
    let answersUpserted = 0;
    const completedSessionIds: string[] = [];

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
        answersUpserted += 1;
      }

      const completed = await transaction.studentSession.update({
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
      completedSessionIds.push(completed.id);
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
          answerCount: answersUpserted
        }
      })
    });

    return { answersUpserted, completedSessionIds };
  });

  return NextResponse.json({
    ok: true,
    classroomId: TEST_CLASSROOM_ID,
    materialId: TEST_MATERIAL_ID,
    studentCount: students.length,
    questionCount: material.questions.length,
    totalPoints,
    answersUpserted: result.answersUpserted,
    completedSessionIds: result.completedSessionIds
  });
}
