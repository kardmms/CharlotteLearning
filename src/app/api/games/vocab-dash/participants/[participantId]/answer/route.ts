import { NextResponse } from "next/server";
import { GameRoomStatus, Prisma } from "@prisma/client";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";
import {
  buildVocabDashQuestion,
  incorrectAnswers,
  nextVocabDashTerm,
  progressPercent,
  starsForPlacement,
  streakTermIds
} from "@/lib/vocab-dash";
import { gamesFeatureEnabled } from "@/lib/features";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  if (!gamesFeatureEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      const participantRoom = await transaction.gameParticipant.findFirst({
        where: { id: participantId, studentId: student.studentId },
        select: { roomId: true }
      });
      if (!participantRoom) {
        return { status: 404 as const, payload: { error: "Participant not found." } };
      }
      // Take the room lock first, matching the teacher's end-game transaction.
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "GameRoom" WHERE "id" = ${participantRoom.roomId} FOR UPDATE`
      );
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
            accuracy: participant.totalAttempts ? Math.round((participant.totalCorrect / participant.totalAttempts) * 100) : 0,
            roomId: participant.roomId
          }
        };
      }
      if (participant.room.status !== GameRoomStatus.STARTING) {
        return { status: 409 as const, payload: { status: participant.room.status } };
      }

      const terms = participant.room.vocabTerms;
      const previousIds = streakTermIds(participant.streakTermIdsJson);
      const questionOrderIds = streakTermIds(participant.questionOrderJson);
      const term = nextVocabDashTerm({ terms, answeredTermIds: previousIds, questionOrderIds });
      if (!term || term.id !== termId) {
        return { status: 409 as const, payload: { error: "That question is no longer active. Loading the current question." } };
      }

      const correct = term.word.trim().toLowerCase() === answerText.toLowerCase();
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
            questionOrderIds
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
