import { NextResponse } from "next/server";
import { GameRoomStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildVocabDashQuestion, progressPercent, streakTermIds } from "@/lib/vocab-dash";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await params;
  const participant = await prisma.gameParticipant.findUnique({
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
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const termCount = participant.room.vocabTerms.length;
  if (participant.completedAt) {
    return NextResponse.json({
      status: "COMPLETED",
      streak: participant.currentStreak,
      termCount,
      finishRank: participant.finishRank,
      accuracy: participant.totalAttempts ? Math.round((participant.totalCorrect / participant.totalAttempts) * 100) : 0
    });
  }

  if (participant.room.status === GameRoomStatus.WAITING) {
    return NextResponse.json({
      status: "WAITING",
      streak: participant.currentStreak,
      termCount,
      progress: progressPercent(participant.currentStreak, termCount)
    });
  }

  if (participant.room.status === GameRoomStatus.COMPLETED) {
    return NextResponse.json({ status: "COMPLETED", streak: participant.currentStreak, termCount });
  }

  return NextResponse.json({
    status: "PLAYING",
    streak: participant.currentStreak,
    termCount,
    progress: progressPercent(participant.currentStreak, termCount),
    question: buildVocabDashQuestion({
      terms: participant.room.vocabTerms,
      streakTermIds: streakTermIds(participant.streakTermIdsJson)
    })
  });
}
