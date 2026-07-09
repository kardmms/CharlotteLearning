import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { TeacherTopbar } from "@/components/AppTopbar";
import { ClassNav } from "@/components/ClassNav";
import { DeleteMaterialButton } from "@/components/DeleteMaterialButton";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/date-groups";
import { gradeLabel } from "@/lib/grade";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ generated?: string; deleted?: string; q?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id },
    include: {
      materials: {
        where: { isAdaptiveHome: false },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true, sessions: true } }
        }
      }
    }
  });
  if (!classroom) notFound();
  const visibleMaterials = query.q
    ? classroom.materials.filter((material) => material.title.toLowerCase().includes(query.q!.toLowerCase()))
    : classroom.materials;
  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page">
        <section className="assignments-heading">
          <div><h1>Assignments</h1><p>{classroom.name} - {gradeLabel(classroom.gradeLevel)}</p></div>
          <form className="assignment-search"><Search size={18} /><input name="q" defaultValue={query.q} placeholder="Search assignments" /></form>
        </section>
        <ClassNav classroomId={classroom.id} />
        <Message
          success={
            query.generated
              ? `${query.generated} daily drafts created. Review each one before publishing.`
              : undefined
          }
        />
        <Message success={query.deleted ? "Assignment deleted." : undefined} />

        <section className="assignment-create-band">
          <div className="assignment-library-inner">
            <h2>Start a new assignment</h2>
            <Link className="new-assignment-tile" href={`/teacher/classes/${classroom.id}/materials/new`}>
              <span><Plus size={42} /></span>
              <strong>Create assignment</strong>
              <small>AI-assisted or manual</small>
            </Link>
          </div>
        </section>

        <section className="assignment-library-inner recent-assignments">
          <div className="assignment-library-title"><h2>Recent assignments</h2><span>{classroom.materials.length} total</span></div>
          <div className="doc-list forms-assignment-list">
          <div className="doc-list-head assignment-head">
            <span>Name</span>
            <span>Date modified</span>
            <span>Status</span>
            <span>Questions</span>
            <span>Sessions</span>
            <span />
          </div>
          {visibleMaterials.map((material) => (
                <div className="doc-row assignment-row" key={material.id}>
                  <Link
                    className="assignment-row-link"
                    href={`/teacher/classes/${classroom.id}/materials/${material.id}/review`}
                    aria-label={`Open ${material.title}`}
                  />
                  <div className="doc-name">
                    <span className="doc-icon">
                      <FileText size={18} />
                    </span>
                    <div>
                      <strong>{material.title}</strong>
                      <span>
                        {gradeLabel(material.gradeLevel)} - {material.estimatedMinutes} minutes
                      </span>
                    </div>
                  </div>
                  <span>{formatDateTime(material.updatedAt)}</span>
                  <span
                    className={`status-pill ${
                      material.status === "PUBLISHED" ? "status-green" : "status-yellow"
                    }`}
                  >
                    {material.status.toLowerCase()}
                  </span>
                  <span>{material._count.questions}</span>
                  <span>{material._count.sessions}</span>
                  <div className="doc-actions">
                    <DeleteMaterialButton classroomId={classroom.id} materialId={material.id} />
                  </div>
                </div>
          ))}
          {classroom.materials.length === 0 && (
            <div className="empty-state">
              <h2>No assignments yet</h2>
              <p>Upload a PDF or document to generate the first teacher-reviewed station.</p>
            </div>
          )}
          </div>
        </section>
      </main>
    </>
  );
}
