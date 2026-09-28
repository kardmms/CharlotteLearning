import { BookOpen, GraduationCap, LogOut } from "lucide-react";
import { logoutStudent, redeemStudentClassLicense, selectStudentClassroom } from "@/app/student/actions";
import { requireStudentAccount } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { billingEnabled } from "@/lib/licensing";
import { Message } from "@/components/Message";

export const dynamic = "force-dynamic";

export default async function StudentClassesPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await requireStudentAccount();
  const query = await searchParams;
  const showBilling = billingEnabled();
  const redemptions = showBilling ? await prisma.studentLicense.findMany({
    where: { accountId: account.id, active: true, license: { status: "active" } },
    select: { teacherId: true }
  }) : [];
  const licensedTeachers = new Set(redemptions.map((row) => row.teacherId));
  const enrollments = await prisma.student.findMany({
    where: { accountId: account.id, active: true, classroom: { archivedAt: null } },
    orderBy: { classroom: { createdAt: "desc" } },
    include: {
      classroom: {
        include: {
          teacher: { select: { id: true, name: true, isShowcase: true } },
          _count: { select: { materials: true } }
        }
      }
    }
  });

  return (
    <div className="student-shell">
      <header className="topbar">
        <div className="brand"><img className="brand-logo" src="/images/charlotte-ai-logo.png" alt="" /><span>Charlotte AI</span></div>
        <form action={logoutStudent}><button className="ghost-button" type="submit"><LogOut size={18} /> Sign out</button></form>
      </header>
      <main className="page student-classes-page">
        <section className="student-menu-heading">
          <div><span>Hi, {account.displayName.split(" ")[0]}!</span><h1>Your classes</h1><p>Select a class to see its in-class and at-home activities.</p></div>
          <div className="student-mode-symbol class"><GraduationCap size={34} /></div>
        </section>
        <Message error={query.error} />
        <section className="student-class-grid">
          {enrollments.map((enrollment) => {
            const licensed = !showBilling || enrollment.classroom.teacher.isShowcase || licensedTeachers.has(enrollment.classroom.teacher.id);
            return <form className="student-class-card" action={licensed ? selectStudentClassroom : redeemStudentClassLicense} key={enrollment.id}>
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <div className="student-mode-symbol class"><BookOpen size={30} /></div>
              <div><span>{gradeLabel(enrollment.classroom.gradeLevel)}</span><h2>{enrollment.classroom.name}</h2><p>{enrollment.classroom.teacher.name}</p></div>
              {!licensed && <label>Teacher license key<input name="licenseKey" maxLength={64} autoComplete="off" required /></label>}
              <button className="button" type="submit">{licensed ? "Open class" : "Activate class"}</button>
            </form>;
          })}
          {!enrollments.length && (
            <div className="empty-state">
              <h2>No classes yet</h2>
              <p>
                {account.emailKeyHash
                  ? "Ask your teacher to add your email to a class."
                  : `Ask your teacher to add ${account.email} to a class.`}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
