import Link from "next/link";
import { ArrowLeft, BookOpenCheck, LineChart, ShieldCheck, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { gradeLabel } from "@/lib/grade";
import { getClassroomMonthlyPerformance, type MonthlyScore } from "@/lib/monthly-performance";
import { AdminRosterIdentityReveal } from "@/components/AdminRosterIdentityReveal";

export const dynamic = "force-dynamic";

function scoreClass(value: number | null) {
  if (value === null) return "neutral";
  if (value >= 80) return "strong";
  if (value >= 60) return "mid";
  return "low";
}

function monthChange(months: MonthlyScore[], index: number) {
  const current = months[index]?.average;
  const previous = months[index - 1]?.average;
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return current - previous;
}

export default async function AdminClassroomPage({
  params
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const admin = await requireAdmin();
  const { classroomId } = await params;
  const classroom = await getClassroomMonthlyPerformance(classroomId);
  if (!classroom) notFound();

  const current = classroom.months[classroom.months.length - 1];
  const previous = classroom.months[classroom.months.length - 2];
  const change = monthChange(classroom.months, classroom.months.length - 1);

  return (
    <main className="admin-class-page">
      <div className="admin-class-detail">
        <header className="admin-class-detail-nav">
          <Link href="/admin" className="admin-class-back">
            <ArrowLeft size={17} />
            Main dashboard
          </Link>
          <span>Signed in as @{admin.username}</span>
        </header>

        <section className="admin-class-hero">
          <div>
            <div className="admin-breadcrumb">Classroom performance</div>
            <h1>{classroom.name}</h1>
            <p>{gradeLabel(classroom.gradeLevel)} · {classroom.teacherName}</p>
          </div>
          <div className="admin-privacy-badge">
            <ShieldCheck size={19} />
            {classroom.isPrivacyProtected ? "School-key protected" : "Admin-anonymized roster"}
          </div>
        </section>

        <section className="admin-class-stat-grid">
          <article>
            <LineChart size={20} />
            <span>{current.label} average</span>
            <strong>{current.average === null ? "—" : `${current.average}%`}</strong>
            <small>
              {change === null ? "No prior month comparison" : `${change >= 0 ? "+" : ""}${change} points vs ${previous.shortLabel}`}
            </small>
          </article>
          <article>
            <BookOpenCheck size={20} />
            <span>Assignments this month</span>
            <strong>{current.assignmentCount}</strong>
            <small>{current.scoredAssignmentCount} have finalized scores</small>
          </article>
          <article>
            <UsersRound size={20} />
            <span>Active students</span>
            <strong>{classroom.students.length}</strong>
            <small>Protected labels only</small>
          </article>
        </section>

        <section className="admin-glass-panel admin-class-trend-panel">
          <div className="admin-card-head">
            <div>
              <h2>Monthly class averages</h2>
              <p>The average of each assignment&apos;s class average; every assignment has equal weight.</p>
            </div>
            <LineChart size={20} />
          </div>
          <div className="admin-class-month-grid">
            {classroom.months.map((month, index) => {
              const monthDelta = monthChange(classroom.months, index);
              return (
                <article key={month.key}>
                  <span>{month.shortLabel}</span>
                  <strong>{month.average === null ? "—" : `${month.average}%`}</strong>
                  <i style={{ height: `${Math.max(4, month.average ?? 0)}%` }} />
                  <small>{month.assignmentCount} assignments</small>
                  <em className={monthDelta === null ? "neutral" : monthDelta >= 0 ? "up" : "down"}>
                    {monthDelta === null ? "—" : `${monthDelta >= 0 ? "+" : ""}${monthDelta} pts`}
                  </em>
                </article>
              );
            })}
          </div>
        </section>

        {classroom.isPrivacyProtected && (
          <AdminRosterIdentityReveal
            classroomId={classroom.id}
            privacyKeyHint={classroom.privacyKeyHint}
          />
        )}

        <section className="admin-glass-panel admin-class-students-panel">
          <div className="admin-card-head">
            <div>
              <h2>Student monthly averages</h2>
              <p>
                {classroom.isPrivacyProtected
                  ? "Protected roster labels remain visible until a valid classroom recovery key is entered above."
                  : "Student identities are anonymized in this administrative performance view."}
              </p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-student-month-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {classroom.months.map((month) => <th key={month.key}>{month.shortLabel}</th>)}
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => (
                  <tr key={student.id}>
                    <td><strong>{student.label}</strong></td>
                    {student.months.map((month) => (
                      <td key={month.key}>
                        <span className={`admin-month-score-pill ${scoreClass(month.average)}`}>
                          {month.average === null ? "—" : `${month.average}%`}
                        </span>
                        <small>{month.assignmentCount ? `${month.assignmentCount} scored` : "No scores"}</small>
                      </td>
                    ))}
                  </tr>
                ))}
                {classroom.students.length === 0 && (
                  <tr><td colSpan={classroom.months.length + 1}>No active students in this class.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
