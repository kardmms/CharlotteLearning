import { prisma } from "@/lib/db";

export async function finalizeStudentSession({
  sessionId,
  outcome,
  focusViolationCount
}: {
  sessionId: string;
  outcome: "submitted" | "timed-out" | "focus-loss";
  focusViolationCount?: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.studentSession.findUnique({
      where: { id: sessionId },
      include: {
        material: { include: { questions: true } },
        answers: true
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
    return transaction.studentSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        signedOutAt: now,
        completedAt: now,
        status: completed ? "COMPLETED" : "PARTIAL",
        completedCharlotte: completed,
        ...(outcome === "focus-loss"
          ? {
              focusViolationCount: focusViolationCount ?? session.focusViolationCount,
              flaggedAt: session.flaggedAt || now,
              endedByFocusLoss: true
            }
          : {})
      }
    });
  });
}
