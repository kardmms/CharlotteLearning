import { StudentAvatar } from "@/components/StudentAvatar";
import { notFound, redirect } from "next/navigation";
import { GameRoomStatus } from "@prisma/client";
import Link from "next/link";
import { CheckCircle2, Pencil, Rocket, UsersRound } from "lucide-react";
import { startVocabDashRoom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { VocabDashFullscreenButton } from "@/components/VocabDashFullscreenButton";
import { VocabDashRoomRefresh } from "@/components/VocabDashRoomRefresh";
import { VocabDashStartButton } from "@/components/VocabDashStartButton";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gamesFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function VocabDashRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!gamesFeatureEnabled()) notFound();
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const teacher = await requireTeacher();
  const room = await prisma.gameRoom.findFirst({
    where: { id: roomId, teacherId: teacher.id, schoolId: teacher.schoolId },
    include: {
      participants: {
        where: { schoolId: teacher.schoolId },
        orderBy: { joinedAt: "asc" }
      }
    }
  });

  if (!room) notFound();
  if (room.status !== GameRoomStatus.WAITING) {
    redirect(`/teacher/games/vocab-dash/rooms/${room.id}/leaderboard`);
  }

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <VocabDashRoomRefresh active />
      <main className="page vocab-dash-room-page" id="vocab-dash-projector">
        <div className="vocab-dash-projector-controls">
          <VocabDashFullscreenButton targetId="vocab-dash-projector" />
        </div>
        <section className="vocab-dash-room-hero">
          <div className="vocab-dash-room-title">
            <span className="game-card-icon">
              <Rocket size={30} />
            </span>
            <div>
              <div className="eyebrow">Waiting room</div>
              <h1>Vocab Dash</h1>
            </div>
          </div>
          <div className="room-code-panel" aria-label="Student room code">
            <span>Student code</span>
            <strong>{room.code}</strong>
            <small>Join at /play</small>
          </div>
          <div className="room-hero-actions">
            <form action={startVocabDashRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <VocabDashStartButton participantCount={room.participants.length} />
            </form>
          </div>
        </section>

        <Message error={query.error} />

        <Link className="ghost-button vocab-edit-words-link" href={`/teacher/games/vocab-dash/rooms/${room.id}/setup`}>
          <Pencil size={17} /> Edit words
        </Link>

        <section className="panel vocab-dash-waiting-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Joined students</div>
              <h2>Waiting Room</h2>
            </div>
            <div className="room-count-chip">
              <UsersRound size={17} />
              {room.participants.length}
            </div>
          </div>

          {room.participants.length > 0 ? (
            <div className="joined-student-grid">
              {room.participants.map((participant) => (
                <div className="joined-student-card" key={participant.id}>
                  <StudentAvatar color={participant.characterColor} accessoryKey={participant.accessoryKey} size={52} />
                  <div>
                    <strong>{participant.displayName}</strong>
                    <span>Ready to play</span>
                  </div>
                  <CheckCircle2 size={18} />
                </div>
              ))}
            </div>
          ) : (
            <div className="vocab-dash-empty">
              <UsersRound size={26} />
              <h3>No students have joined yet</h3>
              <p>Students sign in, open Games, and enter the code above.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
