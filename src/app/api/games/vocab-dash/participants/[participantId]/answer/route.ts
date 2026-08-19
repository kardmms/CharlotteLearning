import { NextResponse } from "next/server";
import { GameRoomStatus } from "@prisma/client";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";
import {
  buildVocabDashQuestion,
  incorrectAnswers,
  progressPercent,
  starsForPlacement,
  streakTermIds
} from "@/lib/vocab-dash";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    assertSameOrigin(request);
    const { participantId } = await params;
    const student = await getStudentSession();
    if (!student?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await enforceRateLimit({
      scope: "vocab-dash-answer",
      limit: 240,
      windowSeconds: 60 * 60,
      identifier: participantId
    });
    await clearExpiredRateLimits();
    const body = await request.json().catch(() => ({})) as { termId?: string; answerText?: string };
    const termId = String(body.termId || "");
    const answerText = String(body.answerText || "").trim().slice(0, 500);

    const result = await prisma.$transaction(async (transaction) => {
      const participant = await transaction.gameParticipant.findUnique({
        where: { id: participantId },
        include: {
          room: {
            include: {
              vocabTerms: { orderBy: { sortOrder: "asc" } }
            }
          }
        }
      });

      if (!participant || participant.room.kind !== "VOCAB_DASH" || participant.studentId !== student.studentId) {
        return { status: 404 as const, payload: { error: "Participant not found." } };
      }
      if (participant.completedAt) {
        return {
          status: 200 as const,
          payload: {
            status: "COMPLETED",
            correct: true,
            streak: participant.currentStreak,
            termCount: participant.room.vocabTerms.length,
            finishRank: participant.finishRank,
            starsEarned: participant.starsEarned,
            incorrectAnswers: incorrectAnswers(participant.incorrectAnswersJson),
            totalAttempts: participant.totalAttempts,
            totalCorrect: participant.totalCorrect,
            roomId: participant.roomId
          }
        };
      }
      if (participant.room.status !== GameRoomStatus.STARTING) {
        return { status: 409 as const, payload: { status: participant.room.status } };
      }

      const terms = participant.room.vocabTerms;
      const term = terms.find((item) => item.id === termId);
      if (!term) return { status: 400 as const, payload: { error: "Question not found." } };

      const correct = term.word.trim().toLowerCase() === answerText.toLowerCase();
      const previousIds = streakTermIds(participant.streakTermIdsJson);
      if (previousIds.includes(term.id)) {
        return { status: 409 as const, payload: { error: "That question was already answered." } };
      }
      const nextIds = [...previousIds, term.id];
      const nextStreak = nextIds.length;
      const termCount = terms.length;
      const completed = nextStreak >= termCount;
      const finishRank = completed
        ? await transaction.gameParticipant.count({
          where: { roomId: participant.roomId, schoolId: participant.schoolId, completedAt: { not: null } }
        }) + 1
        : null;
      const starsEarned = completed && finishRank ? starsForPlacement(finishRank) : 0;
      const previousIncorrect = incorrectAnswers(participant.incorrectAnswersJson);
      const nextIncorrect = correct ? previousIncorrect : [...previousIncorrect, {
        termId: term.id,
        definition: term.definition,
        answer: answerText,
        correctAnswer: term.word
      }];

      const updated = await transaction.gameParticipant.update({
        where: { id: participant.id },
        data: {
          totalAttempts: { increment: 1 },
          totalCorrect: correct ? { increment: 1 } : undefined,
          currentStreak: nextStreak,
          streakTermIdsJson: JSON.stringify(nextIds),
          incorrectAnswersJson: JSON.stringify(nextIncorrect),
          starsEarned: completed ? starsEarned : undefined,
          completedAt: completed ? new Date() : undefined,
          finishRank: completed ? finishRank : undefined
        }
      });

      if (completed) {
        const enrollment = await transaction.student.findFirst({
          where: { id: participant.studentId || "", schoolId: participant.schoolId },
          select: { accountId: true }
        });
        if (enrollment?.accountId) {
          await transaction.studentAccount.update({
            where: { id: enrollment.accountId },
            data: { stars: { increment: starsEarned } }
          });
        }
        const [participantCount, completedCount] = await Promise.all([
          transaction.gameParticipant.count({ where: { roomId: participant.roomId, schoolId: participant.schoolId } }),
          transaction.gameParticipant.count({ where: { roomId: participant.roomId, schoolId: participant.schoolId, completedAt: { not: null } } })
        ]);
        if (participantCount >= 2 && completedCount >= participantCount) {
          await transaction.gameRoom.update({
            where: { id: participant.roomId },
            data: { status: GameRoomStatus.COMPLETED, endedAt: new Date() }
          });
        }
      }

      return {
        status: 200 as const,
        payload: {
          status: completed ? "COMPLETED" : "PLAYING",
          correct,
          correctAnswer: term.word,
          streak: updated.currentStreak,
          termCount,
          progress: progressPercent(updated.currentStreak, termCount),
          finishRank,
          starsEarned,
          totalAttempts: updated.totalAttempts,
          totalCorrect: updated.totalCorrect,
          accuracy: updated.totalAttempts ? Math.round((updated.totalCorrect / updated.totalAttempts) * 100) : 0,
          incorrectAnswers: nextIncorrect,
          roomId: participant.roomId,
          question: completed ? null : buildVocabDashQuestion({
            terms,
            answeredTermIds: nextIds,
            questionOrderIds: streakTermIds(participant.questionOrderJson)
          })
        }
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
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
    return NextResponse.json({ error: "Could not submit answer." }, { status: 500 });
  }
}
