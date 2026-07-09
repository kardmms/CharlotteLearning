import { notFound, redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LegacyStudentDetailPage({
  params
}: {
  params: Promise<{ classroomId: string; studentId: string }>;
}) {
  const teacher = await requireTeacher();
  const { classroomId, studentId } = await params;
  const student = await prisma.student.findFirst({
    where: { id: studentId, classroomId, classroom: { teacherId: teacher.id } },
    include: {
      sessions: {
        where: { status: { in: ["COMPLETED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        take: 1,
        include: { material: true }
      }
    }
  });
  if (!student) notFound();

  const response = student.sessions[0];
  if (!response) redirect(`/teacher/classes/${classroomId}/progress`);
  redirect(
    `/teacher/classes/${classroomId}/materials/${response.materialId}/responses/${response.id}`
  );
}
