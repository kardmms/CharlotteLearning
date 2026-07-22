import Link from "next/link";
import { ArrowRight, BellRing, ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type AssignmentAnswer = {
  isCorrect: boolean | null;
  firstTryCorrect: boolean | null;
  attemptCount: number;
};

type AssignmentSession = {
  studentId: string;
  status: string;
  completedCharlotte: boolean;
  pointsEarned: number;
  signInAt: Date;
  lastSeenAt: Date;
  signedOutAt: Date | null;
  completedAt: Date | null;
  answers: AssignmentAnswer[];
};

type AssignmentMaterial = {
  status: string;
  isAdaptiveHome: boolean;
  createdAt: Date;
  availableAt: Date | null;
  sessions: AssignmentSession[];
};

function sessionSortTime(session: AssignmentSession) {
  return (
    session.completedAt?.getTime() ??
    session.signedOutAt?.getTime() ??
    session.lastSeenAt.getTime() ??
    session.signInAt.getTime()
  );
}

function latestSessionForStudent(sessions: AssignmentSession[], studentId: string) {
  return sessions
    .filter((session) => session.studentId === studentId)
    .sort((a, b) => sessionSortTime(b) - sessionSortTime(a))[0];
}

function buildAssignmentStats(material: AssignmentMaterial | undefined, studentIds: string[]) {
  if (!material) {
    return {
      completedAll: 0,
      highScorers: 0,
      averageScore: 0,
      firstTryRate: 0,
      scoredSessions: 0,
      gradedAnswers: 0
    };
  }

  const latestSessions = studentIds
    .map((studentId) => latestSessionForStudent(material.sessions, studentId))
    .filter((session): session is AssignmentSession => Boolean(session));
  const finalizedSessions = latestSessions.filter((session) => session.status !== "IN_PROGRESS");
  const completedAll = studentIds.filter((studentId) =>
    latestSessionForStudent(material.sessions, studentId)?.completedCharlotte
  ).length;
  const highScorers = finalizedSessions.filter((session) => Math.min(100, session.pointsEarned) >= 80).length;
  const averageScore = finalizedSessions.length
    ? Math.round(finalizedSessions.reduce((sum, session) => sum + Math.min(100, session.pointsEarned), 0) / finalizedSessions.length)
    : 0;
  const gradedAnswers = finalizedSessions.flatMap((session) =>
    session.answers.filter((answer) => answer.isCorrect !== null)
  );
  const firstTryCorrect = gradedAnswers.filter((answer) =>
    answer.firstTryCorrect || (answer.isCorrect === true && answer.attemptCount <= 1)
  ).length;
  const firstTryRate = gradedAnswers.length ? Math.round((firstTryCorrect / gradedAnswers.length) * 100) : 0;

  return {
    completedAll,
    highScorers,
    averageScore,
    firstTryRate,
    scoredSessions: finalizedSessions.length,
    gradedAnswers: gradedAnswers.length
  };
}

function barWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function metricValueLabel(value: number, suffix: string) {
  return suffix === "%" ? `${value}%` : String(value);
}

function assignmentDetail(material: AssignmentMaterial | undefined, fallback: string) {
  return material ? fallback : "No assignment yet";
}

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
  const studentIds = classroom.students.map((student) => student.id);
  const thisAssignmentStats = buildAssignmentStats(latestActivity, studentIds);
  const lastAssignmentStats = buildAssignmentStats(olderActivity, studentIds);
  const studentScale = Math.max(1, classroom.students.length);
  const assignmentMetrics = [
    {
      label: "Finished this assignment",
      shortLabel: "Finished",
      thisValue: thisAssignmentStats.completedAll,
      lastValue: lastAssignmentStats.completedAll,
      thisHeight: barWidth(thisAssignmentStats.completedAll, studentScale),
      lastHeight: barWidth(lastAssignmentStats.completedAll, studentScale),
      suffix: " students",
      detail: assignmentDetail(latestActivity, "Completed the activity")
    },
    {
      label: "Scored 80% or higher",
      shortLabel: "80%+ scores",
      thisValue: thisAssignmentStats.highScorers,
      lastValue: lastAssignmentStats.highScorers,
      thisHeight: barWidth(thisAssignmentStats.highScorers, studentScale),
      lastHeight: barWidth(lastAssignmentStats.highScorers, studentScale),
      suffix: " students",
      detail: `${thisAssignmentStats.scoredSessions} finished scores`
    },
    {
      label: "Class average score",
      shortLabel: "Average",
      thisValue: thisAssignmentStats.averageScore,
      lastValue: lastAssignmentStats.averageScore,
      thisHeight: thisAssignmentStats.averageScore,
      lastHeight: lastAssignmentStats.averageScore,
      suffix: "%",
      detail: assignmentDetail(latestActivity, "Average of finished submissions")
    },
    {
      label: "First-try correct answers",
      shortLabel: "First try",
      thisValue: thisAssignmentStats.firstTryRate,
      lastValue: lastAssignmentStats.firstTryRate,
      thisHeight: thisAssignmentStats.firstTryRate,
      lastHeight: lastAssignmentStats.firstTryRate,
      suffix: "%",
      detail: `${thisAssignmentStats.gradedAnswers} graded answers`
    }
  ];

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

        <section className="weekly-improvement-panel" style={{ marginTop: 18 }}>
          <div className="weekly-improvement-heading">
            <div>
              <div className="eyebrow">Assignment improvement</div>
              <h2>This assignment vs last assignment</h2>
              <p>Simple class goals students can read from across the room.</p>
            </div>
            <div className="weekly-legend" aria-label="Assignment comparison legend">
              <span><i className="this-week-key" /> This assignment</span>
              <span><i className="last-week-key" /> Last assignment</span>
            </div>
          </div>
          <div className="weekly-chart" aria-label="Assignment improvement grouped bar chart">
            <div className="weekly-chart-scale" aria-hidden="true">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0</span>
            </div>
            <div className="weekly-chart-groups">
              {assignmentMetrics.map((metric) => {
                const change = metric.thisValue - metric.lastValue;
                const changeLabel = change > 0
                  ? `+${metricValueLabel(change, metric.suffix)}`
                  : metricValueLabel(change, metric.suffix);
                return (
                  <article className="weekly-chart-group" key={metric.label}>
                    <div className="weekly-bar-pair">
                      <div className="weekly-column-wrap">
                        <span
                          className="weekly-column-value"
                          style={{ bottom: `calc(${metric.thisHeight}% + 8px)` }}
                        >
                          {metricValueLabel(metric.thisValue, metric.suffix)}
                        </span>
                        <i
                          className="weekly-column this-week"
                          style={{ height: `${metric.thisHeight}%` }}
                        />
                      </div>
                      <div className="weekly-column-wrap">
                        <span
                          className="weekly-column-value"
                          style={{ bottom: `calc(${metric.lastHeight}% + 8px)` }}
                        >
                          {metricValueLabel(metric.lastValue, metric.suffix)}
                        </span>
                        <i
                          className="weekly-column last-week"
                          style={{ height: `${metric.lastHeight}%` }}
                        />
                      </div>
                    </div>
                    <strong>{metric.shortLabel}</strong>
                    <span>{metric.label}</span>
                    <small>{metric.detail}</small>
                    <em className={change >= 0 ? "weekly-up" : "weekly-down"}>
                      {change === 0 ? "Same" : changeLabel}
                    </em>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
