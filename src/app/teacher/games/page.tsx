import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Gamepad2, History, Rocket, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { TeacherTopbar } from "@/components/AppTopbar";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gamesFeatureEnabled } from "@/lib/features";
import { gradeLabel } from "@/lib/grade";

export const dynamic = "force-dynamic";

function roomDetails(status: string) {
  if (status === "WAITING") return { label: "Lobby open", icon: <Clock3 size={16} />, className: "waiting" };
  if (status === "STARTING") return { label: "Game live", icon: <Gamepad2 size={16} />, className: "live" };
  return { label: "Completed", icon: <CheckCircle2 size={16} />, className: "completed" };
}

function roomHref(roomId: string, status: string) {
  return status === "WAITING"
    ? `/teacher/games/vocab-dash/rooms/${roomId}`
    : `/teacher/games/vocab-dash/rooms/${roomId}/leaderboard`;
}

export default async function TeacherGamesPage({
  searchParams
}: {
  searchParams: Promise<{ classroomId?: string }>;
}) {
  if (!gamesFeatureEnabled()) notFound();
  const teacher = await requireTeacher();
  const query = await searchParams;
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, schoolId: teacher.schoolId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, gradeLevel: true }
  });
  const selectedClassroom = classrooms.find((classroom) => classroom.id === query.classroomId) || classrooms[0];
  const rooms = selectedClassroom
    ? await prisma.gameRoom.findMany({
        where: {
          teacherId: teacher.id,
          schoolId: teacher.schoolId,
          classroomId: selectedClassroom.id,
          kind: "VOCAB_DASH"
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { _count: { select: { participants: true, vocabTerms: true } } }
      })
    : [];
  const vocabDashHref = selectedClassroom
    ? `/teacher/games/vocab-dash/new?classroomId=${selectedClassroom.id}`
    : "/teacher/classes/new";

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={selectedClassroom?.id} />
      <main className="page teacher-games-page">
        <section className="workspace-heading games-heading">
          <div>
            <div className="eyebrow">Classroom practice</div>
            <h1>Games</h1>
            <p>Launch live, class-connected practice and follow every student&apos;s progress from one screen.</p>
          </div>
          <span className="local-preview-badge"><Gamepad2 size={17} /> Live games</span>
        </section>

        {classrooms.length > 0 && (
          <form className="games-class-picker" method="get">
            <label htmlFor="games-classroom">Class</label>
            <select id="games-classroom" name="classroomId" defaultValue={selectedClassroom?.id}>
              {classrooms.map((classroom) => (
                <option value={classroom.id} key={classroom.id}>{classroom.name} · {gradeLabel(classroom.gradeLevel)}</option>
              ))}
            </select>
            <button className="ghost-button" type="submit">View class</button>
          </form>
        )}

        <section className="games-grid" aria-label="Available classroom games">
          <Link className="game-launch-card vocab-dash-card" href={vocabDashHref}>
            <span className="game-card-icon"><Rocket size={26} /></span>
            <span>
              <span className="game-card-title">Vocab Dash</span>
              <span className="game-card-copy">
                Build a vocabulary set, open a class lobby, and run a live definition race with results and star rewards.
              </span>
            </span>
            <span className="game-card-status">New game <ArrowRight size={16} /></span>
          </Link>
        </section>

        <section className="game-room-history">
          <div className="panel-header">
            <div><div className="eyebrow">Room history</div><h2>{selectedClassroom?.name || "Your games"}</h2></div>
            <History size={22} />
          </div>
          {rooms.length ? (
            <div className="game-room-list">
              {rooms.map((room) => {
                const status = roomDetails(room.status);
                return (
                  <Link className="game-room-row" href={roomHref(room.id, room.status)} key={room.id}>
                    <span className={`game-room-status ${status.className}`}>{status.icon}{status.label}</span>
                    <span><strong>Vocab Dash</strong><small>{room._count.vocabTerms} words · code {room.code}</small></span>
                    <span><UsersRound size={17} /> {room._count.participants}</span>
                    <time>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(room.createdAt)}</time>
                    <ArrowRight size={18} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="games-empty-history">
              <Rocket size={24} />
              <p>{selectedClassroom ? "No games have been created for this class yet." : "Create a class before opening a game."}</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
