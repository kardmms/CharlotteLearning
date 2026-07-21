import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, ChevronLeft, ChevronRight, FileUp, Sparkles, Target, Trophy } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type WeekAnswer = {
  isCorrect: boolean | null;
  firstTryCorrect: boolean | null;
  attemptCount: number;
};

type WeekSession = {
  studentId: string;
  status: string;
  completedCharlotte: boolean;
  pointsEarned: number;
  signInAt: Date;
  lastSeenAt: Date;
  signedOutAt: Date | null;
  completedAt: Date | null;
  answers: WeekAnswer[];
};

type WeekMaterial = {
  status: string;
  isAdaptiveHome: boolean;
  createdAt: Date;
  availableAt: Date | null;
  sessions: WeekSession[];
};

function startOfWeek(date: Date) {
  const output = new Date(date);
  const daysSinceMonday = (output.getDay() + 6) % 7;
  output.setHours(0, 0, 0, 0);
  output.setDate(output.getDate() - daysSinceMonday);
  return output;
}

function addDays(date: Date, days: number) {
  const output = new Date(date);
  output.setDate(output.getDate() + days);
  return output;
}

function isInRange(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

function sessionSortTime(session: WeekSession) {
  return (
    session.completedAt?.getTime() ??
    session.signedOutAt?.getTime() ??
    session.lastSeenAt.getTime() ??
    session.signInAt.getTime()
  );
}

function latestSessionForStudent(sessions: WeekSession[], studentId: string) {
  return sessions
    .filter((session) => session.studentId === studentId)
    .sort((a, b) => sessionSortTime(b) - sessionSortTime(a))[0];
}

function buildWeekStats(materials: WeekMaterial[], studentIds: string[], start: Date, end: Date) {
  const weekMaterials = materials.filter((material) => {
    const assignedAt = material.availableAt || material.createdAt;
    return material.status === "PUBLISHED" && !material.isAdaptiveHome && isInRange(assignedAt, start, end);
  });
  const latestSessions = weekMaterials.flatMap((material) =>
    studentIds
      .map((studentId) => latestSessionForStudent(material.sessions, studentId))
      .filter((session): session is WeekSession => Boolean(session))
  );
  const finalizedSessions = latestSessions.filter((session) => session.status !== "IN_PROGRESS");
  const completedAll = weekMaterials.length
    ? studentIds.filter((studentId) =>
        weekMaterials.every((material) => latestSessionForStudent(material.sessions, studentId)?.completedCharlotte)
      ).length
    : 0;
  const highScorers = studentIds.filter((studentId) => {
    const studentSessions = weekMaterials
      .map((material) => latestSessionForStudent(material.sessions, studentId))
      .filter((session): session is WeekSession => Boolean(session && session.status !== "IN_PROGRESS"));
    if (!studentSessions.length) return false;
    const average = studentSessions.reduce((sum, session) => sum + Math.min(100, session.pointsEarned), 0) / studentSessions.length;
    return average >= 80;
  }).length;
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
    activityCount: weekMaterials.length,
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
  const thisWeekStart = startOfWeek(new Date());
  const nextWeekStart = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisWeekStats = buildWeekStats(classroom.materials, studentIds, thisWeekStart, nextWeekStart);
  const lastWeekStats = buildWeekStats(classroom.materials, studentIds, lastWeekStart, thisWeekStart);
  const studentScale = Math.max(1, classroom.students.length);
  const weeklyMetrics = [
    {
      label: "Finished every activity",
      Icon: CheckCircle2,
      thisValue: thisWeekStats.completedAll,
      lastValue: lastWeekStats.completedAll,
      thisWidth: barWidth(thisWeekStats.completedAll, studentScale),
      lastWidth: barWidth(lastWeekStats.completedAll, studentScale),
      suffix: " students",
      detail: `${thisWeekStats.activityCount} activities this week`
    },
    {
      label: "Scored 80% or higher",
      Icon: Trophy,
      thisValue: thisWeekStats.highScorers,
      lastValue: lastWeekStats.highScorers,
      thisWidth: barWidth(thisWeekStats.highScorers, studentScale),
      lastWidth: barWidth(lastWeekStats.highScorers, studentScale),
      suffix: " students",
      detail: `${thisWeekStats.scoredSessions} finished scores`
    },
    {
      label: "Class average score",
      Icon: Target,
      thisValue: thisWeekStats.averageScore,
      lastValue: lastWeekStats.averageScore,
      thisWidth: thisWeekStats.averageScore,
      lastWidth: lastWeekStats.averageScore,
      suffix: "%",
      detail: "Average of finished work"
    },
    {
      label: "First-try correct answers",
      Icon: Sparkles,
      thisValue: thisWeekStats.firstTryRate,
      lastValue: lastWeekStats.firstTryRate,
      thisWidth: thisWeekStats.firstTryRate,
      lastWidth: lastWeekStats.firstTryRate,
      suffix: "%",
      detail: `${thisWeekStats.gradedAnswers} graded answers`
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
              <div className="eyebrow">Weekly improvement</div>
              <h2>This week vs last week</h2>
              <p>Simple class goals students can read from across the room.</p>
            </div>
            <div className="weekly-legend" aria-label="Weekly comparison legend">
              <span><i className="this-week-key" /> This week</span>
              <span><i className="last-week-key" /> Last week</span>
            </div>
          </div>
          <div className="weekly-metric-list">
            {weeklyMetrics.map((metric) => {
              const Icon = metric.Icon;
              const change = metric.thisValue - metric.lastValue;
              const changeLabel = change > 0 ? `+${change}${metric.suffix}` : `${change}${metric.suffix}`;
              return (
                <article className="weekly-metric-card" key={metric.label}>
                  <div className="weekly-metric-title">
                    <span>
                      <Icon size={20} />
                    </span>
                    <div>
                      <strong>{metric.label}</strong>
                      <small>{metric.detail}</small>
                    </div>
                    <em className={change >= 0 ? "weekly-up" : "weekly-down"}>
                      {change === 0 ? "Same" : changeLabel}
                    </em>
                  </div>
                  <div className="weekly-bars">
                    <div className="weekly-bar-row">
                      <span>This week</span>
                      <div className="weekly-bar-track">
                        <b style={{ width: `${metric.thisWidth}%` }} />
                      </div>
                      <strong>{metric.thisValue}{metric.suffix}</strong>
                    </div>
                    <div className="weekly-bar-row last-week">
                      <span>Last week</span>
                      <div className="weekly-bar-track">
                        <b style={{ width: `${metric.lastWidth}%` }} />
                      </div>
                      <strong>{metric.lastValue}{metric.suffix}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
