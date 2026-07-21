import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";
import { summarizeClassData } from "@/lib/ai";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  try {
    assertSameOrigin(request);
    const teacher = await getTeacherSession();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { classroomId } = await params;
    await enforceRateLimit({
      scope: "teacher-ai-summary",
      limit: 30,
      windowSeconds: 60 * 60,
      identifier: `${teacher.sub}:${classroomId}`
    });
    await clearExpiredRateLimits();
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, teacherId: teacher.sub },
      include: {
        students: {
          where: { active: true },
          include: {
            sessions: {
              orderBy: { signInAt: "desc" },
              take: 1,
              include: {
                material: { select: { title: true } },
                answers: { select: { isCorrect: true } }
              }
            }
          }
        }
      }
    });
    if (!classroom) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const questions = await prisma.question.findMany({
      where: { material: { classroomId, teacherId: teacher.sub } },
      include: {
        answers: { select: { isCorrect: true } }
      }
    });

    const skillMap = new Map<string, { skill: string; attempts: number; correct: number }>();
    for (const question of questions) {
      const skill = question.skillTag || question.type;
      const row = skillMap.get(skill) || { skill, attempts: 0, correct: 0 };
      for (const answer of question.answers) {
        if (answer.isCorrect === null) continue;
        row.attempts += 1;
        if (answer.isCorrect) row.correct += 1;
      }
      skillMap.set(skill, row);
    }

    const skillRows = Array.from(skillMap.values())
      .filter((row) => row.attempts > 0)
      .map((row) => ({
        ...row,
        percentCorrect: Math.round((row.correct / row.attempts) * 100)
      }))
      .sort((a, b) => a.percentCorrect - b.percentCorrect);

    const studentRows = classroom.students.map((student) => {
      const latest = student.sessions[0];
      const incorrect = latest?.answers.filter((answer) => answer.isCorrect === false).length ?? 0;
      return {
        student: student.displayName,
        completed: Boolean(latest?.completedCharlotte),
        answers: latest?.answers.length ?? 0,
        incorrect,
        lastSeen: latest?.lastSeenAt?.toISOString() ?? "not started",
        material: latest?.material.title ?? "No session yet"
      };
    });

    const summary = await summarizeClassData({
      className: classroom.name,
      gradeLevel: classroom.gradeLevel,
      studentCount: classroom.students.length,
      skillRows,
      studentRows
    });

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Could not summarize class data" }, { status: 500 });
  }
}
