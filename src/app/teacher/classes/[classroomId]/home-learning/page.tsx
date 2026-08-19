import { BookOpenCheck, FileQuestion, FileText, Gamepad2, Sparkles, Star, Trophy, UsersRound } from "lucide-react";
import { ClassNav } from "@/components/ClassNav";
import { Message } from "@/components/Message";
import { TeacherTopbar } from "@/components/AppTopbar";
import { requireTeacher } from "@/lib/auth";
import { formatDateTime } from "@/lib/date-groups";
import { prisma } from "@/lib/db";
import { homeLearningDayKey } from "@/lib/home-learning";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomeLearningPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id, schoolId: teacher.schoolId },
    include: {
      homeResources: { where: { schoolId: teacher.schoolId }, orderBy: { createdAt: "desc" } },
      materials: {
        where: { schoolId: teacher.schoolId, activityKind: "IN_CLASS", isAdaptiveHome: false },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { questions: true } } }
      },
      gameRooms: {
        where: { schoolId: teacher.schoolId, vocabTerms: { some: {} } },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { vocabTerms: true } } }
      },
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        include: {
          account: { select: { stars: true } },
          sessions: {
            where: { schoolId: teacher.schoolId, material: { activityKind: "AT_HOME", isAdaptiveHome: true } },
            include: {
              material: { select: { seriesKey: true } },
              _count: { select: { answers: true } }
            }
          }
        }
      }
    }
  });
  if (!classroom) notFound();

  const todayKey = `adaptive-home:${homeLearningDayKey()}`;
  const leaderboard = classroom.students.map((student) => {
    const sessions = student.sessions;
    const activeDays = new Set(sessions.map((session) => session.material.seriesKey).filter(Boolean)).size;
    const todaySession = sessions.find((session) => session.material.seriesKey === todayKey);
    return {
      id: student.id,
      name: student.displayName,
      points: student.account?.stars || 0,
      answers: sessions.reduce((sum, session) => sum + session._count.answers, 0),
      activeDays,
      today: todaySession ? (todaySession.status === "IN_PROGRESS" ? "In progress" : "Complete") : "Not started",
      lastSeen: sessions.length
        ? sessions.reduce((latest, session) => session.lastSeenAt > latest ? session.lastSeenAt : latest, sessions[0].lastSeenAt)
        : null
    };
  }).sort((a, b) => b.points - a.points || b.answers - a.answers || a.name.localeCompare(b.name));
  const participatingToday = leaderboard.filter((student) => student.today !== "Not started").length;
  const totalPoints = leaderboard.reduce((sum, student) => sum + student.points, 0);

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroom.id} />
      <main className="page">
        <section className="workspace-heading home-learning-heading">
          <div>
            <div className="eyebrow">Optional extra practice</div>
            <h1>Practice library</h1>
            <p>Charlotte automatically reuses class assignments and Vocab Dash words students have already covered.</p>
          </div>
          <div className="home-learning-badge"><Sparkles size={20} /> Built from class learning</div>
        </section>
        <ClassNav classroomId={classroom.id} />
        <Message success={query.saved ? "Document added to at-home learning." : query.deleted ? "Document removed." : undefined} error={query.error} />

        <section className="home-metric-grid">
          <div><UsersRound size={22} /><span>Participating today</span><strong>{participatingToday}/{classroom.students.length}</strong></div>
          <div><Star size={22} /><span>Class points</span><strong>{totalPoints}</strong></div>
          <div><BookOpenCheck size={22} /><span>Covered content sets</span><strong>{classroom.materials.length + classroom.gameRooms.length}</strong></div>
        </section>

        <section className="panel home-resource-panel">
          <div className="panel-header">
            <div><div className="eyebrow">Automatic practice sources</div><h2>Covered class content</h2></div>
          </div>
          <p>New class activities and Vocab Dash sets appear here automatically. Students choose when they want extra practice.</p>

          <div className="home-resource-grid">
            {classroom.materials.map((material) => (
              <article className="home-resource-card linked" key={material.id}>
                <div className="home-resource-thumb"><FileQuestion size={28} /></div>
                <div>
                  <span>Class assignment</span>
                  <strong>{material.sourceName || material.title}</strong>
                  <small>{material.sourceName ? material.title : `${material._count.questions} manual questions`} · {material.atHomeScope || "All assigned content"}</small>
                </div>
              </article>
            ))}
            {classroom.gameRooms.map((room) => (
              <article className="home-resource-card linked" key={room.id}>
                <div className="home-resource-thumb"><Gamepad2 size={28} /></div>
                <div>
                  <span>Vocab Dash set</span>
                  <strong>{room._count.vocabTerms} vocabulary words</strong>
                  <small>Flashcards and solo practice are available to students.</small>
                </div>
              </article>
            ))}
            {classroom.homeResources.map((resource) => (
              <article className="home-resource-card" key={resource.id}>
                <div className="home-resource-thumb"><FileText size={28} /></div>
                <div>
                  <span>Previously uploaded source</span>
                  <strong>{resource.sourceName}</strong>
                  <small>{resource.title} · {resource.readingScope || "All document content"}</small>
                </div>
              </article>
            ))}
            {classroom.materials.length + classroom.homeResources.length + classroom.gameRooms.length === 0 && (
              <div className="empty-state"><h3>No covered content yet</h3><p>Practice appears after this class completes an assignment or uses a Vocab Dash word set.</p></div>
            )}
          </div>
        </section>

        <section className="panel home-leaderboard-panel">
          <div className="panel-header">
            <div><div className="eyebrow">Participation and motivation</div><h2><Trophy size={24} /> At-home leaderboard</h2></div>
          </div>
          <div className="doc-list">
            <div className="doc-list-head home-leaderboard-head"><span>Rank</span><span>Student</span><span>Today</span><span>Questions</span><span>Active days</span><span>Points</span><span>Last active</span></div>
            {leaderboard.map((student, index) => (
              <div className="doc-row home-leaderboard-row" key={student.id}>
                <strong className="leaderboard-rank">{index + 1}</strong>
                <strong>{student.name}</strong>
                <span className={`status-pill ${student.today === "Complete" ? "status-green" : student.today === "In progress" ? "status-yellow" : "status-red"}`}>{student.today}</span>
                <span>{student.answers}</span>
                <span>{student.activeDays}</span>
                <strong>{student.points} stars</strong>
                <span>{student.lastSeen ? formatDateTime(student.lastSeen) : "Not yet"}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
