import { prisma } from "@/lib/db";

export async function finalizeStudentSession({
  sessionId,
  outcome,
  schoolId,
  focusViolationCount
}: {
  sessionId: string;
  outcome: "submitted" | "timed-out" | "focus-loss";
  schoolId?: string;
  focusViolationCount?: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.studentSession.findFirst({
      where: { id: sessionId, ...(schoolId ? { schoolId } : {}) },
      include: {
        material: { include: { questions: true } },
        answers: true,
        student: { select: { accountId: true } }
      }
    });
    if (!session) throw new Error("Session not found");
    if (session.status !== "IN_PROGRESS") return session;

    const answeredQuestionIds = new Set(session.answers.map((answer) => answer.questionId));
    const unansweredQuestions = session.material.questions.filter(
      (question) => !answeredQuestionIds.has(question.id)
    );

    const isAtHome = session.material.activityKind === "AT_HOME";
    if (!isAtHome && unansweredQuestions.length > 0) {
      await transaction.studentAnswer.createMany({
        data: unansweredQuestions.map((question) => ({
          schoolId: session.schoolId,
          sessionId: session.id,
          questionId: question.id,
          answerText: "No response",
          isCorrect: false,
          attemptCount: 0,
          firstTryCorrect: false,
          pointsEarned: 0,
          revealedAnswer: false
        }))
      });
    }

    const completed = isAtHome || (outcome === "submitted" && unansweredQuestions.length === 0);
    const now = new Date();
    const priorHomeCompletion = isAtHome
      ? await transaction.studentSession.count({
          where: {
            id: { not: session.id },
            schoolId: session.schoolId,
            studentId: session.studentId,
            materialId: session.materialId,
            status: "COMPLETED"
          }
        })
      : 0;
    const homeStars = isAtHome && priorHomeCompletion === 0 ? 5 : 0;
    const updated = await transaction.studentSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        signedOutAt: now,
        completedAt: now,
        status: completed ? "COMPLETED" : "PARTIAL",
        completedCharlotte: completed,
        ...(isAtHome ? { pointsEarned: homeStars } : {}),
        ...(outcome === "focus-loss"
          ? {
              focusViolationCount: focusViolationCount ?? session.focusViolationCount,
              flaggedAt: session.flaggedAt || now,
              endedByFocusLoss: true
            }
          : {})
      }
    });
    if (homeStars && session.student.accountId) {
      await transaction.studentAccount.update({
        where: { id: session.student.accountId },
        data: { stars: { increment: homeStars } }
      });
    }
    return updated;
  });
}
