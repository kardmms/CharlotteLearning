import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { classroomId } = await params;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.sub },
    include: {
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        include: {
          sessions: {
            orderBy: { signInAt: "desc" },
            take: 1,
            include: { material: true, answers: true }
          }
        }
      }
    }
  });

  if (!classroom) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const rows: unknown[][] = [
    [
      "Student",
      "Email",
      "Latest Material",
      "Signed In",
      "Signed Out",
      "Last Seen",
      "Finished Charlotte",
      "Understood Story",
      "Opened Book",
      "Found Chapter",
      "Heard Vocabulary",
      "Answered Prompt",
      "Made Prediction",
      "Answered Questions"
    ]
  ];

  for (const student of classroom.students) {
    const session = student.sessions[0];
    rows.push([
      student.displayName,
      student.email ?? "",
      session?.material.title ?? "",
      session?.signInAt?.toISOString() ?? "",
      session?.signedOutAt?.toISOString() ?? "",
      session?.lastSeenAt?.toISOString() ?? "",
      session?.completedCharlotte ? "yes" : "not yet",
      session?.understoodStory ? "yes" : "not yet",
      session?.openedBook ? "yes" : "not yet",
      session?.foundChapter ? "yes" : "not yet",
      session?.heardVocabulary ? "yes" : "not yet",
      session?.answeredPrompt ? "yes" : "not yet",
      session?.madePrediction ? "yes" : "not yet",
      session?.answers.length ?? 0
    ]);
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${classroom.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-charlotte-export.csv"`
    }
  });
}
