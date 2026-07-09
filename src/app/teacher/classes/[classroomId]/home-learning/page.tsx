import { BookOpenCheck, FileQuestion, FileText, Sparkles, Star, Trash2, Trophy, UsersRound } from "lucide-react";
import { deleteAtHomeResource } from "@/app/teacher/actions";
import { ClassNav } from "@/components/ClassNav";
import { HomeResourceUpload } from "@/components/HomeResourceUpload";
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
    where: { id: classroomId, teacherId: teacher.id },
    include: {
      homeResources: { orderBy: { createdAt: "desc" } },
      materials: {
        where: { activityKind: "IN_CLASS", isAdaptiveHome: false },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { questions: true } } }
      },
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        include: {
          sessions: {
            where: { material: { activityKind: "AT_HOME", isAdaptiveHome: true } },
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
      points: sessions.reduce((sum, session) => sum + session.pointsEarned, 0),
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
            <div className="eyebrow">Adaptive daily practice</div>
            <h1>At-home learning</h1>
            <p>Charlotte builds each student a grade-appropriate 20-minute Daily Win from your materials and their learning needs.</p>
          </div>
          <div className="home-learning-badge"><Sparkles size={20} /> Adapts each day</div>
        </section>
        <ClassNav classroomId={classroom.id} />
        <Message success={query.saved ? "Document added to at-home learning." : query.deleted ? "Document removed." : undefined} error={query.error} />

        <section className="home-metric-grid">
          <div><UsersRound size={22} /><span>Participating today</span><strong>{participatingToday}/{classroom.students.length}</strong></div>
          <div><Star size={22} /><span>Class points</span><strong>{totalPoints}</strong></div>
          <div><BookOpenCheck size={22} /><span>Learning sources</span><strong>{classroom.materials.length + classroom.homeResources.length}</strong></div>
        </section>

        <section className="panel home-resource-panel">
          <div className="panel-header">
            <div><div className="eyebrow">Teacher resource library</div><h2>What Charlotte can teach and reinforce</h2></div>
          </div>
          <p>Lesson plans and manual assignments appear automatically. Add more readings or question sheets anytime.</p>
          <HomeResourceUpload classroomId={classroom.id} />

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
            {classroom.homeResources.map((resource) => (
              <article className="home-resource-card" key={resource.id}>
                <div className="home-resource-thumb"><FileText size={28} /></div>
                <div>
                  <span>At-home document</span>
                  <strong>{resource.sourceName}</strong>
                  <small>{resource.title} · {resource.readingScope || "All document content"}</small>
                </div>
                <form action={deleteAtHomeResource}>
                  <input type="hidden" name="classroomId" value={classroom.id} />
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <button className="icon-button danger" type="submit" aria-label={`Delete ${resource.sourceName}`}><Trash2 size={17} /></button>
                </form>
              </article>
            ))}
            {classroom.materials.length + classroom.homeResources.length === 0 && (
              <div className="empty-state"><h3>Add the first learning source</h3><p>Upload a lesson, reading, or question sheet to activate Daily Wins.</p></div>
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
                <strong>{student.points} pts</strong>
                <span>{student.lastSeen ? formatDateTime(student.lastSeen) : "Not yet"}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
