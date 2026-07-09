import Link from "next/link";
import { ClipboardPlus } from "lucide-react";
import { AssignmentCreationForm } from "@/components/AssignmentCreationForm";
import { TeacherTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage({
  params,
  searchParams
}: {
  params: Promise<{ classroomId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const query = await searchParams;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) notFound();

  return (
    <>
      <TeacherTopbar name={teacher.name} classroomId={classroomId} />
      <main className="page narrow-page">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">New assignment</div>
              <h1>Create an in-class activity.</h1>
            </div>
            <ClipboardPlus color="#2563EB" />
          </div>
          <p>
            Build it with Charlotte or start from scratch. Either way, the draft stays private until
            you review and publish it.
          </p>
          <Message error={query.error} />
          <AssignmentCreationForm classroomId={classroom.id} />
          <div className="actions">
            <Link className="ghost-button" href={`/teacher/classes/${classroom.id}`}>
              Back to class dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
