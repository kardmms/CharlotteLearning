import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ShowcaseTeacherEntryPage() {
  const teacher = await requireTeacher();
  if (!teacher.isShowcase) redirect("/teacher/classes");

  const classroom = await prisma.classroom.findFirst({
    where: { teacherId: teacher.id, schoolId: teacher.schoolId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (!classroom) redirect("/teacher");
  redirect(`/teacher/classes/${classroom.id}`);
}
