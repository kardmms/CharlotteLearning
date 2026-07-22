import Link from "next/link";
import { ArrowRight, Plus, UserPlus, UsersRound } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassActionsMenu } from "@/components/ClassActionsMenu";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";

export const dynamic = "force-dynamic";

export default async function TeacherClassesPage() {
  const teacher = await requireTeacher();
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { students: true, materials: true } }
    }
  });

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classrooms[0]?.id} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Classes</div>
            <h1>Classrooms</h1>
            <p>Open a class dashboard, check enrollment, or jump to the latest assignment.</p>
          </div>
          <Link className="button" href="/teacher/classes/new">
            <Plus size={18} />
            New class
          </Link>
        </section>

        <section className="doc-list class-doc-list">
          <div className="doc-list-head">
            <span>Name</span>
            <span>Students</span>
            <span>Assignments</span>
            <span>Manage</span>
          </div>
          {classrooms.map((classroom) => (
            <div className="doc-row" key={classroom.id}>
              <div className="doc-name">
                <span className="doc-icon">
                  <UsersRound size={18} />
                </span>
                <div>
                  <strong>{classroom.name}</strong>
                  <span>
                    {gradeLabel(classroom.gradeLevel)}
                  </span>
                </div>
              </div>
              <span>{classroom._count.students}</span>
              <span>{classroom._count.materials}</span>
              <div className="doc-actions">
                <Link className="ghost-button" href={`/teacher/classes/${classroom.id}/roster`}>
                  <UserPlus size={16} />
                  Students
                </Link>
                <Link className="ghost-button" href={`/teacher/classes/${classroom.id}`}>
                  Open
                  <ArrowRight size={16} />
                </Link>
                <ClassActionsMenu classroomId={classroom.id} />
              </div>
            </div>
          ))}
          {classrooms.length === 0 && (
            <div className="empty-state">
              <h2>No classes yet</h2>
              <p>Create a class from the overview page to begin.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
