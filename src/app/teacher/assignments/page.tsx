import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const teacher = await requireTeacher();
  const latestMaterial = await prisma.material.findFirst({
    where: { teacherId: teacher.id, isAdaptiveHome: false, classroom: { archivedAt: null } },
    orderBy: { updatedAt: "desc" },
    select: { classroomId: true }
  });
  if (latestMaterial) redirect(`/teacher/classes/${latestMaterial.classroomId}/materials`);

  const classroom = await prisma.classroom.findFirst({
    where: { teacherId: teacher.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (classroom) redirect(`/teacher/classes/${classroom.id}/materials`);
  redirect("/teacher/classes");
}
