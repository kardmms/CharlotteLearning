import Link from "next/link";
import { Gamepad2, LockKeyhole, Rocket } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";

export const dynamic = "force-dynamic";

const comingSoonGames = [
  {
    title: "Example Game 1",
    copy: "Coming soon."
  },
  {
    title: "Example Game 2",
    copy: "Coming soon."
  },
  {
    title: "Example Game 3",
    copy: "Coming soon."
  }
];

export default async function TeacherGamesPage({
  searchParams
}: {
  searchParams: Promise<{ classroomId?: string }>;
}) {
  const teacher = await requireTeacher();
  const query = await searchParams;
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, schoolId: teacher.schoolId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, gradeLevel: true }
  });
  const selectedClassroom =
    classrooms.find((classroom) => classroom.id === query.classroomId) ||
    classrooms[0];
  const vocabDashHref = selectedClassroom
    ? `/teacher/games/vocab-dash/new?classroomId=${selectedClassroom.id}`
    : "/teacher/classes/new";

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={selectedClassroom?.id} />
      <main className="page">
        <section className="workspace-heading games-heading">
          <div>
            <div className="eyebrow">Teacher games</div>
            <h1>Games</h1>
            <p>
              {selectedClassroom
                ? `Open a room for ${selectedClassroom.name} - ${gradeLabel(selectedClassroom.gradeLevel)}.`
                : "Create a classroom first, then open a game room for that class."}
            </p>
          </div>
          <Gamepad2 size={34} color="#7c3aed" />
        </section>

        <section className="games-grid" aria-label="Available classroom games">
          <Link className="game-launch-card vocab-dash-card" href={vocabDashHref}>
              <span className="game-card-icon">
                <Rocket size={26} />
              </span>
              <span>
                <span className="game-card-title">Vocab Dash</span>
                <span className="game-card-copy">
                  Students will race by answering every vocabulary question correctly in a row.
                </span>
              </span>
          </Link>
          {comingSoonGames.map((game) => (
            <article className="game-locked-card" aria-disabled="true" key={game.title}>
              <span className="game-card-icon locked">
                <LockKeyhole size={24} />
              </span>
              <span>
                <span className="game-card-title">{game.title}</span>
                <span className="game-card-copy">{game.copy}</span>
              </span>
              <span className="game-card-status locked">
                <LockKeyhole size={16} />
                Coming soon
              </span>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
