import Link from "next/link";
import { BarChart3, CheckCircle2, CircleAlert, UsersRound } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherAnalyticsPage() {
  const teacher = await requireTeacher();
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, archivedAt: null },
    include: {
      students: {
        where: { active: true },
        include: {
          sessions: {
            orderBy: { signInAt: "desc" },
            take: 1
          }
        }
      },
      _count: { select: { materials: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const questions = await prisma.question.findMany({
    where: { material: { teacherId: teacher.id, classroom: { archivedAt: null } } },
    orderBy: [{ material: { createdAt: "desc" } }, { sortOrder: "asc" }],
    include: {
      material: {
        select: {
          title: true,
          classroom: { select: { id: true, name: true } }
        }
      },
      answers: { select: { isCorrect: true } }
    }
  });

  const questionRows = questions
    .map((question) => {
      const graded = question.answers.filter((answer) => answer.isCorrect !== null);
      const correct = graded.filter((answer) => answer.isCorrect).length;
      return {
        id: question.id,
        skill: question.skillTag || question.type,
        prompt: question.prompt,
        material: question.material.title,
        classId: question.material.classroom.id,
        className: question.material.classroom.name,
        attempts: question.answers.length,
        graded: graded.length,
        correct,
        percent: graded.length ? Math.round((correct / graded.length) * 100) : 0
      };
    })
    .filter((row) => row.attempts > 0)
    .slice(0, 12);

  const totalStudents = classrooms.reduce((sum, classroom) => sum + classroom.students.length, 0);
  const activeStudents = classrooms.reduce(
    (sum, classroom) => sum + classroom.students.filter((student) => student.sessions[0]).length,
    0
  );
  const completedStudents = classrooms.reduce(
    (sum, classroom) =>
      sum + classroom.students.filter((student) => student.sessions[0]?.completedCharlotte).length,
    0
  );
  const avgCorrect = questionRows.length
    ? Math.round(questionRows.reduce((sum, row) => sum + row.percent, 0) / questionRows.length)
    : 0;

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Analytics</div>
            <h1>Classroom performance</h1>
            <p>Readable charts for completion, question accuracy, and class activity.</p>
          </div>
        </section>

        <section className="analytics-strip">
          <div>
            <UsersRound size={20} />
            <strong>{activeStudents}/{Math.max(1, totalStudents)}</strong>
            <span>Students active</span>
          </div>
          <div>
            <CheckCircle2 size={20} />
            <strong>{completedStudents}</strong>
            <span>Latest sessions complete</span>
          </div>
          <div>
            <BarChart3 size={20} />
            <strong>{avgCorrect}%</strong>
            <span>Average graded accuracy</span>
          </div>
          <div>
            <CircleAlert size={20} />
            <strong>{questionRows.filter((row) => row.percent < 70).length}</strong>
            <span>Questions below 70%</span>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-header">
            <div>
              <div className="eyebrow">Question accuracy</div>
              <h2>How many students got each question right</h2>
            </div>
          </div>
          <div className="question-chart">
            {questionRows.map((row, index) => (
              <div className="question-chart-row" key={row.id}>
                <div>
                  <strong>Q{index + 1}. {row.skill}</strong>
                  <span>{row.material}</span>
                </div>
                <div className="horizontal-chart">
                  <span className="correct-segment" style={{ width: `${row.percent}%` }} />
                </div>
                <div className="chart-count">
                  <strong>{row.correct}/{row.graded || row.attempts}</strong>
                  <span>{row.percent}%</span>
                </div>
                <Link className="ghost-button" href={`/teacher/classes/${row.classId}/stats`}>
                  View
                </Link>
              </div>
            ))}
            {questionRows.length === 0 && <p>Question charts appear after students submit answers.</p>}
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 18 }}>
          {classrooms.map((classroom) => {
            const started = classroom.students.filter((student) => student.sessions[0]).length;
            const complete = classroom.students.filter(
              (student) => student.sessions[0]?.completedCharlotte
            ).length;
            const completePct = classroom.students.length
              ? Math.round((complete / classroom.students.length) * 100)
              : 0;
            return (
              <Link className="class-activity-row" href={`/teacher/classes/${classroom.id}`} key={classroom.id}>
                <div>
                  <strong>{classroom.name}</strong>
                  <span>
                    {started}/{classroom.students.length} started - {classroom._count.materials} assignments
                  </span>
                </div>
                <div className="bar">
                  <span style={{ width: `${completePct}%` }} />
                </div>
                <strong>{completePct}% complete</strong>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}
