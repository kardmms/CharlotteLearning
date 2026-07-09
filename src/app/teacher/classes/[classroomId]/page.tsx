import Link from "next/link";
import { ArrowRight, BellRing, ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClassOverviewPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ materialId?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id },
    include: {
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" }
      },
      materials: {
        where: { isAdaptiveHome: false },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true, sessions: true } },
          sessions: {
            orderBy: { lastSeenAt: "desc" },
            include: {
              student: true,
              answers: true
            }
          }
        }
      }
    }
  });
  if (!classroom) notFound();

  const activities = classroom.materials.filter(
    (material) => material.status === "PUBLISHED" && material.activityKind === "IN_CLASS"
  );
  const selectedIndex = Math.max(0, activities.findIndex((material) => material.id === query.materialId));
  const latestActivity = activities[selectedIndex];
  const newerActivity = activities[selectedIndex - 1];
  const olderActivity = activities[selectedIndex + 1];
  const latestSessions = latestActivity?.sessions ?? [];
  const completed = latestSessions.filter((session) => session.completedCharlotte).length;
  const completionPct = classroom.students.length
    ? Math.round((completed / classroom.students.length) * 100)
    : 0;
  const gradedAnswers = latestSessions.flatMap((session) =>
    session.answers.filter((answer) => answer.isCorrect !== null)
  );
  const correctAnswers = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const accuracyPct = gradedAnswers.length ? Math.round((correctAnswers / gradedAnswers.length) * 100) : 0;
  const studentRows = classroom.students.map((student) => {
    const session = latestSessions.find((item) => item.studentId === student.id);
    return {
      student,
      session
    };
  });
  const focusAlertCount = studentRows.filter((row) => (row.session?.focusViolationCount ?? 0) > 0).length;

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Class overview</div>
            <h1>{classroom.name}</h1>
            <p>{gradeLabel(classroom.gradeLevel)}</p>
          </div>
          <Link className="button" href={`/teacher/classes/${classroom.id}/materials/new`}>
            <FileUp size={18} />
            Upload material
          </Link>
        </section>
        <ClassNav classroomId={classroom.id} />

        <section className="activity-dashboard" style={{ marginTop: 18 }}>
          <div className="activity-main">
            <div className="activity-title-row">
              <div>
                <div className="eyebrow">{selectedIndex === 0 ? "Most recent activity" : "Previous activity"}</div>
                <h2>{latestActivity?.title ?? "No activity assigned yet"}</h2>
                <p>
                  {latestActivity
                    ? `${latestActivity.status.toLowerCase()} - ${latestActivity.estimatedMinutes} minutes - ${latestActivity._count.questions} questions`
                    : "Upload material to create a station for students."}
                </p>
              </div>
              <div className="activity-title-actions">
                <div className="activity-history-nav" aria-label="Change assignment">
                  {olderActivity ? (
                    <Link href={`?materialId=${olderActivity.id}`} aria-label="Previous assignment">
                      <ChevronLeft size={20} />
                    </Link>
                  ) : <span />}
                  <small>{activities.length ? `${selectedIndex + 1} of ${activities.length}` : "0 of 0"}</small>
                  {newerActivity ? (
                    <Link href={`?materialId=${newerActivity.id}`} aria-label="Next assignment">
                      <ChevronRight size={20} />
                    </Link>
                  ) : <span />}
                </div>
                <Link
                  className={`page-exit-button ${focusAlertCount ? "has-alerts" : ""}`}
                  href={`/teacher/classes/${classroom.id}/progress`}
                >
                  <BellRing size={17} />
                  Page exits
                  <span>{focusAlertCount}</span>
                </Link>
                {latestActivity && (
                  <Link
                    className="ghost-button"
                    href={`/teacher/classes/${classroom.id}/materials/${latestActivity.id}/review`}
                  >
                    Review
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>

            <div className="activity-key-metrics">
              <div>
                <span>Completion</span>
                <strong>{completionPct}%</strong>
                <small>{completed} of {classroom.students.length} students</small>
                <div className="bar"><span style={{ width: `${completionPct}%` }} /></div>
              </div>
              <div>
                <span>Class average</span>
                <strong>{accuracyPct}%</strong>
                <small>{gradedAnswers.length ? "Completed submissions only" : "No graded answers yet"}</small>
                <div className="bar"><span style={{ width: `${accuracyPct}%` }} /></div>
              </div>
            </div>
          </div>

        </section>
      </main>
    </>
  );
}
