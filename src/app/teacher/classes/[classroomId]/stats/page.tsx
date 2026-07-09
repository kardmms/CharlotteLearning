import { redirect } from "next/navigation";

export default async function StatsRedirect({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  redirect(`/teacher/classes/${classroomId}/materials`);
}
