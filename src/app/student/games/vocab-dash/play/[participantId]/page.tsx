import { notFound } from "next/navigation";
import { VocabDashPlayer } from "@/components/VocabDashPlayer";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VocabDashPlayPage({
  params
}: {
  params: Promise<{ participantId: string }>;
}) {
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
  if (!participant || participant.room.kind !== "VOCAB_DASH") notFound();

  return (
    <VocabDashPlayer
      participantId={participant.id}
      displayName={participant.displayName}
      roomCode={participant.room.code}
      initialStatus={participant.room.status}
      termCount={participant.room.vocabTerms.length}
    />
  );
}
