import { NextResponse } from "next/server";
import { auditEventData } from "@/lib/audit";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";
import { evaluateStudentSafety } from "@/lib/student-safety";

export const runtime = "nodejs";

function questionPointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / questionCount);
  return base + (sortOrder <= 100 % questionCount ? 1 : 0);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    assertSameOrigin(request);
    const student = await getStudentSession();
    if (!student?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;
    await enforceRateLimit({
      scope: "student-submit-answer",
      limit: 120,
      windowSeconds: 60 * 60,
      identifier: `${student.studentId}:${sessionId}`
    });
    await clearExpiredRateLimits();
    const body = (await request.json()) as {
      questionId?: string;
      answerText?: string;
      timedOut?: boolean;
    };
    const answerText = String(body.answerText ?? "").trim().slice(0, 4000);
    if (!body.questionId || (!answerText && !body.timedOut)) {
      return NextResponse.json({ error: "Missing answer" }, { status: 400 });
    }

    const session = await prisma.studentSession.findFirst({
      where: {
        id: sessionId,
        ...(student.schoolId ? { schoolId: student.schoolId } : {}),
        studentId: student.studentId
      },
      include: {
        material: { include: { questions: true } },
        answers: { where: { questionId: body.questionId } }
      }
    });
    if (!session || session.status === "COMPLETED") {
      return NextResponse.json({ error: "Session not available" }, { status: 409 });
    }

    const question = session.material.questions.find((item) => item.id === body.questionId);
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const existing = session.answers[0];
    const choices = question.choicesJson ? (JSON.parse(question.choicesJson) as string[]) : [];
    const isMultipleChoice = choices.length > 0 && Boolean(question.correctAnswer);
    const alreadyLocked = Boolean(
      existing &&
        (existing.isCorrect === true || existing.revealedAnswer || (!isMultipleChoice && existing.answerText))
    );
    if (alreadyLocked && existing) {
      return NextResponse.json({
        isCorrect: existing.isCorrect,
        attemptCount: existing.attemptCount,
        pointsEarned: existing.pointsEarned,
        revealedAnswer: existing.revealedAnswer,
        correctAnswer: existing.revealedAnswer ? question.correctAnswer : null,
        explanation: question.explanation,
        locked: true,
        totalPoints: session.pointsEarned
      });
    }

    const isAtHome = session.material.activityKind === "AT_HOME";
    const attemptCount = isAtHome
      ? 1
      : body.timedOut
        ? 3
        : Math.min(3, Math.max(0, existing?.attemptCount || 0) + 1);
    const isCorrect = isMultipleChoice
      ? !body.timedOut && answerText.toLowerCase() === question.correctAnswer?.trim().toLowerCase()
      : null;
    const revealedAnswer = Boolean(isMultipleChoice && isCorrect === false && (isAtHome || attemptCount >= 3));
    const pointsPossible = isAtHome ? 0 : questionPointValue(question.sortOrder, session.material.questions.length);
    const pointsEarned = isCorrect === true && (isAtHome || attemptCount === 1)
      ? pointsPossible
      : 0;
    const storedAnswer = body.timedOut ? "Time expired before an answer was submitted." : answerText;
    const safetySignal = body.timedOut ? evaluateStudentSafety("") : evaluateStudentSafety(storedAnswer);
    const safetyFlagCategories = safetySignal.flagged ? safetySignal.categories.join(",") : null;
    const safetyFlaggedAt = safetySignal.flagged ? new Date() : null;

    const answer = await prisma.studentAnswer.upsert({
      where: { sessionId_questionId: { sessionId, questionId: question.id } },
      create: {
        schoolId: session.schoolId,
        sessionId,
        questionId: question.id,
        answerText: storedAnswer,
        isCorrect,
        attemptCount,
        firstTryCorrect: isCorrect === true && attemptCount === 1,
        pointsEarned,
        revealedAnswer,
        safetyFlagCategories,
        safetyFlaggedAt
      },
      update: {
        answerText: storedAnswer,
        isCorrect,
        attemptCount,
        firstTryCorrect: isCorrect === true ? attemptCount === 1 : existing?.firstTryCorrect,
        pointsEarned,
        revealedAnswer,
        safetyFlagCategories: safetySignal.flagged ? safetyFlagCategories : existing?.safetyFlagCategories ?? null,
        safetyFlaggedAt: safetySignal.flagged ? safetyFlaggedAt : existing?.safetyFlaggedAt ?? null
      }
    });

    const total = await prisma.studentAnswer.aggregate({
      where: { sessionId, schoolId: session.schoolId },
      _sum: { pointsEarned: true }
    });
    const totalPoints = total._sum.pointsEarned || 0;
    await prisma.studentSession.updateMany({
      where: { id: sessionId, schoolId: session.schoolId },
      data: {
        lastSeenAt: new Date(),
        answeredPrompt: true,
        madePrediction: session.madePrediction || question.type === "PREDICTION",
        pointsEarned: totalPoints,
        ...(safetySignal.flagged && !session.flaggedAt ? { flaggedAt: safetyFlaggedAt } : {})
      }
    });

    if (safetySignal.flagged) {
      await prisma.auditEvent.create({
        data: auditEventData({
          schoolId: session.schoolId,
          actorType: "student",
          actorId: student.studentId,
          action: "student_answer.safety_flagged",
          targetType: "student_answer",
          targetId: answer.id,
          metadata: {
            sessionId,
            questionId: question.id,
            categories: safetySignal.categories.join(","),
            severity: safetySignal.severity
          }
        })
      });
    }

    return NextResponse.json({
      isCorrect,
      attemptCount,
      pointsEarned,
      revealedAnswer,
      correctAnswer: revealedAnswer ? question.correctAnswer : null,
      explanation: isCorrect === true || revealedAnswer || !isMultipleChoice ? question.explanation : null,
      locked: isCorrect === true || revealedAnswer || !isMultipleChoice,
      totalPoints,
      safetyFlagged: safetySignal.flagged,
      safetyNotice: safetySignal.studentNotice
    });
  } catch (error) {
    if (isSameOriginError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Could not submit answer" }, { status: 500 });
  }
}
