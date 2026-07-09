import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: {
  params: Promise<{ classroomId: string; materialId: string }>;
}) {
  const teacher = await getTeacherSession();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { classroomId, materialId } = await params;
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.sub },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      sessions: {
        where: { status: { in: ["COMPLETED", "PARTIAL"] } },
        include: { student: true, answers: true },
        orderBy: { signInAt: "desc" }
      }
    }
  });
  if (!material) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const latestByStudent = new Map<string, (typeof material.sessions)[number]>();
  for (const session of material.sessions) {
    if (!latestByStudent.has(session.studentId)) latestByStudent.set(session.studentId, session);
  }
  const headers: unknown[] = ["Student", "Email", "Status", "Points", "Signed in", "Completed"];
  material.questions.forEach((_, index) => headers.push(`Question ${index + 1}`, `Question ${index + 1} result`));
  const rows: unknown[][] = [headers];
  for (const session of [...latestByStudent.values()].sort((a, b) => a.student.displayName.localeCompare(b.student.displayName))) {
    const row: unknown[] = [
      session.student.displayName,
      session.student.email ?? "",
      session.completedCharlotte ? "Complete" : "Timed out",
      session.pointsEarned,
      session.signInAt.toISOString(),
      session.completedAt?.toISOString() ?? ""
    ];
    for (const question of material.questions) {
      const answer = session.answers.find((item) => item.questionId === question.id);
      row.push(
        answer?.answerText === "No response" ? "" : answer?.answerText ?? "",
        !answer || answer.answerText === "No response"
          ? "Incorrect"
          : answer.isCorrect === null
            ? "Pending"
            : answer.isCorrect
              ? "Correct"
              : "Incorrect"
      );
    }
    rows.push(row);
  }
  const filename = material.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-responses.csv"`
    }
  });
}
