import Link from "next/link";
import { Archive, ArrowRight } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassActionsMenu } from "@/components/ClassActionsMenu";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/date-groups";
import { gradeLabel } from "@/lib/grade";

export const dynamic = "force-dynamic";

export default async function TeacherArchivePage() {
  const teacher = await requireTeacher();
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    include: {
      _count: { select: { students: true, materials: true } }
    }
  });

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">Archive</div>
            <h1>Archived classes</h1>
            <p>Restore a class when you need it again, or delete it from the menu.</p>
          </div>
        </section>

        <section className="doc-list archive-doc-list" style={{ marginTop: 18 }}>
          <div className="doc-list-head">
            <span>Name</span>
            <span>Students</span>
            <span>Assignments</span>
            <span>Archived</span>
            <span />
          </div>
          {classrooms.map((classroom) => (
            <div className="doc-row" key={classroom.id}>
              <div className="doc-name">
                <span className="doc-icon">
                  <Archive size={18} />
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
              <span>{classroom.archivedAt ? formatDateTime(classroom.archivedAt) : "Archived"}</span>
              <div className="doc-actions">
                <Link className="ghost-button" href={`/teacher/classes/${classroom.id}`}>
                  Open
                  <ArrowRight size={16} />
                </Link>
                <ClassActionsMenu classroomId={classroom.id} archived />
              </div>
            </div>
          ))}
          {classrooms.length === 0 && (
            <div className="empty-state">
              <h2>No archived classes</h2>
              <p>Archived classes will appear here instead of your active class list.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
