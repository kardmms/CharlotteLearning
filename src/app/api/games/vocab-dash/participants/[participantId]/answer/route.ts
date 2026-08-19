import { NextResponse } from "next/server";
import { GameRoomStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";
import { buildVocabDashQuestion, progressPercent, streakTermIds } from "@/lib/vocab-dash";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    assertSameOrigin(request);
    const { participantId } = await params;
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

      if (!participant || participant.room.kind !== "VOCAB_DASH") {
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
            finishRank: participant.finishRank
          }
        };
      }
      if (participant.room.status !== GameRoomStatus.STARTING) {
        return { status: 409 as const, payload: { status: participant.room.status } };
      }

      const terms = participant.room.vocabTerms;
      const term = terms.find((item) => item.id === termId);
      if (!term) return { status: 400 as const, payload: { error: "Question not found." } };

      const correct = term.definition.trim() === answerText;
      const previousIds = streakTermIds(participant.streakTermIdsJson);
      const nextIds = correct ? [...new Set([...previousIds, term.id])] : [];
      const nextStreak = correct ? nextIds.length : 0;
      const termCount = terms.length;
      const completed = correct && nextStreak >= termCount;
      const finishRank = completed
        ? await transaction.gameParticipant.count({
          where: { roomId: participant.roomId, schoolId: participant.schoolId, completedAt: { not: null } }
        }) + 1
        : null;

      const updated = await transaction.gameParticipant.update({
        where: { id: participant.id },
        data: {
          totalAttempts: { increment: 1 },
          totalCorrect: correct ? { increment: 1 } : undefined,
          currentStreak: nextStreak,
          streakTermIdsJson: JSON.stringify(nextIds),
          completedAt: completed ? new Date() : undefined,
          finishRank: completed ? finishRank : undefined
        }
      });

      return {
        status: 200 as const,
        payload: {
          status: completed ? "COMPLETED" : "PLAYING",
          correct,
          correctDefinition: term.definition,
          streak: updated.currentStreak,
          termCount,
          progress: progressPercent(updated.currentStreak, termCount),
          finishRank,
          question: completed ? null : buildVocabDashQuestion({ terms, streakTermIds: nextIds })
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
