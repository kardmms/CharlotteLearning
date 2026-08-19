import { notFound } from "next/navigation";
import { GameRoomStatus } from "@prisma/client";
import Link from "next/link";
import { CheckCircle2, Clock3, Pencil, Rocket, UsersRound } from "lucide-react";
import { startVocabDashRoom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { VocabDashFullscreenButton } from "@/components/VocabDashFullscreenButton";
import { VocabDashLobbyGuard } from "@/components/VocabDashLobbyGuard";
import { VocabDashRoomRefresh } from "@/components/VocabDashRoomRefresh";
import { VocabDashStartButton } from "@/components/VocabDashStartButton";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const characterLabels: Record<string, string> = {
  runner: "Runner",
  rocket: "Rocket",
  star: "Star",
  comet: "Comet",
  bolt: "Bolt",
  compass: "Compass",
  spark: "Spark"
};

export default async function VocabDashRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
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

  const isStarting = room.status === GameRoomStatus.STARTING;

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <VocabDashRoomRefresh active={!isStarting} />
      {!isStarting && <VocabDashLobbyGuard roomId={room.id} />}
      <main className="page vocab-dash-room-page" id="vocab-dash-projector">
        <div className="vocab-dash-projector-controls">
          <VocabDashFullscreenButton targetId="vocab-dash-projector" />
        </div>
        <section className={`vocab-dash-room-hero ${isStarting ? "is-starting" : ""}`}>
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
            <small>Join at charlottelearning.ai/play</small>
          </div>
          <div className="room-hero-actions">
            {isStarting ? (
              <div className="game-starting-banner" role="status">
                <Clock3 size={20} />
                Game Starting...
              </div>
            ) : (
              <form action={startVocabDashRoom}>
                <input type="hidden" name="roomId" value={room.id} />
                <VocabDashStartButton participantCount={room.participants.length} />
              </form>
            )}
          </div>
        </section>

        <Message error={query.error} />

        {!isStarting && (
          <Link className="ghost-button vocab-edit-words-link" href={`/teacher/games/vocab-dash/rooms/${room.id}/setup`}>
            <Pencil size={17} /> Edit words
          </Link>
        )}

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
                  <span className={`joined-character color-${participant.characterColor || "blue"}`}>
                    {characterLabels[participant.characterKey]?.slice(0, 1) || "V"}
                  </span>
                  <div>
                    <strong>{participant.displayName}</strong>
                    <span>{characterLabels[participant.characterKey] || "Vocab Dash"}</span>
                  </div>
                  <CheckCircle2 size={18} />
                </div>
              ))}
            </div>
          ) : (
            <div className="vocab-dash-empty">
              <UsersRound size={26} />
              <h3>No students have joined yet</h3>
              <p>Students sign in at charlottelearning.ai/play and enter the code above.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
