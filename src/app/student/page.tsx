import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Home, LockKeyhole, School, Star, Trophy } from "lucide-react";
import { StudentTopbar } from "@/components/AppTopbar";
import { StartActivityButton } from "@/components/StartActivityButton";
import { getStudentCompletionLock, requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentBandClass } from "@/lib/grade";
import { classroomHasHomeLearningSources, ensureDailyHomePractice, homeLearningDayKey } from "@/lib/home-learning";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthCalendar(completedKeys: Set<string>, current = new Date()) {
  const firstDay = new Date(current.getFullYear(), current.getMonth(), 1).getDay();
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const cells: Array<{ label: string; key: string; complete: boolean; today: boolean } | null> = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(current.getFullYear(), current.getMonth(), day);
    const key = dayKey(date);
    cells.push({ label: String(day), key, complete: completedKeys.has(key), today: key === dayKey(current) });
  }
  return cells;
}

function formatDue(date?: Date | null) {
  if (!date) return "No due date";
  return `Due ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date)}`;
}

export default async function StudentHomePage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const query = await searchParams;
  const student = await requireStudent();
  const completionLock = await getStudentCompletionLock();
  if (completionLock) redirect(`/student/results/${completionLock}`);

  let homeGenerationError = "";
  if (query.view === "home") {
    try {
      await ensureDailyHomePractice(student.id);
    } catch (error) {
      homeGenerationError = error instanceof Error ? error.message : "Charlotte could not prepare today's Daily Win.";
    }
  }

  const now = new Date();
  const todayHomeSeriesKey = `adaptive-home:${homeLearningDayKey(now)}`;
  const [materials, hasHomeSources, points, completedHomeSessions] = await Promise.all([
    prisma.material.findMany({
      where: {
        classroomId: student.classroomId,
        status: "PUBLISHED",
        OR: [
          { targetStudentId: null },
          { targetStudentId: student.id, seriesKey: todayHomeSeriesKey }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        _count: { select: { questions: true } },
        sessions: {
          where: { studentId: student.id },
          orderBy: { signInAt: "desc" },
          take: 1,
          select: { status: true, completedCharlotte: true, pointsEarned: true }
        }
      }
    }),
    classroomHasHomeLearningSources(student.classroomId),
    prisma.studentSession.aggregate({
      where: { studentId: student.id, status: "COMPLETED" },
      _sum: { pointsEarned: true }
    }),
    prisma.studentSession.findMany({
      where: {
        studentId: student.id,
        status: "COMPLETED",
        completedAt: { not: null },
        material: { activityKind: "AT_HOME" }
      },
      select: { completedAt: true }
    })
  ]);
  const isOpen = (material: (typeof materials)[number]) =>
    (!material.availableAt || material.availableAt <= now) &&
    (!material.dueAt || material.dueAt >= now) &&
    !material.sessions.some((session) => session.status === "COMPLETED" || session.status === "PARTIAL");
  const inClassActivity = materials.find((material) => material.activityKind === "IN_CLASS" && isOpen(material));
  const atHomeActivity = materials.find((material) => material.activityKind === "AT_HOME" && isOpen(material));
  const completedInClass = materials.some(
    (material) => material.activityKind === "IN_CLASS" && material.sessions.some((session) => session.status === "COMPLETED")
  );
  const totalPoints = points._sum.pointsEarned || 0;
  const completedKeys = new Set(
    completedHomeSessions.map((session) => session.completedAt).filter((date): date is Date => Boolean(date)).map(dayKey)
  );
  const calendarCells = buildMonthCalendar(completedKeys, now);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);

  const activityView = query.view === "class" ? "class" : query.view === "home" ? "home" : null;
  const selectedActivity = activityView === "class" ? inClassActivity : activityView === "home" ? atHomeActivity : null;

  return (
    <div className={`student-shell ${studentBandClass(student.classroom.gradeLevel)}`}>
      <StudentTopbar name={student.displayName} />
      <main className="page student-mode-page">
        {activityView ? (
          <>
            <Link className="student-back-link" href="/student"><ArrowLeft size={18} /> Back to menu</Link>
            <section className={`student-mode-detail ${activityView}`}>
              <div className={`student-mode-symbol ${activityView}`}>
                {activityView === "class" ? <School size={32} /> : <Home size={32} />}
              </div>
              <span>{activityView === "class" ? "In-class activity" : "At-home activity"}</span>
              <h1>
                {selectedActivity
                  ? selectedActivity.title
                  : activityView === "class"
                    ? "No in-class activity available."
                    : homeGenerationError || "No at-home activity available today."}
              </h1>
              {selectedActivity ? (
                <>
                  <div className="student-start-meta">
                    <span><Clock3 size={17} /> {selectedActivity.estimatedMinutes} minutes</span>
                    {activityView === "class" && <span>{selectedActivity._count.questions} questions</span>}
                    <span><Star size={17} /> {activityView === "home" ? "Earn points as you go" : "Up to 100 points"}</span>
                    <span>{formatDue(selectedActivity.dueAt)}</span>
                  </div>
                  <p className="student-start-note">
                    {activityView === "home"
                      ? "Your Daily Win opens in a new window and continues until the 20-minute timer ends."
                      : "Your activity opens in a focused window. Leaving that window will flag the session."}
                  </p>
                  <StartActivityButton materialId={selectedActivity.id} focused />
                </>
              ) : (
                <Link className="ghost-button" href="/student">Go back to menu</Link>
              )}
            </section>

            {activityView === "home" && (
              <section className="daily-win-panel compact-daily-win student-mode-calendar">
                <div className="daily-win-copy">
                  <div className="daily-win-icon"><CalendarDays size={24} /></div>
                  <div><h3>Daily Win calendar</h3><p>Green days mark completed at-home activities.</p></div>
                </div>
                <div className="win-calendar" aria-label={`Daily Win calendar for ${monthLabel}`}>
                  <div className="win-calendar-title">{monthLabel}</div>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span className="win-calendar-weekday" key={`${day}-${index}`}>{day}</span>)}
                  {calendarCells.map((cell, index) => cell ? (
                    <span className={`win-calendar-day ${cell.complete ? "complete" : ""} ${cell.today ? "today" : ""}`} key={cell.key}>
                      {cell.complete ? <CheckCircle2 size={14} /> : cell.label}
                    </span>
                  ) : <span className="win-calendar-empty" key={`empty-${index}`} />)}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <section className="student-menu-heading">
              <div><span>Hi, {student.displayName.split(" ")[0]}!</span><h1>What are you working on?</h1></div>
              <div className="student-points-total"><Trophy size={23} /><strong>{totalPoints}</strong><span>total points</span></div>
            </section>
            <section className="student-mode-grid">
              <Link className={`student-mode-card class ${inClassActivity ? "available" : "unavailable"}`} href="/student?view=class">
                <div className="student-mode-symbol class"><School size={36} /></div>
                <div>
                  <span>{inClassActivity ? "Available now" : completedInClass ? "Completed" : "Nothing open"}</span>
                  <h2>In-class activity</h2>
                  <p>{inClassActivity ? "Your teacher has an activity ready." : "No in-class activity is available."}</p>
                </div>
                {inClassActivity ? <ArrowRight size={28} /> : <LockKeyhole size={25} />}
              </Link>
              <Link className={`student-mode-card home ${atHomeActivity || hasHomeSources ? "available" : "unavailable"}`} href="/student?view=home">
                <div className="student-mode-symbol home"><Home size={36} /></div>
                <div>
                  <span>{atHomeActivity || hasHomeSources ? "Today's Daily Win" : "Come back later"}</span>
                  <h2>At-home activity</h2>
                  <p>{atHomeActivity || hasHomeSources ? "Your adaptive 20-minute practice is ready." : "Your teacher has not added at-home material yet."}</p>
                </div>
                {atHomeActivity || hasHomeSources ? <ArrowRight size={28} /> : <LockKeyhole size={25} />}
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
